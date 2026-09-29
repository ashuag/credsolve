import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { Request, Response } from 'express';
import { LosAuthGuard } from './auth/los-auth.guard';
import { LosDenyAgentGuard } from './auth/los-deny-agent.guard';
import { LosAdminGuard } from './auth/los-admin.guard';
import type { LosSessionPayload } from './auth/los-session.service';
import { RejectWorkspaceRecordDto } from './dto/reject-workspace-record.dto';
import { WaiveLoanChargesDto } from './dto/waive-loan-charges.dto';
import { LosLeadService } from './services/los-lead.service';
import { LosApplicationService } from './services/los-application.service';
import { LosPennyDropRecheckService } from './services/los-penny-drop-recheck.service';
import { LosCustomerService } from './services/los-customer.service';
import { LosDashboardService } from './services/los-dashboard.service';
import { LosMasterService } from './services/los-master.service';
import { LosRejectionService } from './services/los-rejection.service';
import { LosDisbursementService } from './services/los-disbursement.service';
import { LosLoanService } from './services/los-loan.service';
import { LosLoanRepaymentSyncService } from './services/los-loan-repayment-sync.service';
import { LosBureauReportService } from './services/los-bureau-report.service';
import { LosLeadReportService } from './services/los-lead-report.service';
import { LosTransactionReportService } from './services/los-transaction-report.service';
import { LosCheckCibilService } from './services/los-check-cibil.service';
import {
  buildFilteredExportFilename,
  cleanExportFilterValue,
  joinExportFilterSummary,
} from '../../common/xlsx/export-filename.util';

type LosRequest = Request & { losUser: LosSessionPayload };

/**
 * Mirrors the LOS Loans table's column filters (same keys as the table's column `key`s) so the
 * export can push the exact same filter the user applied down into the Prisma query — no per-row
 * data (e.g. a UUID list) travels from the browser, which matters at production loan volumes.
 */
export class ExportLoansQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  loan?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  borrower?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  grade?: string;

  /** Comma-separated `NEW`/`RECURRING`. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  customerType?: string;

  /** YYYY-MM-DD */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  repayBy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: string;

  /** YYYY-MM-DD */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  disbursed?: string;

  /** Only used by the export endpoint (download link can't set an Authorization header); ignored otherwise. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  access_token?: string;
}

/** Builds the "(grade A, status Overdue)" part of the export filename from the applied filters. */
function describeLoansExportFilters(query: ExportLoansQueryDto): string | null {
  return joinExportFilterSummary([
    query.loan ? `loan ${cleanExportFilterValue(query.loan)}` : null,
    query.borrower ? `borrower ${cleanExportFilterValue(query.borrower)}` : null,
    query.grade ? `grade ${cleanExportFilterValue(query.grade, 1)?.toUpperCase()}` : null,
    query.customerType ? `customer type ${cleanExportFilterValue(query.customerType, 40)}` : null,
    query.repayBy ? `repay by ${cleanExportFilterValue(query.repayBy, 10)}` : null,
    query.status ? `status ${cleanExportFilterValue(query.status)}` : null,
    query.disbursed ? `disbursed ${cleanExportFilterValue(query.disbursed, 10)}` : null,
  ]);
}

/**
 * Mirrors the LOS Applications table's own column filters (same keys as the table's column `key`s),
 * including the hyphenated `app-id` key, so the export can push the same filter the user applied
 * down into the Prisma query.
 */
export class ExportApplicationsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  'app-id'?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  mobile?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  cibil?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  grade?: string;

  /** Comma-separated `NEW`/`RECURRING`. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  customerType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  loan?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  stage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reason?: string;

  /** YYYY-MM-DD */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  created?: string;

  /** YYYY-MM-DD */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  modified?: string;

  /** Only used by the export endpoint (download link can't set an Authorization header); ignored otherwise. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  access_token?: string;
}

/** Builds the export filename's filter summary from the LOS Applications table's applied filters. */
function describeApplicationsExportFilters(query: ExportApplicationsQueryDto): string | null {
  return joinExportFilterSummary([
    query['app-id'] ? `app ${cleanExportFilterValue(query['app-id'])}` : null,
    query.name ? `name ${cleanExportFilterValue(query.name)}` : null,
    query.mobile ? `mobile ${cleanExportFilterValue(query.mobile)}` : null,
    query.email ? `email ${cleanExportFilterValue(query.email)}` : null,
    query.cibil ? `cibil ${cleanExportFilterValue(query.cibil, 6)}` : null,
    query.grade ? `grade ${cleanExportFilterValue(query.grade, 1)?.toUpperCase()}` : null,
    query.customerType ? `customer type ${cleanExportFilterValue(query.customerType, 40)}` : null,
    query.loan ? `loan ${cleanExportFilterValue(query.loan, 12)}` : null,
    query.stage ? `stage ${cleanExportFilterValue(query.stage)}` : null,
    query.status ? `status ${cleanExportFilterValue(query.status)}` : null,
    query.reason ? `reason ${cleanExportFilterValue(query.reason)}` : null,
    query.created ? `created ${cleanExportFilterValue(query.created, 10)}` : null,
    query.modified ? `modified ${cleanExportFilterValue(query.modified, 10)}` : null,
  ]);
}

