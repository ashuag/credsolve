import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import {
  KycActiveLivenessService,
  type ActiveLivenessFacePosition,
} from '../../../../common/kyc/kyc-active-liveness.service';
import type { UploadedFileLike } from '../../../../common/types/uploaded-file';

/**
 * Stateless single-frame face-position probe for the customer active-liveness step.
 * Lets the UI confirm the face is inside the guide oval before the challenge run.
 */
@Injectable()
export class CheckKycFacePositionUseCase {
  constructor(private readonly activeLiveness: KycActiveLivenessService) {}

  async execute(
    req: Request,
    frame: UploadedFileLike | undefined,
  ): Promise<ActiveLivenessFacePosition> {
    if (!req.customerSession) {
      throw new UnauthorizedException('Sign in with mobile OTP before continuing.');
    }
    if (!frame?.buffer?.length) {
      throw new BadRequestException('No frame received.');
    }
    return this.activeLiveness.detectFacePosition(frame.buffer);
  }
}
