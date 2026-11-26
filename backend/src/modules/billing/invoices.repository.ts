import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, type EntityManager } from 'typeorm';
import type { Client } from '../clients/entities/client.entity';
import type { InvoiceQueryDto } from './dto/invoice-query.dto';
import { InvoiceItem } from './entities/invoice-item.entity';
import { Invoice } from './entities/invoice.entity';
import { LedgerRepository } from './ledger.repository';
import type { BillableParcel } from './types/invoice';

type ParcelRow = { id: string; trackingNumber: string; deliveryFee: string };

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

  async list(organizationId: string, query: InvoiceQueryDto): Promise<{ items: Invoice[]; total: number }> {
    const builder = this.database.getRepository(Invoice).createQueryBuilder('invoice')
      .where('invoice.organizationId = :organizationId AND invoice.clientId = :clientId', { organizationId, clientId: query.clientId });
    if (query.periodStart !== undefined) builder.andWhere('invoice.billingPeriodStart = :periodStart', { periodStart: query.periodStart });
    if (query.periodEnd !== undefined) builder.andWhere('invoice.billingPeriodEnd = :periodEnd', { periodEnd: query.periodEnd });
    const [items, total] = await builder.orderBy('invoice.createdAt', 'DESC').addOrderBy('invoice.id', 'DESC')
      .skip((query.page - 1) * query.pageSize).take(query.pageSize).getManyAndCount();
    return { items, total };
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