/**
 * Mirrors the LOS Leads table's own column filters (same keys as the table's column `key`s,
 * including hyphenated keys like `lead-id`).
 */
export class ExportLeadsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  'lead-id'?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  customer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  'pan-number'?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  mobile?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  occupation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  cibil?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4)
  'pan-verified'?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string;

  /** YYYY-MM-DD */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  created?: string;

  /** Only used by the export endpoint (download link can't set an Authorization header); ignored otherwise. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  access_token?: string;
}

/** Builds the export filename's filter summary from the LOS Leads table's applied filters. */
function describeLeadsExportFilters(query: ExportLeadsQueryDto): string | null {
  return joinExportFilterSummary([
    query['lead-id'] ? `lead ${cleanExportFilterValue(query['lead-id'])}` : null,
    query.customer ? `customer ${cleanExportFilterValue(query.customer)}` : null,
    query['pan-number'] ? `pan ${cleanExportFilterValue(query['pan-number'])}` : null,
    query.mobile ? `mobile ${cleanExportFilterValue(query.mobile)}` : null,
    query.occupation ? `occupation ${cleanExportFilterValue(query.occupation)}` : null,
    query.city ? `city ${cleanExportFilterValue(query.city)}` : null,
    query.cibil ? `cibil ${cleanExportFilterValue(query.cibil, 6)}` : null,
    query['pan-verified'] ? `pan status ${cleanExportFilterValue(query['pan-verified'], 4)}` : null,
    query.status ? `status ${cleanExportFilterValue(query.status)}` : null,
    query.reason ? `reason ${cleanExportFilterValue(query.reason)}` : null,
    query.source ? `source ${cleanExportFilterValue(query.source)}` : null,
    query.created ? `created ${cleanExportFilterValue(query.created, 10)}` : null,
  ]);
}

/**
 * Mirrors the LOS Bureau Report table's own column filters. `cibil` and `fetched` carry the raw
 * serialized value from the table's `number-range` / `datetime-range` filter controls (a
 * `min|max` pair and an ISO `from|to` pair respectively); `grade` is a comma-separated multi-select.
 * This endpoint is called via an authenticated `fetch` (Bearer header), not a plain download link,
 * so — unlike the other export DTOs — it takes no `access_token` field.
 */
export class ExportBureauReportsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  lead?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  customer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  mobile?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  pan?: string;

  /** `min|max`, either side optional. */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  cibil?: string;

  /** Comma-separated grades, e.g. `A,B,C`. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  grade?: string;

  /** `live` or `dummy`. */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  source?: string;

  /** Comma-separated `NEW`/`RECURRING`. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  customerType?: string;

  /** `YYYY-MM-DDTHH:mm|YYYY-MM-DDTHH:mm` (IST wall-clock). */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  fetched?: string;
}

/** Builds the export filename's filter summary from the LOS Bureau Report table's applied filters. */
function describeBureauReportsExportFilters(query: ExportBureauReportsQueryDto): string | null {
  return joinExportFilterSummary([
    query.lead ? `lead ${cleanExportFilterValue(query.lead)}` : null,
    query.customer ? `customer ${cleanExportFilterValue(query.customer)}` : null,
    query.mobile ? `mobile ${cleanExportFilterValue(query.mobile)}` : null,
    query.pan ? `pan ${cleanExportFilterValue(query.pan)}` : null,
    query.cibil ? `cibil ${cleanExportFilterValue(query.cibil, 20)}` : null,
    query.grade ? `grade ${cleanExportFilterValue(query.grade, 20)?.toUpperCase()}` : null,
    query.source ? `source ${cleanExportFilterValue(query.source, 10)}` : null,
    query.customerType ? `customer type ${cleanExportFilterValue(query.customerType, 40)}` : null,
    query.fetched ? `fetched ${cleanExportFilterValue(query.fetched, 40)}` : null,
  ]);
}

