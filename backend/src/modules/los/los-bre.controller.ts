import { BadRequestException, Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { loadBreSettings } from '../../common/bre/bre-settings.loader';
import { BureauReportPdfService } from '../../common/cibil/bureau-report-pdf.service';
import { convertCibilHtmlToVendorJson } from '../../common/cibil/cibil-html-to-json.parser';
import { extractCibilReportData } from '../../common/cibil/cibil-report-data.extractor';
import { PostBreCheckService } from '../../common/bre/post-bre-check.service';
import { PreApprovedOfferDryRunService } from '../../common/bre/pre-approved-offer-dry-run.service';
import { PreBreCheckService } from '../../common/bre/pre-bre-check.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LosAuthGuard } from './auth/los-auth.guard';
import { PostBureauBreCheckDto } from './dto/post-bureau-bre-check.dto';
import { PostBureauBreCheckFromHtmlDto } from './dto/post-bureau-bre-check-from-html.dto';
import { PreApprovedOfferCheckDto } from './dto/pre-approved-offer-check.dto';
import { PreBreCheckDto } from './dto/pre-bre-check.dto';

@ApiTags('LOS BRE')
@Controller('los/bre')
@UseGuards(LosAuthGuard)
export class LosBreController {
  constructor(
    private readonly postBreCheck: PostBreCheckService,
    private readonly preBreCheck: PreBreCheckService,
    private readonly preApprovedOfferDryRun: PreApprovedOfferDryRunService,
    private readonly bureauReportPdf: BureauReportPdfService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('pre-bre-check')
  @ApiOperation({
    summary: 'Dry-run pre-bureau BRE (age, gender, occupation, negative lists)',
  })
  async preBreCheckEndpoint(@Body() body: PreBreCheckDto) {
    const settings = await loadBreSettings(this.prisma);
    const result = await this.preBreCheck.run(
      {
        dateOfBirth: new Date(`${body.dateOfBirth}T00:00:00.000Z`),
        genderId: body.genderId,
        occupationId: body.occupationId,
        genderDisplay: body.genderDisplay ?? null,
        occupationDisplay: body.occupationDisplay ?? null,
        pincode: body.pincode,
        cityId: body.cityId ?? null,
        stateId: body.stateId ?? null,
        cityName: body.cityName ?? null,
        stateCode: body.stateCode ?? null,
      },
      settings,
    );
    return { ...result, thresholds: settings };
  }

  @Post('pre-approved-offer-check')
  @ApiOperation({
    summary: 'Dry-run pre-approved offer from bureau JSON (CIBIL score + credit-limit tier)',
  })
  preApprovedOfferCheck(@Body() body: PreApprovedOfferCheckDto) {
    return this.preApprovedOfferDryRun.evaluateFromBureauPayload(body.bureauPayload);
  }

  @Get('post-bre-rules-catalog')
  @ApiOperation({
    summary: 'Post-BRE rule reference (keys, conditions, live thresholds)',
  })
  postBreRulesCatalog() {
    return this.postBreCheck.getRulesCatalog();
  }

  @Post('post-bureau-check')
  @ApiOperation({
    summary: 'Dry-run post-bureau BRE rules against pasted bureau JSON',
  })
  postBureauCheck(@Body() body: PostBureauBreCheckDto) {
    return this.postBreCheck.evaluateFromBureauPayload({
      rawPayload: body.bureauPayload,
      isExistingCustomer: body.isExistingCustomer ?? false,
      applicantMobile: body.applicantMobile ?? null,
    });
  }

  @Post('post-bureau-check-html')
  @ApiOperation({
    summary: 'Convert CIBIL HTML to bureau JSON and dry-run all post-BRE rules',
  })
  async postBureauCheckFromHtml(@Body() body: PostBureauBreCheckFromHtmlDto) {
    const trimmed = body.html.trim();
    if (!/<html[\s>]/i.test(trimmed) && !/<body[\s>]/i.test(trimmed)) {
      throw new BadRequestException('Upload must be an HTML bureau report (expected <html> or <body>).');
    }

    let bureauPayload: Record<string, unknown>;
    try {
      bureauPayload = convertCibilHtmlToVendorJson(trimmed, body.filename ?? 'upload.html');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'CIBIL HTML parsing failed.';
      throw new BadRequestException(message);
    }

    const result = await this.postBreCheck.evaluateFromBureauPayload({
      rawPayload: bureauPayload,
      isExistingCustomer: body.isExistingCustomer ?? false,
      applicantMobile: body.applicantMobile ?? null,
    });

    return {
      ...result,
      bureauPayload,
      conversion: bureauPayload._meta ?? null,
    };
  }

  @Post('cibil-report-download')
  @ApiOperation({
    summary: 'Generate CIBIL summary PDF from bureau JSON (download only, not saved)',
  })
  @ApiProduces('application/pdf')
  async cibilReportDownload(
    @Body() body: PreApprovedOfferCheckDto,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const pdf = await this.bureauReportPdf.generateEphemeralPdf(body.bureauPayload);
      const filename = this.cibilPdfFilename(body.bureauPayload);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(Buffer.from(pdf));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'CIBIL report PDF generation failed.';
      throw new BadRequestException(message);
    }
  }

  private cibilPdfFilename(vendorBody: unknown): string {
    const report = extractCibilReportData(vendorBody);
    const control = report.controlNumber?.replace(/\D/g, '') ?? '';
    const score = report.cibilScore != null ? String(report.cibilScore) : '';
    const suffix = control || score || String(Date.now());
    return `cibil-report-${suffix}.pdf`;
  }
}
