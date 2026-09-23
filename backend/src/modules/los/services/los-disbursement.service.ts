import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  APPLICATION_STATUS,
} from '../../../common/constants/application.constants';
import { isBankNameMatchReviewPending } from '../../../common/constants/bank.constants';
import { isAadhaarNameMismatchPendingReview } from '../../../common/kyc/aadhaar-vendor-parse.util';
import {
  LOAN_DOCUMENT_PDF_FILES,
  LOAN_DOCUMENT_TYPE,
} from '../../../common/constants/loan-document.constants';
import { LOAN_STATUS } from '../../../common/constants/loan.constants';
import {
  EasebuzzWireService,
  type EasebuzzQuickTransferResult,
} from '../../../common/easebuzz/easebuzz-wire.service';
import {
  buildDisbursementUniqueRequestNumber,
  buildGatewayTransferJsonForPersist,
  isEasebuzzDuplicateUniqueRequestNumber,
  parseEasebuzzQuickTransferInitiate,
  uniqueRequestNumberFromVendorPayload,
} from '../../../common/easebuzz/easebuzz-transfer-log.util';
import { EmailService } from '../../../common/email/email.service';
import { KycCompletionService } from '../../../common/kyc/kyc-completion.service';
import { KycFilesService } from '../../../common/kyc/kyc-files.service';
import { isCustomerJourneyComplete } from '../../../common/loan/customer-journey-complete.util';
import { resolveLoanAccountNumberAtDisbursement } from '../../../common/loan/loan-account-number.util';
import { computeFeeAmountsFromLoanDetail } from '../../../common/loan/loan-disbursement-view.util';
import { computeTenureDays, decimalToNumber, istCalendarDateUtc } from '../../../common/loan/loan-calculation.util';
import { resolveRepaymentDueDateUtc } from '../../../common/loan/repayment-due-date.util';
import { RedisService } from '../../../common/redis/redis.service';
import { LoanDocumentApplicationService } from '../../auth/application/services/loan-document-application.service';
import { PrismaService } from '../../../prisma/prisma.service';

const DISBURSE_LOCK_TTL_SEC = 180;
const PENDING_URN_TTL_SEC = 24 * 60 * 60;

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