/**
 * Mirrors the LOS Lead Report table's own column filters. `city`/`state`/`purpose`/`grade`/
 * `leadStatus`/`applicationStatus`/`loanStatus`/`repaymentStatus` are comma-separated multi-select
 * values (`__none__` selects rows with no value); `offerAmount`/`selectedAmount`/`cibil` are
 * `min|max` range values; `created` is an ISO `from|to` datetime range; `dob` is `YYYY-MM-DD`.
 * This endpoint is called via an authenticated `fetch` (Bearer header), so it takes no
 * `access_token` field.
 */
export class ExportLeadReportsQueryDto {
  @IsOptional() @IsString() @MaxLength(60) lead?: string;
  @IsOptional() @IsString() @MaxLength(120) customer?: string;
  @IsOptional() @IsString() @MaxLength(20) mobile?: string;
  @IsOptional() @IsString() @MaxLength(20) pan?: string;
  @IsOptional() @IsString() @MaxLength(10) dob?: string;
  @IsOptional() @IsString() @MaxLength(300) city?: string;
  @IsOptional() @IsString() @MaxLength(300) state?: string;
  @IsOptional() @IsString() @MaxLength(300) purpose?: string;
  @IsOptional() @IsString() @MaxLength(20) offerAmount?: string;
  @IsOptional() @IsString() @MaxLength(20) selectedAmount?: string;
  @IsOptional() @IsString() @MaxLength(20) cibil?: string;
  @IsOptional() @IsString() @MaxLength(40) grade?: string;
  @IsOptional() @IsString() @MaxLength(40) customerType?: string;
  @IsOptional() @IsString() @MaxLength(200) leadStatus?: string;
  @IsOptional() @IsString() @MaxLength(120) reason?: string;
  @IsOptional() @IsString() @MaxLength(100) utmSource?: string;
  @IsOptional() @IsString() @MaxLength(100) utmMedium?: string;
  @IsOptional() @IsString() @MaxLength(100) utmCampaign?: string;
  @IsOptional() @IsString() @MaxLength(100) utmTerm?: string;
  @IsOptional() @IsString() @MaxLength(100) utmContent?: string;
  @IsOptional() @IsString() @MaxLength(200) applicationStatus?: string;
  @IsOptional() @IsString() @MaxLength(200) loanStatus?: string;
  @IsOptional() @IsString() @MaxLength(200) repaymentStatus?: string;
  @IsOptional() @IsString() @MaxLength(40) created?: string;
}

/** Builds the export filename's filter summary from the LOS Lead Report table's applied filters. */
function describeLeadReportsExportFilters(query: ExportLeadReportsQueryDto): string | null {
  return joinExportFilterSummary(
    Object.entries(query).map(([key, value]) =>
      value ? `${key} ${cleanExportFilterValue(value, 60)}` : null,
    ),
  );
}

/**
 * Mirrors the LOS Transaction Report table's own column filters. `disbursedAt`/`repaymentAt` are
 * ISO `from|to` datetime range values; `dob`/`dueDate` are `YYYY-MM-DD`; the rest are plain
 * text/number filters. This endpoint is called via an authenticated `fetch` (Bearer header), so it
 * takes no `access_token` field.
 */
export class ExportTransactionReportsQueryDto {
  @IsOptional() @IsString() @MaxLength(60) transaction?: string;
  @IsOptional() @IsString() @MaxLength(20) application?: string;
  @IsOptional() @IsString() @MaxLength(120) customer?: string;
  @IsOptional() @IsString() @MaxLength(20) mobile?: string;
  @IsOptional() @IsString() @MaxLength(120) email?: string;
  @IsOptional() @IsString() @MaxLength(10) dob?: string;
  @IsOptional() @IsString() @MaxLength(20) pan?: string;
  @IsOptional() @IsString() @MaxLength(40) disbursedAt?: string;
  @IsOptional() @IsString() @MaxLength(20) disbursedAmount?: string;
  @IsOptional() @IsString() @MaxLength(20) interestReceived?: string;
  @IsOptional() @IsString() @MaxLength(20) interestRate?: string;
  @IsOptional() @IsString() @MaxLength(20) processingFeePercent?: string;
  @IsOptional() @IsString() @MaxLength(20) processingFeeAmount?: string;
  @IsOptional() @IsString() @MaxLength(20) gstOnPfPercent?: string;
  @IsOptional() @IsString() @MaxLength(20) gstAmount?: string;
  @IsOptional() @IsString() @MaxLength(10) dueDate?: string;
  @IsOptional() @IsString() @MaxLength(40) repaymentAt?: string;
  @IsOptional() @IsString() @MaxLength(10) daysExceeded?: string;
  @IsOptional() @IsString() @MaxLength(20) penalCharges?: string;
}

