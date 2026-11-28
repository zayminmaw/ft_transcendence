import { Body, Controller, Get, Header, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import { requestMeta } from '../../common/context/request-meta';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceClientsQueryDto } from './dto/invoice-clients-query.dto';
import { InvoiceExportQueryDto, InvoiceQueryDto } from './dto/invoice-query.dto';
import { INVOICE_EXPORT_PERMISSION, INVOICE_PERMISSION } from './invoice.constants';
import { InvoicesService } from './invoices.service';

// Finance billing a merchant, in the company named by X-Organization-Id (checked by RolesGuard).
@Controller('billing/invoices')
@RequirePermission(INVOICE_PERMISSION)
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  list(@Query() query: InvoiceQueryDto, @Req() request: AuthenticatedRequest) {
    return this.invoices.list(request.tenant!, query);
  }

  // Placed before @Get(':invoiceId') so 'export' is matched statically instead of as an invoice id.
  @Get('export')
  @RequirePermission(INVOICE_EXPORT_PERMISSION)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="invoices-export.csv"')
  exportCsv(@Query() query: InvoiceExportQueryDto, @Req() request: AuthenticatedRequest) {
    return this.invoices.exportCsv({ tenant: request.tenant!, userId: request.user!.id, meta: requestMeta(request) }, query);
  }

  // Minimal merchant choices for invoicing, including archived merchants with unbilled deliveries.
  @Get('clients')
  clients(@Query() query: InvoiceClientsQueryDto, @Req() request: AuthenticatedRequest) {
    return this.invoices.clients(request.tenant!, query);
  }

  @Get(':invoiceId')
  detail(@Param('invoiceId') invoiceId: string, @Req() request: AuthenticatedRequest) {
    return this.invoices.detail(request.tenant!, invoiceId);
  }

  // 201 with the new draft invoice and its lines. A second identical request finds nothing left to bill and gets 409.
  @Post()
  create(@Body() body: CreateInvoiceDto, @Req() request: AuthenticatedRequest) {
    return this.invoices.create({ tenant: request.tenant!, userId: request.user!.id, meta: requestMeta(request) }, body);
  }

  // 200 with the issued invoice. Anything but a draft gets 409.
  @Post(':invoiceId/issue')
  @HttpCode(200)
  issue(@Param('invoiceId') invoiceId: string, @Req() request: AuthenticatedRequest) {
    return this.invoices.issue({ tenant: request.tenant!, userId: request.user!.id, meta: requestMeta(request) }, invoiceId);
  }
}
