import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { UploadedFileLike } from '../../common/types/uploaded-file';
import { LosAuthGuard } from './auth/los-auth.guard';
import { LosDenyAgentGuard } from './auth/los-deny-agent.guard';
import { CibilVendorFetchCheckDto } from './dto/cibil-vendor-fetch-check.dto';
import { FaceLivenessCheckDto } from './dto/face-liveness-check.dto';
import { KycFaceMatchCheckDto } from './dto/kyc-face-match-check.dto';
import { ListVendorApiLogsQueryDto } from './dto/list-vendor-api-logs-query.dto';
import { NameMatchFuzzScoreDto } from './dto/name-match-fuzz-score.dto';
import { NsdlPanVerificationDto } from './dto/nsdl-pan-verification.dto';
import { TenacioFaceLivenessCheckDto } from './dto/tenacio-face-liveness-check.dto';
import { TenacioFaceMatchCheckDto } from './dto/tenacio-face-match-check.dto';
import { LosCibilDevToolsService } from './services/los-cibil-dev-tools.service';
import { LosFaceLivenessDevToolsService } from './services/los-face-liveness-dev-tools.service';
import { LosKycDevToolsService } from './services/los-kyc-dev-tools.service';
import { LosNameMatchDevToolsService } from './services/los-name-match-dev-tools.service';
import { LosPanDevToolsService } from './services/los-pan-dev-tools.service';
import { LosTenacioFaceDevToolsService } from './services/los-tenacio-face-dev-tools.service';
import { LosVendorApiLogService } from './services/los-vendor-api-log.service';

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

@ApiTags('LOS Developer Tools')
@Controller(['los/developer-tools', 'los/los/developer-tools'])
@UseGuards(LosAuthGuard, LosDenyAgentGuard)
export class LosDeveloperToolsController {
  constructor(
    private readonly cibilDevTools: LosCibilDevToolsService,
    private readonly kycDevTools: LosKycDevToolsService,
    private readonly faceLivenessDevTools: LosFaceLivenessDevToolsService,
    private readonly panDevTools: LosPanDevToolsService,
    private readonly nameMatchDevTools: LosNameMatchDevToolsService,
    private readonly tenacioFaceDevTools: LosTenacioFaceDevToolsService,
    private readonly vendorApiLogs: LosVendorApiLogService,
  ) {}

  @Get('vendor-api-logs')
  @ApiOperation({
    summary: 'List vendor_api_log rows (paginated, filterable, sortable)',
  })
  listVendorApiLogs(@Query() query: ListVendorApiLogsQueryDto) {
    return this.vendorApiLogs.list(query);
  }

  @Get('vendor-api-logs/:uuid')
  @ApiOperation({ summary: 'Get one vendor_api_log row including request/response payloads' })
  getVendorApiLog(@Param('uuid') uuid: string) {
    return this.vendorApiLogs.getByUuid(uuid);
  }