/** Builds the export filename's filter summary from the LOS Transaction Report table's applied filters. */
function describeTransactionReportsExportFilters(query: ExportTransactionReportsQueryDto): string | null {
  return joinExportFilterSummary(
    Object.entries(query).map(([key, value]) =>
      value ? `${key} ${cleanExportFilterValue(value, 60)}` : null,
    ),
  );
}

@ApiTags('LOS Data')
@Controller('los')
@UseGuards(LosAuthGuard)
export class LosDataController {
  constructor(
    private readonly losLead: LosLeadService,
    private readonly losApplication: LosApplicationService,
    private readonly losPennyDropRecheck: LosPennyDropRecheckService,
    private readonly losCustomer: LosCustomerService,
    private readonly losDashboard: LosDashboardService,
    private readonly losMaster: LosMasterService,
    private readonly losRejection: LosRejectionService,
    private readonly losDisbursement: LosDisbursementService,
    private readonly losLoan: LosLoanService,
    private readonly losLoanRepaymentSync: LosLoanRepaymentSyncService,
    private readonly losBureauReport: LosBureauReportService,
    private readonly losLeadReport: LosLeadReportService,
    private readonly losTransactionReport: LosTransactionReportService,
    private readonly losCheckCibil: LosCheckCibilService,
  ) {}

  @Get('dashboard/crm')
  @ApiOperation({ summary: 'LOS CRM dashboard aggregates (live counts from the book)' })
  dashboardCrm() {
    return this.losDashboard.getDashboardCrm();
  }

  @Get('bureau-reports')
  @UseGuards(LosDenyAgentGuard)
  @ApiOperation({ summary: 'List stored CIBIL bureau reports for LOS Reports' })
  bureauReports() {
    return this.losBureauReport.listBureauReports();
  }

