import { authorizedLosRequest } from './_shared';

export type LosNameMatchFuzzScoreInput = {
  customerName: string;
  bankAccountName: string;
};

export type LosNameMatchFuzzScoreResult = {
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
  outcome: 'auto_pass' | 'under_review' | 'missing_name';
  note: string;
};

/** Dry-run penny-drop name-match fuzzing score (developer tool; does not update a lead). */
export async function runNameMatchFuzzScore(
  token: string,
  input: LosNameMatchFuzzScoreInput,
): Promise<LosNameMatchFuzzScoreResult> {
  return authorizedLosRequest<LosNameMatchFuzzScoreResult>(
    token,
    '/developer-tools/name-match-fuzz-score',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    'Name match fuzzing score failed.',
  );
}
