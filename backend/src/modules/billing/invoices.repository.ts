import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Brackets, DataSource, type EntityManager, type SelectQueryBuilder } from 'typeorm';
import { containsPattern } from '../../common/like-pattern';
import { Client } from '../clients/entities/client.entity';
import type { InvoiceExportQueryDto, InvoiceQueryDto } from './dto/invoice-query.dto';
import { InvoiceItem } from './entities/invoice-item.entity';
import { Invoice, type InvoiceStatus } from './entities/invoice.entity';
import { INVOICE_EXPORT_LIMIT } from './invoice.constants';
import { LedgerRepository } from './ledger.repository';
import type { BillableParcel, InvoiceListRecord, InvoiceSummaryStats } from './types/invoice';

type ParcelRow = { id: string; trackingNumber: string; deliveryFee: string };

type RawInvoiceRow = {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  clientCode: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  totalDeliveries: string | number;
  totalDeliveryFees: string;
  totalCodCollected: string;
  netAmountDue: string;
  createdAt: Date | string;
};

const toListRecord = (row: RawInvoiceRow): InvoiceListRecord => ({
  id: String(row.id),
  invoiceNumber: row.invoiceNumber,
  clientId: String(row.clientId),
  clientName: row.clientName,
  clientCode: row.clientCode,
  billingPeriodStart: String(row.billingPeriodStart).slice(0, 10),
  billingPeriodEnd: String(row.billingPeriodEnd).slice(0, 10),
  status: row.status,
  issueDate: String(row.issueDate).slice(0, 10),
  dueDate: String(row.dueDate).slice(0, 10),
  totalDeliveries: Number(row.totalDeliveries),
  totalDeliveryFees: String(row.totalDeliveryFees),
  totalCodCollected: String(row.totalCodCollected),
  netAmountDue: String(row.netAmountDue),
  createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
});

// The invoices of one company. The parcels table belongs to the parcels module, so it is only read here, by plain
// queries, never changed. Every query is scoped to the company.
@Injectable()
export class InvoicesRepository {
  constructor(private readonly database: DataSource, private readonly ledger: LedgerRepository) {}

  inTransaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.database.transaction(work);
  }

  // The merchant, locked until the transaction ends, so two invoices for one merchant are made one after the other and
  // the second one sees the parcels the first one took.
  lockClient(manager: EntityManager, organizationId: string, clientId: string): Promise<Client | null> {
    return this.ledger.lockClient(manager, organizationId, clientId);
  }

  private filtered(organizationId: string, query: InvoiceExportQueryDto): SelectQueryBuilder<Invoice> {
    const builder = this.database.getRepository(Invoice).createQueryBuilder('invoice')
      .innerJoin(Client, 'client', 'client.id = invoice.clientId AND client.organizationId = invoice.organizationId')
      .where('invoice.organizationId = :organizationId', { organizationId });
    if (query.clientId !== undefined) builder.andWhere('invoice.clientId = :clientId', { clientId: query.clientId });
    if (query.periodStart !== undefined) builder.andWhere('invoice.billingPeriodStart = :periodStart', { periodStart: query.periodStart });
    if (query.periodEnd !== undefined) builder.andWhere('invoice.billingPeriodEnd = :periodEnd', { periodEnd: query.periodEnd });
    if (query.status !== undefined) builder.andWhere('invoice.status = :status', { status: query.status });
    if (query.search) {
      const pattern = containsPattern(query.search);
      builder.andWhere(new Brackets((where) => {
        where.where('invoice.invoiceNumber LIKE :pattern', { pattern })
          .orWhere('client.businessName LIKE :pattern', { pattern })
          .orWhere('client.clientCode LIKE :pattern', { pattern });
      }));
    }
    return builder;
  }

  private selectColumns(builder: SelectQueryBuilder<Invoice>): SelectQueryBuilder<Invoice> {
    return builder
      .select('invoice.id', 'id')
      .addSelect('invoice.invoiceNumber', 'invoiceNumber')
      .addSelect('invoice.clientId', 'clientId')
      .addSelect('client.businessName', 'clientName')
      .addSelect('client.clientCode', 'clientCode')
      .addSelect("DATE_FORMAT(invoice.billingPeriodStart, '%Y-%m-%d')", 'billingPeriodStart')
      .addSelect("DATE_FORMAT(invoice.billingPeriodEnd, '%Y-%m-%d')", 'billingPeriodEnd')
      .addSelect('invoice.status', 'status')
      .addSelect("DATE_FORMAT(invoice.issueDate, '%Y-%m-%d')", 'issueDate')
      .addSelect("DATE_FORMAT(invoice.dueDate, '%Y-%m-%d')", 'dueDate')
      .addSelect('invoice.totalDeliveries', 'totalDeliveries')
      .addSelect('invoice.totalDeliveryFees', 'totalDeliveryFees')
      .addSelect('invoice.totalCodCollected', 'totalCodCollected')
      .addSelect('invoice.netAmountDue', 'netAmountDue')
      .addSelect('invoice.createdAt', 'createdAt')
      .orderBy('invoice.createdAt', 'DESC')
      .addOrderBy('invoice.id', 'DESC');
  }

  async list(organizationId: string, query: InvoiceQueryDto): Promise<{ items: InvoiceListRecord[]; total: number }> {
    const base = this.filtered(organizationId, query);
    const total = await base.clone().getCount();
    const rows = await this.selectColumns(base)
      .offset((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .getRawMany<RawInvoiceRow>();
    return { items: rows.map(toListRecord), total };
  }

  async listForExport(organizationId: string, query: InvoiceExportQueryDto): Promise<InvoiceListRecord[]> {
    const rows = await this.selectColumns(this.filtered(organizationId, query))
      .limit(INVOICE_EXPORT_LIMIT)
      .getRawMany<RawInvoiceRow>();
    return rows.map(toListRecord);
  }

  // Exact SQL decimal/count aggregates for the company (or one merchant when clientId is passed).
  async summary(organizationId: string, clientId?: string): Promise<InvoiceSummaryStats> {
    const builder = this.database.getRepository(Invoice).createQueryBuilder('invoice')
      .select('COUNT(*)', 'total')
      .addSelect("COALESCE(SUM(invoice.status = 'draft'), 0)", 'draft')
      .addSelect("COALESCE(SUM(invoice.status = 'issued'), 0)", 'issued')
      .addSelect("COALESCE(SUM(invoice.status IN ('paid_via_balance_offset', 'paid_via_bank_transfer')), 0)", 'paid')
      .addSelect("COALESCE(SUM(invoice.status = 'overdue'), 0)", 'overdue')
      .addSelect('COALESCE(SUM(invoice.totalDeliveryFees), 0.00)', 'totalDeliveryFees')
      .where('invoice.organizationId = :organizationId', { organizationId });
    if (clientId !== undefined) builder.andWhere('invoice.clientId = :clientId', { clientId });
    const row = await builder.getRawOne<{
      total: string; draft: string; issued: string; paid: string; overdue: string; totalDeliveryFees: string;
    }>();
    return {
      total: Number(row?.total ?? 0),
      draft: Number(row?.draft ?? 0),
      issued: Number(row?.issued ?? 0),
      paid: Number(row?.paid ?? 0),
      overdue: Number(row?.overdue ?? 0),
      totalDeliveryFees: row?.totalDeliveryFees != null ? String(row.totalDeliveryFees) : '0.00',
    };
  }

  find(organizationId: string, id: string): Promise<Invoice | null> {
    return this.database.getRepository(Invoice).findOneBy({ organizationId, id });
  }

  async items(organizationId: string, invoiceId: string, manager: EntityManager = this.database.manager): Promise<BillableParcel[]> {
    const rows: ParcelRow[] = await manager.createQueryBuilder()
      .select('ii.parcel_id', 'id').addSelect('p.tracking_number', 'trackingNumber')
      .addSelect('ii.delivery_fee', 'deliveryFee').from('invoice_items', 'ii')
      .innerJoin('invoices', 'invoice', 'invoice.id = ii.invoice_id AND invoice.organization_id = :organizationId', { organizationId })
      .innerJoin('parcels', 'p', 'p.id = ii.parcel_id')
      .where('ii.invoice_id = :invoiceId', { invoiceId }).orderBy('ii.id', 'ASC').getRawMany();
    return rows.map((row) => ({ id: String(row.id), trackingNumber: row.trackingNumber, deliveryFee: String(row.deliveryFee) }));
  }

  // Delivered in the period (the last day included), with a delivery fee, and not on any invoice yet.
  async billable(manager: EntityManager, organizationId: string, clientId: string, periodStart: string, periodEnd: string): Promise<BillableParcel[]> {
    const rows: ParcelRow[] = await manager
      .createQueryBuilder()
      .select('p.id', 'id')
      .addSelect('p.tracking_number', 'trackingNumber')
      .addSelect('p.delivery_fee', 'deliveryFee')
      .from('parcels', 'p')
      .leftJoin('invoice_items', 'ii', 'ii.parcel_id = p.id')
      .where('p.organization_id = :organizationId', { organizationId })
      .andWhere('p.client_id = :clientId', { clientId })
      .andWhere('p.lifecycle_status = :status', { status: 'delivered' })
      .andWhere('p.delivery_fee > 0')
      .andWhere('p.delivered_at >= :periodStart', { periodStart })
      .andWhere('p.delivered_at < DATE_ADD(:periodEnd, INTERVAL 1 DAY)', { periodEnd })
      .andWhere('ii.id IS NULL')
      .orderBy('p.delivered_at').addOrderBy('p.id')
      .getRawMany();
    return rows.map((row) => ({ id: String(row.id), trackingNumber: row.trackingNumber, deliveryFee: String(row.deliveryFee) }));
  }

  // The invoice number comes from the row's own id, so it is unique and rises with every invoice. The row is first
  // saved under a throwaway number, because the id is not known before the insert.
  async insert(manager: EntityManager, values: Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt' | 'updatedAt'>): Promise<Invoice> {
    const repository = manager.getRepository(Invoice);
    const saved = await repository.save(repository.create({ ...values, invoiceNumber: `PENDING-${randomUUID()}` }));
    saved.invoiceNumber = `INV-${values.organizationId}-${String(saved.id).padStart(6, '0')}`;
    await repository.update({ id: saved.id }, { invoiceNumber: saved.invoiceNumber });
    return saved;
  }

  async insertItems(manager: EntityManager, rows: Omit<InvoiceItem, 'id'>[]): Promise<void> {
    const repository = manager.getRepository(InvoiceItem);
    await repository.save(rows.map((row) => repository.create(row)));
  }

  // The invoice, locked until the transaction ends, so two requests to issue it run one after the other.
  lock(manager: EntityManager, organizationId: string, id: string): Promise<Invoice | null> {
    return manager.getRepository(Invoice).createQueryBuilder('invoice')
      .setLock('pessimistic_write')
      .where('invoice.id = :id AND invoice.organizationId = :organizationId', { id, organizationId })
      .getOne();
  }

  async markIssued(manager: EntityManager, id: string, issueDate: string, dueDate: string): Promise<void> {
    await manager.getRepository(Invoice).update({ id }, { status: 'issued', issueDate, dueDate });
  }
}
