import { BadRequestException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

export function assertLoanDocumentsAcceptedForApplication(
  application: { details?: { loanDocumentsAcceptedAt: Date | null } | null } | null | undefined,
): void {
  if (!application?.details?.loanDocumentsAcceptedAt) {
    throw new BadRequestException(
      'Review and accept the sanction letter and loan agreement (OTP) before starting KYC.',
    );
  }
}

export async function assertActiveApplicationLoanDocumentsAccepted(
  client: PrismaClient,
  params: { leadId: bigint; customerId: bigint },
): Promise<void> {
  const application = await client.application.findFirst({
    where: { leadId: params.leadId, customerId: params.customerId },
    orderBy: { createdAt: 'desc' },
    select: { details: { select: { loanDocumentsAcceptedAt: true } } },
  });
  assertLoanDocumentsAcceptedForApplication(application);
}
