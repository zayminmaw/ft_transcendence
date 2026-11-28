import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { RequestMeta } from '../../common/context/request-meta';
import type { TenantContext } from '../../common/types/authenticated-request';
import { ID_PATTERN } from '../../common/ids';
import { AuditService } from '../audit';
import { buildCsv } from './csv';
import type { CreateInvoiceDto } from './dto/create-invoice.dto';
import type { InvoiceExportQueryDto, InvoiceQueryDto } from './dto/invoice-query.dto';
import type { InvoiceClientsQueryDto } from './dto/invoice-clients-query.dto';
import { INVOICE_EXPORT_LIMIT } from './invoice.constants';
import type { Invoice } from './entities/invoice.entity';
import { INVOICE_BAD_PERIOD, INVOICE_DUE_DAYS, INVOICE_MERCHANT_NOT_FOUND, INVOICE_NOT_DRAFT, INVOICE_NOT_FOUND, INVOICE_NOTHING_TO_BILL } from './invoice.constants';
import { InvoicesRepository } from './invoices.repository';
import { fromCents, toCents } from './money';
import type { BillableParcel, InvoiceView } from './types/invoice';

// Who is asking: the verified company, and the account, for the invoice and the audit row.
export interface InvoiceActor {
  tenant: TenantContext;
  userId: string;
  meta: RequestMeta;
}

const day = (date: Date): string => date.toISOString().slice(0, 10);
const daysAfter = (date: Date, days: number): Date => new Date(date.getTime() + days * 86_400_000);
const dueFrom = (issued: Date): string => day(daysAfter(issued, INVOICE_DUE_DAYS));

const EXPORT_HEADERS = [
  'Invoice Number', 'Merchant Code', 'Merchant Name', 'Period Start', 'Period End',
  'Status', 'Issue Date', 'Due Date', 'Total Deliveries', 'Total Delivery Fees',
  'Total COD Collected', 'Net Amount Due', 'Created At',
] as const;

const view = (invoice: Invoice, parcels: BillableParcel[]): InvoiceView => ({
  id: invoice.id, invoiceNumber: invoice.invoiceNumber, clientId: invoice.clientId,
  periodStart: invoice.billingPeriodStart, periodEnd: invoice.billingPeriodEnd, status: invoice.status,
  issueDate: invoice.issueDate, dueDate: invoice.dueDate, totalDeliveries: invoice.totalDeliveries,
  totalDeliveryFees: invoice.totalDeliveryFees, netAmountDue: invoice.netAmountDue, notes: invoice.notes,
  items: parcels.map((parcel) => ({ parcelId: parcel.id, trackingNumber: parcel.trackingNumber, deliveryFee: parcel.deliveryFee })),
});

// Finance bills a merchant for the delivery fees of the parcels delivered in a period. One transaction picks the
// delivered parcels that are not on an invoice yet, saves the invoice as a draft with one line per parcel, and audits
// it. Only the delivery fee is billed (DEC-12 leaves COD to the ledger), so the COD and surcharge columns stay at zero.
// Generating an invoice never changes the merchant's balance.
@Injectable()
export class InvoicesService {
  constructor(private readonly invoices: InvoicesRepository, private readonly audit: AuditService) {}

  clients(tenant: TenantContext, query: InvoiceClientsQueryDto) {
    return this.invoices.clients(tenant.organizationId, query);
  }

  async list(tenant: TenantContext, query: InvoiceQueryDto) {
    if (query.periodStart && query.periodEnd && query.periodStart > query.periodEnd) throw new BadRequestException(INVOICE_BAD_PERIOD);
    const { items, total } = await this.invoices.list(tenant.organizationId, query);
    const summary = typeof this.invoices.summary === 'function'
      ? await this.invoices.summary(tenant.organizationId, query.clientId)
      : undefined;
    return {
      items: items.map((invoice) => ({
        id: invoice.id, invoiceNumber: invoice.invoiceNumber, clientId: invoice.clientId,
        clientName: invoice.clientName ?? '', clientCode: invoice.clientCode ?? '',
        periodStart: invoice.billingPeriodStart, periodEnd: invoice.billingPeriodEnd, status: invoice.status,
        issueDate: invoice.issueDate, dueDate: invoice.dueDate,
        totalDeliveries: invoice.totalDeliveries, totalDeliveryFees: invoice.totalDeliveryFees,
        totalCodCollected: invoice.totalCodCollected, netAmountDue: invoice.netAmountDue, createdAt: invoice.createdAt.toISOString(),
      })),
      total, page: query.page, pageSize: query.pageSize,
      ...(summary ? { summary } : {}),
    };
  }

