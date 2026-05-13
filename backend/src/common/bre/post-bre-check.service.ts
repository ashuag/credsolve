import { Injectable } from '@nestjs/common';

export interface PostBreCheckInput {
  leadId: bigint;
}

export interface PostBreCheckResult {
  passed: boolean;
  rejectReason: string | null;
}

/**
 * Rules applied after a successful bureau pull (Tenacio soft-pull, etc.).
 * Stub: always passes until bureau-driven rules are implemented.
 */
@Injectable()
export class PostBreCheckService {
  async run(_input: PostBreCheckInput): Promise<PostBreCheckResult> {
    return { passed: true, rejectReason: null };
  }
}