  @Get('bureau-reports/export')
  @UseGuards(LosDenyAgentGuard)
  @ApiOperation({
    summary: 'Download filtered stored CIBIL bureau reports as a Credit Assessment data workbook (.xlsx)',
    description:
      'Requires at least one filter (lead, customer, mobile, PAN, CIBIL range, grade, source, or a fetched date/time range) to avoid an unbounded dump — the button stays disabled until a filter matches at least one report.',
  })
  async bureauReportsExport(
    @Query() query: ExportBureauReportsQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const filename = buildFilteredExportFilename(
      'Credit Assessment data',
      describeBureauReportsExportFilters(query),
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    await this.losBureauReport.exportBureauReportsWorkbook(query, res);
  }

  @Get('lead-reports')
  @UseGuards(LosDenyAgentGuard)
  @ApiOperation({ summary: 'List leads with application, loan, and repayment status for LOS Reports' })
  leadReports() {
    return this.losLeadReport.listLeadReports();
  }

  @Get('lead-reports/export')
  @UseGuards(LosDenyAgentGuard)
  @ApiOperation({
    summary: 'Download the filtered lead report as an Excel workbook (.xlsx)',
    description:
      'Requires at least one filter to avoid an unbounded dump — the button stays disabled until a filter matches at least one row.',
  })
  async leadReportsExport(
    @Query() query: ExportLeadReportsQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const filename = buildFilteredExportFilename(
      'Lead report',
      describeLeadReportsExportFilters(query),
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    await this.losLeadReport.exportLeadReportsWorkbook(query, res);
  }

  @Get('lead-reports/:leadUuid')
  @UseGuards(LosDenyAgentGuard)
  @ApiOperation({ summary: 'Lead report detail: profile, offer, loan, and repayment status' })
  leadReportByUuid(@Param('leadUuid') leadUuid: string) {
    return this.losLeadReport.getLeadReportDetails(leadUuid);
  }

  @Get('transaction-reports')
  @UseGuards(LosDenyAgentGuard)
  @ApiOperation({
    summary: 'List disbursed-loan transactions with fees, repayment, and penal charges for LOS Reports',
  })
  transactionReports() {
    return this.losTransactionReport.listTransactionReports();
  }

  @Get('transaction-reports/export')
  @UseGuards(LosDenyAgentGuard)
  @ApiOperation({
    summary: 'Download the filtered transaction report as an Excel workbook (.xlsx)',
    description:
      'Requires at least one filter to avoid an unbounded dump — the button stays disabled until a filter matches at least one row.',
  })
  async transactionReportsExport(
    @Query() query: ExportTransactionReportsQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const filename = buildFilteredExportFilename(
      'Transaction report',
      describeTransactionReportsExportFilters(query),
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    await this.losTransactionReport.exportTransactionReportsWorkbook(query, res);
  }

  @Get('leads/new')
  @ApiOperation({
    summary: 'List open leads for LOS lead management (excludes CONVERTED leads with an application)',
  })
  leads() {
    return this.losLead.listLeads();
  }

  @Get('leads/export')
  @ApiOperation({
    summary: 'Download filtered LOS leads as an Excel dump workbook (.xlsx)',
    description:
      'Requires at least one filter (lead id, customer, PAN, mobile, occupation, city, CIBIL, PAN status, status, rejection reason, source, or a created date) to avoid an unbounded dump — the button stays disabled until a filter matches at least one lead.',
  })
  async leadsExport(@Query() query: ExportLeadsQueryDto, @Res() res: Response): Promise<void> {
    const filename = buildFilteredExportFilename('Leads dump', describeLeadsExportFilters(query));
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    await this.losLead.exportLeadsWorkbook(query, res);
  }

  @Get('applications')
  @ApiOperation({ summary: 'List applications for LOS application management' })
  applications() {
    return this.losApplication.listApplications();
  }

  @Get('applications/export')
  @ApiOperation({
    summary: 'Download filtered LOS applications as an Excel dump workbook (.xlsx)',
    description:
      'Requires at least one filter (app id, name, mobile, email, CIBIL, grade, loan amount, stage, status, rejection reason, or a created/modified date) to avoid an unbounded dump — the button stays disabled until a filter matches at least one application.',
  })
  async applicationsExport(
    @Query() query: ExportApplicationsQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const filename = buildFilteredExportFilename(
      'Applications dump',
      describeApplicationsExportFilters(query),
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    await this.losApplication.exportApplicationsWorkbook(query, res);
  }

  @Get('loans')
  @ApiOperation({ summary: 'List disbursed loans for LOS loan management' })
  loans() {
    return this.losLoan.listLoans();
  }

  @Get('loans/export')
  @ApiOperation({
    summary: 'Download filtered LOS loans as an Excel dump workbook (.xlsx)',
    description:
      'Requires at least one filter (loan/application number, borrower, grade, status, or a repay-by/disbursed date) to avoid an unbounded dump — the button stays disabled until a filter matches at least one loan.',
  })
  async loansExport(@Query() query: ExportLoansQueryDto, @Res() res: Response): Promise<void> {
    const filename = buildFilteredExportFilename('Loans dump', describeLoansExportFilters(query));
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    await this.losLoan.exportLoansWorkbook(query, res);
  }

  @Get('loans/:loanUuid')
  @ApiOperation({ summary: 'Get loan details by loan uuid' })
  loanByUuid(@Param('loanUuid') loanUuid: string) {
    return this.losLoan.getLoanDetails(loanUuid);
  }

  @Post('loans/:loanUuid/refresh-payment')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LosDenyAgentGuard)
  @ApiOperation({
    summary: 'Refresh Easebuzz repayment status for an open loan',
    description:
      'Retrieves Easebuzz Transaction V2.1 status for Pay Now and EasyCollect txnids (including the loan/application number) and records a successful repayment (closes the loan when remaining is zero).',
  })
  refreshLoanPayment(@Param('loanUuid') loanUuid: string) {
    return this.losLoanRepaymentSync.refreshPayment(loanUuid);
  }

  @Get('loans/:loanUuid/noc')
  @ApiOperation({ summary: 'Stream the sent NOC / loan-closure PDF for a loan (LOS auth)' })
  async loanNocPdf(@Param('loanUuid') loanUuid: string, @Res() res: Response): Promise<void> {
    await this.losLoan.serveNocPdf(loanUuid, res);
  }

  @Post('loans/:loanUuid/noc/send')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LosAdminGuard)
  @ApiOperation({
    summary: 'Generate and email the NOC / closure letter for a fully repaid loan',
    description:
      'Admin role only. Allowed when the loan is CLOSED or SETTLED and NOC has not been sent yet. Idempotent if already sent.',
  })
  sendLoanNoc(@Param('loanUuid') loanUuid: string) {
    return this.losLoan.sendNocLetter(loanUuid);
  }

  @Post('loans/:loanUuid/waive-charges')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LosAdminGuard)
  @ApiOperation({
    summary: 'Waive part or all of penal + overdue-days interest on an open loan',
    description:
      'Stores the waived amount, the LOS user who waived it, and the timestamp. Pay Now then collects principal + tenure interest + any remaining negotiable charges. Admin role only.',
  })
  waiveLoanCharges(
    @Req() req: LosRequest,
    @Param('loanUuid') loanUuid: string,
    @Body() body: WaiveLoanChargesDto,
  ) {
    return this.losLoan.waiveCharges(loanUuid, body.waivedAmountInr, req.losUser.userId);
  }

  @Get('applications/:applicationUuid')
  @ApiOperation({ summary: 'Get application details by application uuid' })
  applicationByUuid(@Param('applicationUuid') applicationUuid: string) {
    return this.losApplication.getApplicationDetails(applicationUuid);
  }

  @Post('applications/:applicationUuid/reject')
  @UseGuards(LosDenyAgentGuard)
  @ApiOperation({ summary: 'Reject an application with reason and ops note (LOS auth)' })
  rejectApplication(@Param('applicationUuid') applicationUuid: string, @Body() body: RejectWorkspaceRecordDto) {
    return this.losRejection.rejectApplication(applicationUuid, body);
  }

  @Post('applications/:applicationUuid/restart-journey')
  @UseGuards(LosAdminGuard)
  @ApiOperation({
    summary:
      'Admin: start a new customer journey from a rejected application’s lead, copying profile/PAN where possible',
  })
  restartApplicationJourney(@Param('applicationUuid') applicationUuid: string) {
    return this.losLead.restartRejectedJourneyFromApplication(applicationUuid);
  }

  @Post('applications/:applicationUuid/mark-internal-testing')
  @UseGuards(LosDenyAgentGuard)
  @ApiOperation({
    summary: 'Hide an application (and its lead) from LOS listings and data dumps as internal testing',
  })
  markApplicationInternalTesting(@Param('applicationUuid') applicationUuid: string) {
    return this.losApplication.markInternalTesting(applicationUuid);
  }

  @Post('applications/:applicationUuid/bank/approve-name-match')
  @UseGuards(LosDenyAgentGuard)
  @ApiOperation({
    summary:
      'Credit: accept a penny-drop bank account whose name did not auto-pass the fuzzing score. Application stays In Review; the customer can continue to the next step.',
  })
  approveBankNameMatch(@Param('applicationUuid') applicationUuid: string) {
    return this.losApplication.approveBankNameMatch(applicationUuid);
  }

  @Post('applications/:applicationUuid/kyc/approve-aadhaar-name-match')
  @UseGuards(LosDenyAgentGuard)
  @ApiOperation({
    summary:
      'Credit: accept DigiLocker Aadhaar whose name did not match the application. Customer journey stays open; application can be approved after remaining steps.',
  })
  approveAadhaarNameMatch(@Param('applicationUuid') applicationUuid: string) {
    return this.losApplication.approveAadhaarNameMatch(applicationUuid);
  }

  @Post('applications/:applicationUuid/approve')
  @UseGuards(LosDenyAgentGuard)
  @ApiOperation({
    summary: 'Approve an application after the customer journey is complete (status → APPROVED)',
  })
  approveApplication(@Param('applicationUuid') applicationUuid: string) {
    return this.losDisbursement.approveApplication(applicationUuid);
  }

  @Post('applications/:applicationUuid/disburse')
  @UseGuards(LosDenyAgentGuard)
  @ApiOperation({
    summary:
      'Disburse an APPROVED application: one Easebuzz IMPS payout. Loan is created and status becomes DISBURSED only when Easebuzz reports Success. Accepted, In Process, Pending, and Unapproved become DISBURSAL_INPROCESS.',
  })
  disburseApplication(@Param('applicationUuid') applicationUuid: string) {
    return this.losDisbursement.disburseApplication(applicationUuid);
  }

  @Post('applications/:applicationUuid/check-disbursement-status')
  @UseGuards(LosDenyAgentGuard)
  @ApiOperation({
    summary:
      'Poll Easebuzz GET /transfers/{unique_request_number}/ for a DISBURSAL_INPROCESS application. Success disburses the loan; Reversed, Cancelled, Failure, and Rejected set DISBURSAL_FAILED.',
  })
  checkApplicationDisbursementStatus(@Param('applicationUuid') applicationUuid: string) {
    return this.losDisbursement.checkDisbursementStatus(applicationUuid);
  }

  @Post('applications/:applicationUuid/kyc/enable-re-kyc')
  @UseGuards(LosDenyAgentGuard)
  @ApiOperation({
    summary:
      'Enable re-KYC selfie: reset selfie / liveness so the customer can retake the face step (DigiLocker Aadhaar is kept if already captured)',
  })
  enableReKyc(@Param('applicationUuid') applicationUuid: string) {
    return this.losApplication.enableReKyc(applicationUuid);
  }

  @Post('applications/:applicationUuid/kyc/enable-aadhaar-reattempt')
  @UseGuards(LosDenyAgentGuard)
  @ApiOperation({
    summary:
      'Reset Aadhaar OTP / DigiLocker attempts so the customer can start Aadhaar OTP KYC again',
  })
  enableAadhaarReattempt(@Param('applicationUuid') applicationUuid: string) {
    return this.losApplication.enableAadhaarReattempt(applicationUuid);
  }

  @Post('applications/:applicationUuid/bank/grant-penny-drop-attempt')
  @UseGuards(LosDenyAgentGuard)
  @ApiOperation({
    summary:
      'Grant one more penny-drop (bank verification) attempt when the customer has used the configured maximum',
  })
  grantPennyDropAttempt(@Param('applicationUuid') applicationUuid: string) {
    return this.losApplication.grantPennyDropAttempt(applicationUuid);
  }

  @Post('applications/:applicationUuid/bank/recheck-penny-drop')
  @UseGuards(LosDenyAgentGuard)
  @ApiOperation({
    summary:
      'Re-run penny drop on the last submitted bank account. Does not use a customer attempt.',
  })
  recheckPennyDrop(@Param('applicationUuid') applicationUuid: string) {
    return this.losPennyDropRecheck.recheck(applicationUuid);
  }

  @Get('applications/:applicationUuid/kyc/selfie-photo')
  @ApiOperation({ summary: 'Stream customer selfie for an application (LOS auth)' })
  async applicationSelfiePhoto(
    @Param('applicationUuid') applicationUuid: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.losApplication.serveApplicationSelfiePhoto(applicationUuid, res);
  }

  @Get('applications/:applicationUuid/kyc/aadhaar-photo')
  @ApiOperation({ summary: 'Stream DigiLocker Aadhaar photo for an application (LOS auth)' })
  async applicationAadhaarPhoto(
    @Param('applicationUuid') applicationUuid: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.losApplication.serveApplicationAadhaarPhoto(applicationUuid, res);
  }

  @Get('applications/:applicationUuid/kyc/liveness-video')
  @ApiOperation({ summary: 'Stream customer active-liveness short video for an application (LOS auth)' })
  async applicationLivenessVideo(
    @Param('applicationUuid') applicationUuid: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.losApplication.serveApplicationLivenessVideo(applicationUuid, res);
  }

  @Get('applications/:applicationUuid/cibil-report/pdf')
  @ApiOperation({ summary: 'Stream CIBIL summary PDF for an application (LOS auth)' })
  async applicationCibilReportPdf(
    @Param('applicationUuid') applicationUuid: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.losApplication.serveApplicationCibilReportPdf(applicationUuid, res);
  }

  @Get('applications/:applicationUuid/cibil-report')
  @ApiOperation({
    summary: 'Structured CIBIL report view for an application (from latest bureau pull)',
  })
  applicationCibilReport(@Param('applicationUuid') applicationUuid: string) {
    return this.losApplication.getApplicationCibilReport(applicationUuid);
  }

  @Get('customers')
  @ApiOperation({ summary: 'List customers for LOS customer management' })
  customers() {
    return this.losCustomer.listCustomers();
  }

  @Get('customers/:customerUuid')
  @ApiOperation({ summary: 'Get customer details with leads and applications' })
  customerByUuid(@Param('customerUuid') customerUuid: string) {
    return this.losCustomer.getCustomerDetails(customerUuid);
  }

  @Get('leads/:leadUuid/cibil-report/pdf')
  @ApiOperation({ summary: 'Stream CIBIL summary PDF for a lead (LOS auth)' })
  async leadCibilReportPdf(
    @Param('leadUuid') leadUuid: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.losLead.serveLeadCibilReportPdf(leadUuid, res);
  }

  @Get('leads/:leadUuid/cibil-report')
  @ApiOperation({ summary: 'Structured CIBIL report view for a lead (from latest bureau pull)' })
  leadCibilReport(@Param('leadUuid') leadUuid: string) {
    return this.losLead.getLeadCibilReport(leadUuid);
  }

  @Get('leads/:leadUuid/cibil-hits')
  @ApiOperation({ summary: 'CIBIL / bureau hit log for a lead (vendor pulls and stored reports)' })
  leadCibilHits(@Param('leadUuid') leadUuid: string) {
    return this.losCheckCibil.listHitsForLeadUuid(leadUuid);
  }

  @Post('leads/:leadUuid/check-cibil')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LosDenyAgentGuard)
  @ApiOperation({
    summary: 'Pull CIBIL, run post-BRE, and reject the lead when any post-BRE rule fails',
  })
  checkLeadCibil(@Param('leadUuid') leadUuid: string) {
    return this.losCheckCibil.checkForLead(leadUuid);
  }

