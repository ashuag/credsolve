import { Injectable } from '@nestjs/common';
import { SettingKey } from '../../../common/constants/setting.constants';
import {
  normalizePersonNameForMatch,
  personNamesMatch,
} from '../../../common/kyc/aadhaar-lead-identity-match.util';
import {
  computePersonNameFuzzScore,
  stripPersonNameHonorifics,
} from '../../../common/kyc/person-name-fuzz.util';
import { PrismaService } from '../../../prisma/prisma.service';
import type { NameMatchFuzzScoreDto } from '../dto/name-match-fuzz-score.dto';

export type NameMatchFuzzScoreOutcome = 'auto_pass' | 'under_review' | 'missing_name';

export type NameMatchFuzzScoreResult = {
  customerName: string;
  bankAccountName: string;
  strippedCustomerName: string;
  strippedBankAccountName: string;
  normalizedCustomerName: string;
  normalizedBankAccountName: string;
  tokenMatch: boolean;
  score: number;
  minScore: number;
  autoPass: boolean;
  outcome: NameMatchFuzzScoreOutcome;
  note: string;
};

export function evaluateNameMatchFuzzScore(input: {
  customerName: string;
  bankAccountName: string;
  minScore: number;
}): NameMatchFuzzScoreResult {
  const customerName = input.customerName.trim();
  const bankAccountName = input.bankAccountName.trim();
  const strippedCustomerName = stripPersonNameHonorifics(customerName);
  const strippedBankAccountName = stripPersonNameHonorifics(bankAccountName);
  const normalizedCustomerName = normalizePersonNameForMatch(strippedCustomerName);
  const normalizedBankAccountName = normalizePersonNameForMatch(strippedBankAccountName);
  const minScore = input.minScore;

  if (!normalizedCustomerName || !normalizedBankAccountName) {
    return {
      customerName,
      bankAccountName,
      strippedCustomerName,
      strippedBankAccountName,
      normalizedCustomerName,
      normalizedBankAccountName,
      tokenMatch: false,
      score: 0,
      minScore,
      autoPass: false,
      outcome: 'missing_name',
      note: 'Enter both a customer name and a bank account name.',
    };
  }

  const tokenMatch = personNamesMatch(strippedCustomerName, strippedBankAccountName);
  const score = computePersonNameFuzzScore(customerName, bankAccountName);
  const autoPass = tokenMatch || score >= minScore;

  return {
    customerName,
    bankAccountName,
    strippedCustomerName,
    strippedBankAccountName,
    normalizedCustomerName,
    normalizedBankAccountName,
    tokenMatch,
    score,
    minScore,
    autoPass,
    outcome: autoPass ? 'auto_pass' : 'under_review',
    note: autoPass
      ? tokenMatch
        ? 'Exact token match (order and honorifics ignored). Penny-drop would auto-pass.'
        : `Fuzzing score ${score} meets the max of ${minScore}. Penny-drop would auto-pass.`
      : `Fuzzing score ${score} is below the max of ${minScore}. The application would stay In Review at Bank details until credit approves.`,
  };
}

/**
 * LOS developer tool: dry-run the same name fuzzing score used after penny-drop.
 * Does not call a vendor or update any lead / application records.
 */
@Injectable()
export class LosNameMatchDevToolsService {
  constructor(private readonly prisma: PrismaService) {}

  async runFuzzScore(dto: NameMatchFuzzScoreDto): Promise<NameMatchFuzzScoreResult> {
    const minScore = await this.loadPennyDropNameMatchMinScore();
    return evaluateNameMatchFuzzScore({
      customerName: dto.customerName,
      bankAccountName: dto.bankAccountName,
      minScore,
    });
  }

  private async loadPennyDropNameMatchMinScore(): Promise<number> {
    const row = await this.prisma.client.setting.findFirst({
      where: { key: SettingKey.PENNY_DROP_NAME_MATCH_MIN_SCORE.key, isActive: true },
      select: { value: true },
    });
    const n = row ? Number.parseInt(row.value.trim(), 10) : NaN;
    if (Number.isFinite(n) && n >= 0 && n <= 100) return n;
    return Number.parseInt(SettingKey.PENNY_DROP_NAME_MATCH_MIN_SCORE.default, 10);
  }
}
