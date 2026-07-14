import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  APPLICATION_STATUS,
} from '../../../common/constants/application.constants';
import {
  LOAN_DOCUMENT_PDF_FILES,
  LOAN_DOCUMENT_TYPE,
} from '../../../common/constants/loan-document.constants';
import { LOAN_STATUS } from '../../../common/constants/loan.constants';
import { EasebuzzWireService } from '../../../common/easebuzz/easebuzz-wire.service';
import { buildGatewayTransferJsonForPersist } from '../../../common/easebuzz/easebuzz-transfer-log.util';
import { EmailService } from '../../../common/email/email.service';
import { KycFilesService } from '../../../common/kyc/kyc-files.service';
import { isCustomerJourneyComplete } from '../../../common/loan/customer-journey-complete.util';
import { resolveLoanAccountNumberAtDisbursement } from '../../../common/loan/loan-account-number.util';
import { computeFeeAmountsFromLoanDetail } from '../../../common/loan/loan-disbursement-view.util';
import { decimalToNumber } from '../../../common/loan/loan-calculation.util';
import { RedisService } from '../../../common/redis/redis.service';
import { LoanDocumentApplicationService } from '../../auth/application/services/loan-document-application.service';
import { PrismaService } from '../../../prisma/prisma.service';

const DISBURSE_LOCK_TTL_SEC = 120;

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

