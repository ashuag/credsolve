import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { EasebuzzWireService } from '../../../common/easebuzz/easebuzz-wire.service';
import type { GetPaymentStatusDto } from '../dto/get-payment-status.dto';

export type GetPaymentStatusDryRunResult = {
  vendor: 'Easebuzz';
  configured: boolean;
  skipReason: string | null;
  retrieveUrl: string | null;
  txnid: string;
  ok: boolean;
  status: string | null;
  amount: string | null;
  easepayid: string | null;
  bankRef: string | null;
  message: string | null;
  vendorBody: unknown | null;
};

/**
 * LOS developer tool: live Easebuzz Transaction V2.1 retrieve.
 * Does not update loan_repayment or loan_account. The vendor call is audited
 * in vendor_api_log (leadId is null).
 */
@Injectable()
export class LosEasebuzzDevToolsService {
  constructor(private readonly easebuzzWire: EasebuzzWireService) {}

  async runGetPaymentStatus(dto: GetPaymentStatusDto): Promise<GetPaymentStatusDryRunResult> {
    const txnid = dto.txnid.trim().slice(0, 40);
    try {
      const txn = await this.easebuzzWire.retrievePayTransaction(txnid, { forceLive: true });
      return {
        vendor: 'Easebuzz',
        configured: true,
        skipReason: null,
        retrieveUrl: txn.retrieveUrl,
        txnid,
        ok: txn.ok,
        status: txn.status,
        amount: txn.amount,
        easepayid: txn.easepayid,
        bankRef: txn.bankRef,
        message: txn.message,
        vendorBody: txn.rawBody,
      };
    } catch (err) {
      if (err instanceof ServiceUnavailableException) {
        const skipReason =
          typeof err.message === 'string' && err.message.trim()
            ? err.message
            : 'Easebuzz Payment Gateway is not configured.';
        return {
          vendor: 'Easebuzz',
          configured: false,
          skipReason,
          retrieveUrl: null,
          txnid,
          ok: false,
          status: null,
          amount: null,
          easepayid: null,
          bankRef: null,
          message: skipReason,
          vendorBody: null,
        };
      }
      throw err;
    }
  }
}
