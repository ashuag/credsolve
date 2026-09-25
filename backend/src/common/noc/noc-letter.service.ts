import { Injectable, Logger } from '@nestjs/common';
import { LOAN_STATUS } from '../constants/loan.constants';
import { EmailService } from '../email/email.service';
import { KycFilesService } from '../kyc/kyc-files.service';
import { overdueDaysFromMaturity } from '../loan/bounce-charge.util';
import { decimalToNumber } from '../loan/loan-calculation.util';
import { waivedAmountFromLoan } from '../loan/loan-charge-waiver.util';
import { LoanDocumentHtmlPdfGeneratorService } from '../loan-documents/loan-document-html-pdf-generator.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildBorrowerAddressLines,
  buildNocLetterNumber,
  formatNocDateLong,
  formatNocDateShort,
  formatNocLoanAmountInr,
  formatNocWaiver,
  renderNocLetterHtml,
} from './noc-letter-html.util';

@Injectable()
export class NocLetterService {
  private readonly logger = new Logger(NocLetterService.name);
  private readonly inflight = new Map<string, Promise<boolean>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly kycFiles: KycFilesService,
    private readonly htmlPdf: LoanDocumentHtmlPdfGeneratorService,
    private readonly email: EmailService,
  ) {}

  /**
   * Generate NOC PDF, upload to S3, mark loan_account as sent, email customer.
   * Idempotent when `isNocSent` is already true. Never throws to callers — logs failures.
   */
  async issueIfNeeded(loanAccountId: bigint): Promise<boolean> {
    const key = loanAccountId.toString();
    const pending = this.inflight.get(key);
    if (pending) return pending;

    const work = this.issueOnce(loanAccountId).finally(() => {
      this.inflight.delete(key);
    });
    this.inflight.set(key, work);
    return work;
  }

  /** Fire-and-forget wrapper for settle paths. */
  scheduleIssueIfNeeded(loanAccountId: bigint): void {
    void this.issueIfNeeded(loanAccountId).catch((err) => {
      this.logger.error(
        `[noc] Unhandled issue failure loanId=${loanAccountId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    });
  }

  private async issueOnce(loanAccountId: bigint): Promise<boolean> {
    try {
      const loan = await this.prisma.client.loanAccount.findUnique({
        where: { id: loanAccountId },
        select: {
          id: true,
          uuid: true,
          loanNumber: true,
          loanAccountNumber: true,
          principalAmount: true,
          disbursedAt: true,
          loanMaturityDate: true,
          closedAt: true,
          waivedAmount: true,
          isNocSent: true,
          nocPdfRelativePath: true,
          nocLetterNumber: true,
          customer: { select: { uuid: true } },
          loanStatus: { select: { name: true } },
          application: {
            select: {
              id: true,
              uuid: true,
              leadId: true,
              details: { select: { emailId: true } },
              lead: {
                select: {
                  leadDetail: {
                    select: {
                      fullName: true,
                      addressLine1: true,
                      addressLine2: true,
                      pincode: true,
                      city: { select: { name: true, state: { select: { name: true } } } },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!loan) {
        this.logger.warn(`[noc] Loan not found id=${loanAccountId}`);
        return false;
      }
      if (loan.isNocSent) {
        this.logger.debug(`[noc] Already sent loan=${loan.loanNumber}`);
        return true;
      }
      if (loan.closedAt == null) {
        this.logger.warn(`[noc] Loan not closed loan=${loan.loanNumber}`);
        return false;
      }

      const sentAt = new Date();
      const letterNo = buildNocLetterNumber(loan.loanNumber, sentAt);
      const repaymentAt = loan.closedAt;
      const overdueDays = overdueDaysFromMaturity(loan.loanMaturityDate, repaymentAt);
      const waiverInr = waivedAmountFromLoan(loan.waivedAmount);
      const principal = decimalToNumber(loan.principalAmount) ?? 0;
      const statusName = (loan.loanStatus.name ?? '').toUpperCase();
      const accountStatus =
        statusName === LOAN_STATUS.SETTLED ? 'SETTLED' : 'PAID';

      const detail = loan.application.lead.leadDetail;
      const borrowerName = detail?.fullName?.trim() || 'Customer';
      const borrowerAddress = buildBorrowerAddressLines({
        addressLine1: detail?.addressLine1,
        addressLine2: detail?.addressLine2,
        cityName: detail?.city?.name,
        stateName: detail?.city?.state?.name,
        pincode: detail?.pincode,
      });

      const html = await renderNocLetterHtml({
        letterNo,
        dateOfIssuance: formatNocDateShort(sentAt),
        borrowerName,
        borrowerAddress,
        loanAccountNo: loan.loanAccountNumber,
        agreementDated: formatNocDateLong(loan.disbursedAt),
        productName: 'Personal Loan',
        disbursalDate: formatNocDateShort(loan.disbursedAt),
        loanAmount: formatNocLoanAmountInr(principal),
        nbfcName: 'Aasra Fincorp Private Limited',
        dlaName: 'MoneyCash App',
        dateOfRepayment: formatNocDateLong(repaymentAt),
        dpd: String(overdueDays),
        settlementAmount: 'NA',
        writtenOffAmount: 'NA',
        waiver: formatNocWaiver(waiverInr),
        accountStatus,
        extended: 'No',
        restructured: 'No',
        bureauMaskingAmount: 'NA',
        maskingPaymentDate: 'NA',
        amountReceivedDate: formatNocDateLong(repaymentAt),
      });

      const pdf = await this.htmlPdf.generatePdfFromHtml(html);
      const fileName = `noc-${letterNo}.pdf`;
      const relativePath = this.kycFiles.loanDocumentPdfRelativePath(
        loan.customer.uuid,
        loan.application.uuid,
        fileName,
      );
      await this.kycFiles.writeBytes(relativePath, pdf);

      await this.prisma.client.loanAccount.update({
        where: { id: loan.id },
        data: {
          isNocSent: true,
          nocSentAt: sentAt,
          nocPdfRelativePath: relativePath,
          nocLetterNumber: letterNo,
        },
      });

      const emailTo = loan.application.details?.emailId?.trim();
      if (emailTo) {
        try {
          await this.email.sendNocLetterEmail(
            emailTo,
            [
              {
                filename: `NOC-${letterNo}.pdf`,
                content: pdf,
                contentType: 'application/pdf',
              },
            ],
            { leadId: loan.application.leadId },
          );
        } catch (err) {
          this.logger.error(
            `[noc] Email failed loan=${loan.loanNumber} to=${emailTo}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      } else {
        this.logger.warn(`[noc] No email on application; PDF stored loan=${loan.loanNumber}`);
      }

      this.logger.log(
        `[noc] Sent letterNo=${letterNo} loan=${loan.loanNumber} path=${relativePath}`,
      );
      return true;
    } catch (err) {
      this.logger.error(
        `[noc] Issue failed loanId=${loanAccountId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return false;
    }
  }
}
