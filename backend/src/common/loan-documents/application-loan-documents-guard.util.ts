import { BadRequestException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

export function assertLoanDocumentsReviewedForApplication(
  application: { details?: { loanDocumentsReviewedAt: Date | null } | null } | null | undefined,
): void {
  if (!application?.details?.loanDocumentsReviewedAt) {
    throw new BadRequestException(
      'Review the sanction letter and Key Fact Statement before starting KYC.',
    );
  }
}

/** @deprecated Prefer assertLoanDocumentsReviewedForApplication — OTP acceptance is after references. */
export function assertLoanDocumentsAcceptedForApplication(
  application: { details?: { loanDocumentsReviewedAt: Date | null } | null } | null | undefined,
): void {
  assertLoanDocumentsReviewedForApplication(application);
}

export async function assertActiveApplicationLoanDocumentsAccepted(
  client: PrismaClient,
  params: { leadId: bigint; customerId: bigint },
): Promise<void> {
  const application = await client.application.findFirst({
    where: { leadId: params.leadId, customerId: params.customerId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (!application) {
    assertLoanDocumentsReviewedForApplication(null);
    return;
  }

  // Raw select so this compiles before/after `prisma generate` picks up the new columns.
  const rows = await client.$queryRaw<Array<{ loanDocumentsReviewedAt: Date | null }>>`
    SELECT loan_documents_reviewed_at AS loanDocumentsReviewedAt
    FROM application_detail
    WHERE application_id = ${application.id}
    LIMIT 1
  `;

  assertLoanDocumentsReviewedForApplication({
    details: { loanDocumentsReviewedAt: rows[0]?.loanDocumentsReviewedAt ?? null },
  });
}