  // Exports filtered company invoices as RFC-4180 CSV with formula-injection neutralization and records an access audit row.
  async exportCsv(actor: InvoiceActor, query: InvoiceExportQueryDto): Promise<string> {
    if (query.periodStart && query.periodEnd && query.periodStart > query.periodEnd) throw new BadRequestException(INVOICE_BAD_PERIOD);
    const organizationId = actor.tenant.organizationId;
    const rows = await this.invoices.listForExport(organizationId, query);
    if (rows.length > INVOICE_EXPORT_LIMIT) {
      throw new BadRequestException({
        code: 'INVOICE_EXPORT_TOO_LARGE',
        message: `This export exceeds ${INVOICE_EXPORT_LIMIT} invoices. Narrow the filters and try again.`,
      });
    }
    const csv = buildCsv(
      EXPORT_HEADERS,
      rows.map((invoice) => [
        invoice.invoiceNumber,
        invoice.clientCode,
        invoice.clientName,
        invoice.billingPeriodStart,
        invoice.billingPeriodEnd,
        invoice.status,
        invoice.issueDate,
        invoice.dueDate,
        invoice.totalDeliveries,
        invoice.totalDeliveryFees,
        invoice.totalCodCollected,
        invoice.netAmountDue,
        invoice.createdAt.toISOString(),
      ]),
    );
    await this.audit.recordStandalone({
      module: 'billing',
      action: 'read',
      resourceType: 'invoice_export',
      organizationId,
      actorId: actor.userId,
      params: {
        count: rows.length,
        ...(query.clientId ? { clientId: query.clientId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.search ? { search: query.search } : {}),
      },
      meta: actor.meta,
    });
    return csv;
  }

  async detail(tenant: TenantContext, invoiceId: string): Promise<InvoiceView> {
    if (!ID_PATTERN.test(invoiceId)) throw new NotFoundException(INVOICE_NOT_FOUND);
    const invoice = await this.invoices.find(tenant.organizationId, invoiceId);
    if (!invoice) throw new NotFoundException(INVOICE_NOT_FOUND);
    return view(invoice, await this.invoices.items(tenant.organizationId, invoice.id));
  }

  async create(actor: InvoiceActor, body: CreateInvoiceDto): Promise<InvoiceView> {
    if (body.periodStart > body.periodEnd) throw new BadRequestException(INVOICE_BAD_PERIOD);
    const organizationId = actor.tenant.organizationId;
    const today = new Date();
    return this.invoices.inTransaction(async (manager) => {
      const client = await this.invoices.lockClient(manager, organizationId, body.clientId);
      if (!client) throw new NotFoundException(INVOICE_MERCHANT_NOT_FOUND);

      // Read after the lock: an invoice that ran first for this merchant has committed by now.
      const parcels = await this.invoices.billable(manager, organizationId, body.clientId, body.periodStart, body.periodEnd);
      if (parcels.length === 0) throw new ConflictException(INVOICE_NOTHING_TO_BILL);
      const total = fromCents(parcels.reduce((sum, parcel) => sum + toCents(parcel.deliveryFee), 0n));

      const invoice = await this.invoices.insert(manager, {
        organizationId, clientId: body.clientId, billingPeriodStart: body.periodStart, billingPeriodEnd: body.periodEnd,
        totalDeliveries: parcels.length, totalDeliveryFees: total, totalCodCollected: '0.00', netAmountDue: total,
        status: 'draft', issueDate: day(today), dueDate: dueFrom(today),
        createdByUserId: actor.userId, notes: body.notes ?? null,
      });
      await this.invoices.insertItems(manager, parcels.map((parcel) => ({
        invoiceId: invoice.id, parcelId: parcel.id, deliveryFee: parcel.deliveryFee, codAmount: '0.00', surcharges: '0.00', netItemAmount: parcel.deliveryFee,
      })));
      await this.audit.record(manager, {
        module: 'billing', action: 'create', resourceType: 'invoice', recordId: invoice.id, resourceLabel: invoice.invoiceNumber,
        organizationId, actorId: actor.userId,
        after: { status: invoice.status, totalDeliveries: invoice.totalDeliveries, totalDeliveryFees: total, netAmountDue: total },
        meta: actor.meta,
      });
      return view(invoice, parcels);
    });
  }

  // A draft becomes issued, and the issue date and due date count from today, since a draft can wait for days. Only a
  // draft can be issued, so a second request, or one for an invoice already paid, is refused and changes nothing.
  // Issuing never changes the merchant's balance: the fees were taken at the COD handover (DEC-12).
  async issue(actor: InvoiceActor, invoiceId: string): Promise<InvoiceView> {
    const organizationId = actor.tenant.organizationId;
    if (!ID_PATTERN.test(invoiceId)) throw new NotFoundException(INVOICE_NOT_FOUND);
    const today = new Date();
    return this.invoices.inTransaction(async (manager) => {
      const invoice = await this.invoices.lock(manager, organizationId, invoiceId);
      if (!invoice) throw new NotFoundException(INVOICE_NOT_FOUND);
      if (invoice.status !== 'draft') throw new ConflictException(INVOICE_NOT_DRAFT);

      const before = { status: invoice.status, issueDate: invoice.issueDate, dueDate: invoice.dueDate };
      const after = { status: 'issued' as const, issueDate: day(today), dueDate: dueFrom(today) };
      await this.invoices.markIssued(manager, invoiceId, after.issueDate, after.dueDate);
      await this.audit.record(manager, {
        module: 'billing', action: 'status_change', resourceType: 'invoice', recordId: invoiceId, resourceLabel: invoice.invoiceNumber,
        organizationId, actorId: actor.userId, before, after, meta: actor.meta,
      });
      return view({ ...invoice, ...after }, await this.invoices.items(organizationId, invoiceId, manager));
    });
  }
}