  @Get('applications/:applicationUuid/cibil-hits')
  @ApiOperation({ summary: 'CIBIL / bureau hit log for an application lead' })
  applicationCibilHits(@Param('applicationUuid') applicationUuid: string) {
    return this.losCheckCibil.listHitsForApplication(applicationUuid);
  }

  @Post('applications/:applicationUuid/check-cibil')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LosDenyAgentGuard)
  @ApiOperation({
    summary: 'Pull CIBIL for the application lead, run post-BRE, and reject when post-BRE fails',
  })
  checkApplicationCibil(@Param('applicationUuid') applicationUuid: string) {
    return this.losCheckCibil.checkForApplication(applicationUuid);
  }

  @Get('leads/:leadUuid')
  @ApiOperation({ summary: 'Get lead details by lead uuid' })
  leadByUuid(@Param('leadUuid') leadUuid: string) {
    return this.losLead.getLeadDetails(leadUuid);
  }

  @Post('leads/:leadUuid/reject')
  @ApiOperation({ summary: 'Reject a lead with reason and ops note (LOS auth)' })
  rejectLead(@Param('leadUuid') leadUuid: string, @Body() body: RejectWorkspaceRecordDto) {
    return this.losRejection.rejectLead(leadUuid, body);
  }

  @Post('leads/:leadUuid/restart-journey')
  @UseGuards(LosAdminGuard)
  @ApiOperation({
    summary: 'Admin: start a new customer journey from a rejected lead, copying profile/PAN where possible',
  })
  restartLeadJourney(@Param('leadUuid') leadUuid: string) {
    return this.losLead.restartRejectedJourney(leadUuid);
  }

  @Post('leads/:leadUuid/mark-internal-testing')
  @UseGuards(LosDenyAgentGuard)
  @ApiOperation({ summary: 'Hide a lead from LOS listings and data dumps as internal testing' })
  markLeadInternalTesting(@Param('leadUuid') leadUuid: string) {
    return this.losLead.markInternalTesting(leadUuid);
  }

  @Get('masters')
  @ApiOperation({ summary: 'Fetch LOS masters for filters/lookups' })
  masters() {
    return this.losMaster.getMasters();
  }

  @Get('applications/:applicationUuid/loan-documents/:docType')
  @ApiOperation({ summary: 'Stream a generated loan document PDF (LOS auth)' })
  async applicationLoanDocument(
    @Param('applicationUuid') applicationUuid: string,
    @Param('docType') docType: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.losApplication.serveApplicationLoanDocument(applicationUuid, docType, res);
  }

  @Post('applications/:applicationUuid/loan-documents/generate')
  @ApiOperation({ summary: 'Generate (or regenerate) loan document PDFs for an application (LOS auth)' })
  generateLoanDocuments(@Param('applicationUuid') applicationUuid: string) {
    return this.losApplication.generateLoanDocuments(applicationUuid);
  }
}
