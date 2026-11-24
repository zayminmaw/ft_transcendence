import { Body, Controller, Post, Req } from '@nestjs/common';
import { requestMeta } from '../../common/context/request-meta';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { INVOICE_PERMISSION } from './invoice.constants';
import { InvoicesService } from './invoices.service';

// Finance billing a merchant, in the company named by X-Organization-Id (checked by RolesGuard).
@Controller('billing/invoices')
@RequirePermission(INVOICE_PERMISSION)
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  // 201 with the new draft invoice and its lines. A second identical request finds nothing left to bill and gets 409.
  @Post()
  create(@Body() body: CreateInvoiceDto, @Req() request: AuthenticatedRequest) {
    return this.invoices.create({ tenant: request.tenant!, userId: request.user!.id, meta: requestMeta(request) }, body);
  }
}