  @Post('cibil-tenacio-fetch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Live Tenacio CIBIL soft-pull (bypasses the vendor API config switch)',
    description:
      'Calls the Tenacio bureau soft-pull directly using TENACIO_* env config. The call is live and audited in vendor_api_log; no lead or bureau_report record is created or updated.',
  })
  async cibilTenacioFetch(@Body() body: CibilVendorFetchCheckDto) {
    return this.cibilDevTools.runTenacioFetch(body);
  }

  @Post('cibil-surepass-fetch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Live Surepass CIBIL fetch-report (bypasses the vendor API config switch)',
    description:
      'Calls the Surepass credit-report-cibil endpoint directly using SUREPASS_* env config. The response is returned in the Tenacio-shaped envelope; the raw Surepass body is stored in vendor_api_log. No lead or bureau_report record is created or updated.',
  })
  async cibilSurepassFetch(@Body() body: CibilVendorFetchCheckDto) {
    return this.cibilDevTools.runSurepassFetch(body);
  }

  @Post('name-match-fuzz-score')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Dry-run penny-drop name-match fuzzing score',
    description:
      'Computes the same 0–100 fuzzing score used after penny-drop (honorifics stripped, token order ignored). Compares against PENNY_DROP_NAME_MATCH_MIN_SCORE. Does not call a vendor or update any records.',
  })
  async nameMatchFuzzScore(@Body() body: NameMatchFuzzScoreDto) {
    return this.nameMatchDevTools.runFuzzScore(body);
  }

  @Post('nsdl-pan-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Live Tenacio NSDL PAN name/DOB verification',
    description:
      'Calls the Tenacio NSDL PAN endpoint directly using TENACIO_* env config. The call is live and audited in vendor_api_log; no lead or PAN status record is created or updated.',
  })
  async nsdlPanVerification(@Body() body: NsdlPanVerificationDto) {
    return this.panDevTools.runNsdlPanVerification(body);
  }

  @Post('kyc-face-match-check')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'reference', maxCount: 1 },
        { name: 'probe', maxCount: 1 },
      ],
      { limits: { fileSize: MAX_IMAGE_BYTES } },
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Dry-run photo quality + Aadhaar↔selfie face match (local face-api only)',
    description:
      'Validates reference (Aadhaar) and probe (selfie) for blur, full-face visibility, uncovered landmarks, and confidence score, then compares faces with face-api embeddings. No Tenacio calls; does not update application/KYC records.',
  })
  async kycFaceMatchCheck(
    @UploadedFiles()
    files: { reference?: UploadedFileLike[]; probe?: UploadedFileLike[] } | undefined,
    @Body() body: KycFaceMatchCheckDto,
  ) {
    return this.kycDevTools.runFaceMatchCheck({
      reference: files?.reference?.[0],
      probe: files?.probe?.[0],
      referenceUrl: body.referenceUrl,
      probeUrl: body.probeUrl,
    });
  }

  @Post('face-liveness-check')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Live Surepass face-liveness check',
    description:
      'Calls the Surepass face-liveness endpoint directly using SUREPASS_* env config. The call is live and audited in vendor_api_log; no lead or KYC record is created or updated.',
  })
  async faceLivenessCheck(
    @UploadedFile() file: UploadedFileLike | undefined,
    @Body() body: FaceLivenessCheckDto,
  ) {
    return this.faceLivenessDevTools.runFaceLivenessCheck({
      file,
      link: body.link,
      usePdf: body.usePdf,
    });
  }

  @Post('tenacio-face-liveness-check')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Live Tenacio face-liveness check',
    description:
      'Calls the Tenacio liveness endpoint directly using TENACIO_* env config. Tenacio fetches the selfie itself from a public URL — an uploaded file is first pushed to S3 (dev-tools/los-uploads/…) and resolved to a URL; a link is used as-is. The call is live and audited in vendor_api_log; no lead or KYC record is created or updated.',
  })
  async tenacioFaceLivenessCheck(
    @UploadedFile() file: UploadedFileLike | undefined,
    @Body() body: TenacioFaceLivenessCheckDto,
  ) {
    return this.tenacioFaceDevTools.runFaceLivenessCheck(body, file);
  }

  @Post('tenacio-face-match-check')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'file1', maxCount: 1 },
        { name: 'file2', maxCount: 1 },
      ],
      { limits: { fileSize: MAX_IMAGE_BYTES } },
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Live Tenacio face-match check',
    description:
      'Calls the Tenacio face-match endpoint directly using TENACIO_* env config. Tenacio fetches both photos itself from public URLs — uploaded files are first pushed to S3 (dev-tools/los-uploads/…) and resolved to URLs; links are used as-is. The call is live and audited in vendor_api_log; no lead or KYC record is created or updated.',
  })
  async tenacioFaceMatchCheck(
    @UploadedFiles()
    files: { file1?: UploadedFileLike[]; file2?: UploadedFileLike[] } | undefined,
    @Body() body: TenacioFaceMatchCheckDto,
  ) {
    return this.tenacioFaceDevTools.runFaceMatchCheck(body, {
      file1: files?.file1?.[0],
      file2: files?.file2?.[0],
    });
  }
}
