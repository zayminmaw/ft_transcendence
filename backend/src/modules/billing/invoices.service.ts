import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { RequestMeta } from '../../common/context/request-meta';
import type { TenantContext } from '../../common/types/authenticated-request';
import { AuditService } from '../audit';
import type { CreateInvoiceDto } from './dto/create-invoice.dto';
import type { Invoice } from './entities/invoice.entity';
import { INVOICE_BAD_PERIOD, INVOICE_DUE_DAYS, INVOICE_MERCHANT_NOT_FOUND, INVOICE_NOTHING_TO_BILL } from './invoice.constants';
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
        status: 'draft', issueDate: day(today), dueDate: day(daysAfter(today, INVOICE_DUE_DAYS)),
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
}