function maskAccount(account: string): string {
  const digits = account.replace(/\D/g, '');
  if (digits.length <= 4) return '****';
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

/**
 * Easebuzz unique_request_number — stable across retries for the same application.
 * Example auth pipe: …|MCASH12346|10.00|…
 */
function buildUniqueRequestNumber(applicationNumber: string): string {
  const compact = applicationNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return `MCASH${compact}`.slice(0, 40);
}

@Injectable()
export class LosDisbursementService {
  private readonly logger = new Logger(LosDisbursementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly loanDocs: LoanDocumentApplicationService,
    private readonly kycFiles: KycFilesService,
    private readonly emailService: EmailService,
    private readonly easebuzzWire: EasebuzzWireService,
    private readonly redis: RedisService,
  ) {}

  async approveApplication(applicationUuid: string) {
    const application = await this.loadApplicationForDecision(applicationUuid);

    const statusName = application.applicationStatus.name;
    if (statusName === APPLICATION_STATUS.APPROVED) {
      return {
        success: true as const,
        applicationUuid,
        statusCode: APPLICATION_STATUS.APPROVED,
        alreadyApproved: true,
      };
    }
    if (statusName === APPLICATION_STATUS.DISBURSED) {
      throw new ConflictException('This application is already disbursed.');
    }
    if (
      statusName === APPLICATION_STATUS.REJECTED ||
      statusName === APPLICATION_STATUS.CANCELLED ||
      statusName === APPLICATION_STATUS.KYC_FAILED
    ) {
      throw new ConflictException(`Cannot approve an application in ${statusName} status.`);
    }

    if (!this.isJourneyComplete(application)) {
      throw new BadRequestException(
        'Customer journey is incomplete. Approve is available only after profile, credit, loan, email, sanction letter, KYC, bank, and references are done.',
      );
    }

    const approvedStatus = await this.prisma.client.applicationStatus.findFirst({
      where: { name: APPLICATION_STATUS.APPROVED, isActive: true },
      select: { id: true },
    });
    if (!approvedStatus) {
      throw new NotFoundException('APPROVED application status is not configured.');
    }

    await this.prisma.client.application.update({
      where: { id: application.id },
      data: {
        applicationStatusId: approvedStatus.id,
        applicationStatusNote: null,
      },
    });

    return {
      success: true as const,
      applicationUuid,
      statusCode: APPLICATION_STATUS.APPROVED,
      alreadyApproved: false,
    };
  }

  async disburseApplication(applicationUuid: string) {
    const lockKey = `los:disburse:${applicationUuid}`;
    const lockToken = randomUUID();
    const acquired = await this.redis.client.set(
      lockKey,
      lockToken,
      'EX',
      DISBURSE_LOCK_TTL_SEC,
      'NX',
    );
    if (acquired !== 'OK') {
      throw new ConflictException(
        'Disbursement is already in progress for this application. Please wait and try again.',
      );
    }

    try {
      return await this.disburseApplicationLocked(applicationUuid);
    } finally {
      await this.releaseDisburseLock(lockKey, lockToken);
    }
  }

  private async disburseApplicationLocked(applicationUuid: string) {
    const application = await this.loadApplicationForDecision(applicationUuid);

    if (application.loanAccount) {
      throw new ConflictException('A loan account already exists for this application.');
    }

    const statusName = application.applicationStatus.name;
    if (statusName === APPLICATION_STATUS.DISBURSED) {
      throw new ConflictException('This application is already disbursed.');
    }
    if (statusName !== APPLICATION_STATUS.APPROVED) {
      throw new BadRequestException(
        'Application must be APPROVED before disbursement. Approve the application first.',
      );
    }

    const details = application.details;
    if (!details?.selectedLoanAmount || !details.expectedRepaymentDays || !details.expectedRepaymentDate) {
      throw new BadRequestException('Loan selection is incomplete — cannot disburse.');
    }
    if (!details.bankAccountNumber?.trim() || !details.ifscCode?.trim()) {
      throw new BadRequestException('Bank account details are required before disbursement.');
    }

    const beneficiaryName = application.lead.leadDetail?.fullName?.trim();
    if (!beneficiaryName) {
      throw new BadRequestException('Borrower full name is required before disbursement.');
    }

    const email = details.emailId?.trim();
    if (!email) {
      throw new BadRequestException('Verified borrower email is required before disbursement.');
    }

    const phoneDigits = application.customer.mobileNumber.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      throw new BadRequestException('Borrower mobile number is invalid for disbursement.');
    }

    const fees = computeFeeAmountsFromLoanDetail(details);
    const principal = decimalToNumber(details.selectedLoanAmount);
    const interestRate = decimalToNumber(details.interestRate);
    if (
      principal == null ||
      interestRate == null ||
      fees.disburseAmount == null ||
      fees.interestAmount == null
    ) {
      throw new BadRequestException('Unable to compute disbursement amounts from loan details.');
    }

    const netAmount = fees.disburseAmount;
    // Loan number stays application number; Easebuzz URN uses MCASH{applicationNumber}.
    const loanNumber = resolveLoanAccountNumberAtDisbursement(application.applicationNumber);
    const uniqueRequestNumber = buildUniqueRequestNumber(application.applicationNumber);
    const skipTransfer = this.easebuzzWire.isTransferSkipped();

    let paymentGateway: 'easebuzz' | 'skipped' = 'skipped';
    let transferUtr: string | null = null;
    let vendorStatus: string | null = null;
    let gatewayTransferJson: unknown = null;

    if (skipTransfer) {
      this.logger.warn(
        `[disburse] EASEBUZZ_WIRE_SKIP_TRANSFER enabled — creating loan without Easebuzz for ${applicationUuid}`,
      );
    } else {
      this.easebuzzWire.assertConfiguredOrThrow();
      this.logger.log(
        `[disburse] Easebuzz transfer app=${applicationUuid} unique=${uniqueRequestNumber} ` +
          `amount=${netAmount.toFixed(2)} account=${maskAccount(details.bankAccountNumber)}`,
      );

      const transfer = await this.easebuzzWire.initiateQuickTransfer({
        beneficiaryName,
        accountNumber: details.bankAccountNumber.trim(),
        ifscCode: details.ifscCode.trim(),
        uniqueRequestNumber,
        amountInr: netAmount,
        email,
        phone: phoneDigits.slice(-10),
        narration: 'loan disbursed',
        leadId: application.leadId,
        udf1: application.applicationNumber.slice(0, 50),
        udf2: application.uuid.slice(0, 50),
        udf3: String(application.customerId),
        udf4: loanNumber.slice(0, 50),
        udf5: 'LOS_DISBURSE',
      });

      paymentGateway = 'easebuzz';
      transferUtr = transfer.transferId?.slice(0, 50) ?? uniqueRequestNumber.slice(0, 50);
      vendorStatus = transfer.vendorStatus;
      gatewayTransferJson = buildGatewayTransferJsonForPersist(transfer.rawBody);
    }

    const disbursedStatus = await this.prisma.client.applicationStatus.findFirst({
      where: { name: APPLICATION_STATUS.DISBURSED, isActive: true },
      select: { id: true },
    });
    const activeLoanStatus = await this.prisma.client.loanStatus.findFirst({
      where: { name: LOAN_STATUS.ACTIVE, isActive: true },
      select: { id: true },
    });
    if (!disbursedStatus) {
      throw new NotFoundException('DISBURSED application status is not configured.');
    }
    if (!activeLoanStatus) {
      throw new NotFoundException('ACTIVE loan status is not configured.');
    }

    const totalRepayment = principal + fees.interestAmount;
    const disbursedAt = new Date();
    const loanUuid = randomUUID();
    const utrForDb = transferUtr;

    let loanAccount: {
      uuid: string;
      loanNumber: string;
      loanAccountNumber: string;
      principalAmount: string;
      netDisbursedAmount: string;
      disbursedAt: Date;
    };

    try {
      loanAccount = await this.prisma.client.$transaction(
        async (tx) => {
          // Row lock: prevent concurrent loan_account insert for the same application.
          const locked = await tx.$queryRaw<Array<{ id: bigint; status_name: string }>>`
            SELECT a.id, s.name AS status_name
            FROM application a
            INNER JOIN application_status s ON s.id = a.application_status_id
            WHERE a.id = ${application.id}
            FOR UPDATE
          `;
          const row = locked[0];
          if (!row) {
            throw new NotFoundException('Application not found.');
          }
          if (row.status_name !== APPLICATION_STATUS.APPROVED) {
            throw new ConflictException(
              `Application status changed to ${row.status_name}; disbursement aborted.`,
            );
          }

          const existingLoan = await tx.loanAccount.findUnique({
            where: { applicationId: application.id },
            select: { id: true },
          });
          if (existingLoan) {
            throw new ConflictException('A loan account already exists for this application.');
          }

          await tx.$executeRaw`
            INSERT INTO loan_account (
              uuid,
              application_id,
              customer_id,
              loan_number,
              loan_account_number,
              principal_amount,
              net_disbursed_amount,
              interest_rate,
              interest_amount,
              total_repayment_amount,
              disbursed_at,
              loan_maturity_date,
              utr,
              gateway_transfer_json,
              bank_account_number,
              ifsc_code,
              loan_status_id,
              closed_at,
              created_at,
              updated_at
            ) VALUES (
              ${loanUuid},
              ${application.id},
              ${application.customerId},
              ${loanNumber},
              ${loanNumber},
              ${principal.toFixed(2)},
              ${netAmount.toFixed(2)},
              ${interestRate.toFixed(2)},
              ${fees.interestAmount!.toFixed(2)},
              ${totalRepayment.toFixed(2)},
              ${disbursedAt},
              ${details.expectedRepaymentDate!},
              ${utrForDb},
              ${gatewayTransferJson == null ? null : JSON.stringify(gatewayTransferJson)},
              ${details.bankAccountNumber},
              ${details.ifscCode},
              ${activeLoanStatus.id},
              ${null},
              ${disbursedAt},
              ${disbursedAt}
            )
          `;

          await tx.application.update({
            where: { id: application.id },
            data: {
              applicationStatusId: disbursedStatus.id,
              applicationStatusNote: null,
            },
          });

          return {
            uuid: loanUuid,
            loanNumber,
            loanAccountNumber: loanNumber,
            principalAmount: principal.toFixed(2),
            netDisbursedAmount: netAmount.toFixed(2),
            disbursedAt,
          };
        },
        { timeout: 20_000 },
      );
    } catch (error) {
      if (paymentGateway === 'easebuzz') {
        this.logger.error(
          `[disburse] CRITICAL: Easebuzz transfer succeeded but loan_account persistence failed ` +
            `app=${applicationUuid} unique=${uniqueRequestNumber} utr=${utrForDb ?? 'n/a'} ` +
            `vendorStatus=${vendorStatus ?? 'n/a'}. Manual reconciliation required.`,
          error instanceof Error ? error.stack : error,
        );
      }
      throw error;
    }

    await this.emailFinalSanctionLetter(application);

    return {
      success: true as const,
      applicationUuid,
      statusCode: APPLICATION_STATUS.DISBURSED,
      loan: {
        uuid: loanAccount.uuid,
        loanNumber: loanAccount.loanNumber,
        loanAccountNumber: loanAccount.loanAccountNumber,
        principalAmount: loanAccount.principalAmount,
        netDisbursedAmount: loanAccount.netDisbursedAmount,
        disbursedAt: loanAccount.disbursedAt.toISOString(),
      },
      paymentGateway,
      transfer: paymentGateway === 'easebuzz'
        ? {
            uniqueRequestNumber,
            utr: utrForDb,
            vendorStatus,
          }
        : null,
    };
  }

  private async releaseDisburseLock(lockKey: string, lockToken: string): Promise<void> {
    try {
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        end
        return 0
      `;
      await this.redis.client.eval(script, 1, lockKey, lockToken);
    } catch (error) {
      this.logger.warn(
        `[disburse] Failed to release lock ${lockKey}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private isJourneyComplete(
    application: Awaited<ReturnType<LosDisbursementService['loadApplicationForDecision']>>,
  ): boolean {
    const detail = application.lead.leadDetail;
    return isCustomerJourneyComplete({
      fullName: detail?.fullName,
      panVerified: detail?.panVerified,
      bureauFetched: detail?.bureauFetched,
      hasBureauReport: Boolean(application.lead.bureauReports?.[0]),
      selectedLoanAmount: application.details?.selectedLoanAmount,
      emailVerifiedAt: application.details?.emailVerifiedAt,
      loanDocumentsAcceptedAt: application.details?.loanDocumentsAcceptedAt,
      kycStatus: application.kyc?.kycStatus,
      kycCompletedAt: application.kyc?.kycCompletedAt,
      bankAccountNumber: application.details?.bankAccountNumber,
      referencesCount: application._count.references,
    });
  }

  private async loadApplicationForDecision(applicationUuid: string) {
    const application = await this.prisma.client.application.findUnique({
      where: { uuid: applicationUuid },
      select: {
        id: true,
        uuid: true,
        applicationNumber: true,
        customerId: true,
        leadId: true,
        applicationStatus: { select: { name: true } },
        loanAccount: { select: { id: true } },
        details: {
          select: {
            emailId: true,
            emailVerificationType: true,
            emailVerifiedAt: true,
            selectedLoanAmount: true,
            interestRate: true,
            processingFeePercentage: true,
            gstPercentage: true,
            expectedRepaymentDays: true,
            expectedRepaymentDate: true,
            bankAccountNumber: true,
            ifscCode: true,
            bankName: true,
            loanDocumentsAcceptedAt: true,
            loanDocumentsAcceptedIp: true,
            keyFactPdfRelativePath: true,
            loanAgreementPdfRelativePath: true,
            reasonForLoan: { select: { name: true } },
          },
        },
        kyc: {
          select: {
            kycStatus: true,
            kycCompletedAt: true,
          },
        },
        _count: { select: { references: true } },
        customer: { select: { uuid: true, mobileNumber: true } },
        lead: {
          select: {
            bureauReports: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { id: true },
            },
            leadDetail: {
              select: {
                fullName: true,
                panVerified: true,
                bureauFetched: true,
                panNumber: true,
                addressLine1: true,
                addressLine2: true,
                pincode: true,
                city: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found.');
    }
    return application;
  }

  private async emailFinalSanctionLetter(
    application: Awaited<ReturnType<LosDisbursementService['loadApplicationForDecision']>>,
  ): Promise<void> {
    const email = application.details?.emailId?.trim();
    if (!email) {
      this.logger.warn(
        `[disburse] No email on application ${application.uuid}; skipping final sanction letter.`,
      );
      return;
    }

    try {
      const merge = this.loanDocs.buildMergeInput({
        customer: application.customer,
        lead: application.lead,
        application: {
          uuid: application.uuid,
          applicationNumber: application.applicationNumber,
          loanDocumentsAcceptedIp: application.details?.loanDocumentsAcceptedIp,
          loanDocumentsAcceptedAt: application.details?.loanDocumentsAcceptedAt,
          details: application.details,
        },
      });

      const existing = this.loanDocs.relativePathForType(LOAN_DOCUMENT_TYPE.KEY_FACT, {
        keyFactPdfRelativePath: application.details?.keyFactPdfRelativePath ?? null,
        loanAgreementPdfRelativePath: application.details?.loanAgreementPdfRelativePath ?? null,
      });

      // Force regenerate revised sanction letter after disbursement.
      const rel = await this.loanDocs.ensurePdf(
        LOAN_DOCUMENT_TYPE.KEY_FACT,
        application.customer.uuid,
        application.uuid,
        application.id,
        merge,
        existing,
        true,
        true,
      );

      if (!this.emailService.isConfigured()) {
        this.logger.warn(
          `[disburse] SMTP not configured; skipping final sanction letter to ${maskEmail(email)}.`,
        );
        return;
      }

      const content = await this.kycFiles.readBytes(rel);
      await this.emailService.sendFinalSanctionLetterEmail(
        email,
        [{ filename: LOAN_DOCUMENT_PDF_FILES[LOAN_DOCUMENT_TYPE.KEY_FACT], content }],
        { leadId: application.leadId },
      );
      this.logger.log(
        `Final (revised) sanction letter emailed to ${maskEmail(email)} for application ${application.uuid}.`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to email final sanction letter for application ${application.uuid}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }
}