@Injectable()
export class LosDisbursementService {
  private readonly logger = new Logger(LosDisbursementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly loanDocs: LoanDocumentApplicationService,
    private readonly kycFiles: KycFilesService,
    private readonly kycCompletion: KycCompletionService,
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
    const nameReviewPending = isBankNameMatchReviewPending({
      statusName,
      statusNote: application.applicationStatusNote,
    });
    const customerKyc = await this.prisma.client.customerKyc.findFirst({
      where: { customerId: application.customerId },
      orderBy: { createdAt: 'desc' },
      select: { aadhaarData: true },
    });
    const aadhaarNameReviewPending = isAadhaarNameMismatchPendingReview(customerKyc?.aadhaarData);
    if (
      statusName === APPLICATION_STATUS.REJECTED ||
      statusName === APPLICATION_STATUS.CANCELLED ||
      statusName === APPLICATION_STATUS.KYC_FAILED ||
      statusName === APPLICATION_STATUS.PENNYDROP_FAILED ||
      nameReviewPending ||
      aadhaarNameReviewPending
    ) {
      throw new ConflictException(
        aadhaarNameReviewPending
          ? 'Aadhaar name match is still pending credit review. Approve the name match first.'
          : nameReviewPending
            ? 'Bank name match is still pending credit review. Approve the name match first.'
            : `Cannot approve an application in ${statusName} status.`,
      );
    }

    // DigiLocker re-download / early liveness return can leave face step done but kyc_status=0.
    const healedKyc = await this.kycCompletion.ensureCompletedWhenFaceStepDone({
      applicationId: application.id,
      customerId: application.customerId,
    });
    if (healedKyc.healed) {
      application.kyc = {
        kycStatus: healedKyc.kycStatus,
        kycCompletedAt: healedKyc.kycCompletedAt,
      };
    }

    if (!(await this.isJourneyComplete(application))) {
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

    // Freeze tenure/interest from disbursement day → the live repay date (not the
    // selection-day snapshot). The due date can still move until this moment.
    const disbursedAt = new Date();
    const liveRepayDate = await resolveRepaymentDueDateUtc(this.prisma.client, disbursedAt);
    const liveTenureDays = computeTenureDays(istCalendarDateUtc(disbursedAt), liveRepayDate);
    const detailsForFees = {
      ...details,
      expectedRepaymentDate: liveRepayDate,
      expectedRepaymentDays: liveTenureDays,
    };
    const fees = computeFeeAmountsFromLoanDetail(detailsForFees, disbursedAt);
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
    const loanNumber = resolveLoanAccountNumberAtDisbursement(application.applicationNumber);
    const skipTransfer = this.easebuzzWire.isTransferSkipped();

    let paymentGateway: 'easebuzz' | 'skipped' = 'skipped';
    let uniqueRequestNumber = '';
    let transferUtr: string | null = null;
    let vendorStatus: string | null = null;
    let gatewayTransferJson: unknown = null;

    if (skipTransfer) {
      this.logger.warn(
        `[disburse] EASEBUZZ_WIRE_SKIP_TRANSFER enabled — creating loan without Easebuzz for ${applicationUuid}`,
      );
    } else {
      this.easebuzzWire.assertConfiguredOrThrow();
      const transfer = await this.initiateSingleDisbursementPayment({
        applicationUuid,
        applicationNumber: application.applicationNumber,
        leadId: application.leadId,
        customerId: application.customerId,
        loanNumber,
        beneficiaryName,
        accountNumber: details.bankAccountNumber.trim(),
        ifscCode: details.ifscCode.trim(),
        amountInr: netAmount,
        email,
        phone: phoneDigits.slice(-10),
      });

      paymentGateway = 'easebuzz';
      uniqueRequestNumber = transfer.uniqueRequestNumber;
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
              ${liveRepayDate},
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

          // Persist the disbursement-day tenure and the live repay date so LOS / docs
          // match the frozen loan_account.loan_maturity_date.
          await tx.applicationDetail.update({
            where: { applicationId: application.id },
            data: {
              expectedRepaymentDays: liveTenureDays,
              expectedRepaymentDate: liveRepayDate,
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

    if (application.details) {
      application.details.expectedRepaymentDate = liveRepayDate;
      application.details.expectedRepaymentDays = liveTenureDays;
    }
    void this.emailFinalSanctionLetter(application);
    if (uniqueRequestNumber) {
      await this.clearPendingUrn(applicationUuid);
    }

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

  /**
   * At most one Easebuzz payout per application: reuse an in-flight / existing
   * URN, and only mint applicationNumber+timestamp when no live payment exists.
   */
  private async initiateSingleDisbursementPayment(input: {
    applicationUuid: string;
    applicationNumber: string;
    leadId: bigint;
    customerId: bigint;
    loanNumber: string;
    beneficiaryName: string;
    accountNumber: string;
    ifscCode: string;
    amountInr: number;
    email: string;
    phone: string;
  }): Promise<EasebuzzQuickTransferResult> {
    const existingUrn = await this.findExistingPaymentUrn({
      applicationUuid: input.applicationUuid,
      applicationNumber: input.applicationNumber,
      leadId: input.leadId,
    });

    if (existingUrn) {
      this.logger.log(
        `[disburse] Reusing existing payment URN app=${input.applicationUuid} unique=${existingUrn}`,
      );
      const adopted = await this.easebuzzWire.adoptExistingQuickTransfer(existingUrn, input.leadId);
      if (adopted.status === 'accepted') {
        await this.rememberPendingUrn(input.applicationUuid, existingUrn);
        return adopted.transfer;
      }
      if (adopted.status !== 'failed') {
        throw new ConflictException(
          'Disbursement payment is already in progress for this application. Please wait and try again.',
        );
      }
      this.logger.warn(
        `[disburse] Previous payment unique=${existingUrn} is not reusable; starting a new transfer.`,
      );
      await this.clearPendingUrn(input.applicationUuid);
    }

    const uniqueRequestNumber = buildDisbursementUniqueRequestNumber(input.applicationNumber);
    await this.rememberPendingUrn(input.applicationUuid, uniqueRequestNumber);
    this.logger.log(
      `[disburse] Easebuzz transfer app=${input.applicationUuid} unique=${uniqueRequestNumber} ` +
        `amount=${input.amountInr.toFixed(2)} account=${maskAccount(input.accountNumber)}`,
    );

    try {
      return await this.easebuzzWire.initiateQuickTransfer({
        beneficiaryName: input.beneficiaryName,
        accountNumber: input.accountNumber,
        ifscCode: input.ifscCode,
        uniqueRequestNumber,
        amountInr: input.amountInr,
        email: input.email,
        phone: input.phone,
        narration: 'loan disbursed',
        leadId: input.leadId,
        udf1: input.applicationNumber.slice(0, 50),
        udf2: input.applicationUuid.slice(0, 50),
        udf3: String(input.customerId),
        udf4: input.loanNumber.slice(0, 50),
        udf5: 'LOS_DISBURSE',
      });
    } catch (error) {
      if (error instanceof UnprocessableEntityException) {
        await this.clearPendingUrn(input.applicationUuid);
      }
      throw error;
    }
  }

  private pendingUrnKey(applicationUuid: string): string {
    return `los:disburse:urn:${applicationUuid}`;
  }

  private async rememberPendingUrn(applicationUuid: string, uniqueRequestNumber: string): Promise<void> {
    try {
      await this.redis.client.set(
        this.pendingUrnKey(applicationUuid),
        uniqueRequestNumber,
        'EX',
        PENDING_URN_TTL_SEC,
      );
    } catch (error) {
      this.logger.warn(
        `[disburse] Failed to persist pending URN ${uniqueRequestNumber}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async clearPendingUrn(applicationUuid: string): Promise<void> {
    try {
      await this.redis.client.del(this.pendingUrnKey(applicationUuid));
    } catch (error) {
      this.logger.warn(
        `[disburse] Failed to clear pending URN for ${applicationUuid}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async findExistingPaymentUrn(params: {
    applicationUuid: string;
    applicationNumber: string;
    leadId: bigint;
  }): Promise<string | null> {
    try {
      const fromRedis = (await this.redis.client.get(this.pendingUrnKey(params.applicationUuid)))?.trim();
      if (fromRedis) return fromRedis;
    } catch (error) {
      this.logger.warn(
        `[disburse] Failed to read pending URN for ${params.applicationUuid}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const logs = await this.prisma.client.vendorApiLog.findMany({
      where: {
        leadId: params.leadId,
        providerName: 'Easebuzz',
        serviceName: 'quick-transfer-initiate',
      },
      orderBy: { requestedAt: 'desc' },
      take: 12,
      select: { requestPayload: true, responsePayload: true },
    });

    for (const log of logs) {
      const urn = uniqueRequestNumberFromVendorPayload(log.requestPayload);
      if (!urn) continue;
      const parsed = parseEasebuzzQuickTransferInitiate(log.responsePayload);
      if (parsed.accepted || isEasebuzzDuplicateUniqueRequestNumber(parsed.message)) {
        return urn;
      }
    }

    return null;
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

  private async isJourneyComplete(
    application: Awaited<ReturnType<LosDisbursementService['loadApplicationForDecision']>>,
  ): Promise<boolean> {
    const detail = application.lead.leadDetail;
    let hasBureauReport = Boolean(detail?.bureauReportId);
    if (!hasBureauReport) {
      const prior = await this.prisma.client.bureauReport.findFirst({
        where: { customerId: application.customerId },
        select: { id: true },
      });
      hasBureauReport = Boolean(prior);
    }
    return isCustomerJourneyComplete({
      fullName: detail?.fullName,
      panVerified: detail?.panVerified,
      bureauFetched: detail?.bureauFetched,
      hasBureauReport,
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
        applicationStatusNote: true,
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
            keyFactDisbursementPdfRelativePath: true,
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
            leadDetail: {
              select: {
                fullName: true,
                panVerified: true,
                bureauFetched: true,
                bureauReportId: true,
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

      const existing = this.loanDocs.relativePathForType(LOAN_DOCUMENT_TYPE.KEY_FACT_DISBURSEMENT, {
        keyFactPdfRelativePath: application.details?.keyFactPdfRelativePath ?? null,
        keyFactDisbursementPdfRelativePath:
          application.details?.keyFactDisbursementPdfRelativePath ?? null,
        loanAgreementPdfRelativePath: application.details?.loanAgreementPdfRelativePath ?? null,
      });

      // Revised sanction letter + commercial terms at disbursement — keep acceptance PDF untouched; never overwrite prior disbursement PDF.
      const rel = await this.loanDocs.ensurePdf(
        LOAN_DOCUMENT_TYPE.KEY_FACT_DISBURSEMENT,
        application.customer.uuid,
        application.uuid,
        application.id,
        merge,
        existing,
        true,
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
        [{ filename: LOAN_DOCUMENT_PDF_FILES[LOAN_DOCUMENT_TYPE.KEY_FACT_DISBURSEMENT], content }],
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
