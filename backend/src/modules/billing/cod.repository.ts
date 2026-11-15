import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { DriverCodCollection } from './entities/driver-cod-collection.entity';
import { DriverCodSettlement } from './entities/driver-cod-settlement.entity';
import type { DeliveredParcel } from './types/cod';

type ParcelRow = { id: string; trackingNumber: string; clientId: string; codAmount: string; deliveryFee: string; deliveredAt: Date | null };

const toParcel = (row: ParcelRow): DeliveredParcel => ({
  id: String(row.id), trackingNumber: row.trackingNumber, clientId: String(row.clientId),
  codAmount: String(row.codAmount), deliveryFee: String(row.deliveryFee), deliveredAt: row.deliveredAt,
});

// The cash handovers of one company. The parcels table belongs to the parcels module, so it is only read here, by
// plain queries, never changed. Every query is scoped to the company.
@Injectable()
export class CodRepository {
  constructor(private readonly database: DataSource) {}

  inTransaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.database.transaction(work);
  }

  // A driver of this company: the employee must belong to it, not only exist.
  async hasDriver(manager: EntityManager | null, organizationId: string, driverId: string): Promise<boolean> {
    const found = await (manager ?? this.database.manager)
      .createQueryBuilder()
      .select('d.employee_id', 'id')
      .from('delivery_drivers', 'd')
      .innerJoin('employees', 'e', 'e.id = d.employee_id')
      .where('d.employee_id = :driverId', { driverId })
      .andWhere('e.organization_id = :organizationId', { organizationId })
      .getRawOne();
    return found !== undefined;
  }

  async waiting(organizationId: string, driverId: string): Promise<DeliveredParcel[]> {
    const rows: ParcelRow[] = await this.waitingQuery(this.database.manager, organizationId, driverId)
      .orderBy('p.delivered_at').addOrderBy('p.id')
      .getRawMany();
    return rows.map(toParcel);
  }

  // The listed parcels that can be settled, locked until the transaction ends, so a second handover can't take the
  // same ones. Ordered by merchant then parcel, so the merchant rows are locked in the same order every time.
  async lockWaiting(manager: EntityManager, organizationId: string, driverId: string, parcelIds: string[]): Promise<DeliveredParcel[]> {
    const rows: ParcelRow[] = await this.waitingQuery(manager, organizationId, driverId)
      .andWhere('p.id IN (:...parcelIds)', { parcelIds })
      .orderBy('p.client_id').addOrderBy('p.id')
      .setLock('pessimistic_write')
      .getRawMany();
    return rows.map(toParcel);
  }

  // Delivered by this driver in this company, and no settlement has claimed it.
  private waitingQuery(manager: EntityManager, organizationId: string, driverId: string) {
    return manager
      .createQueryBuilder()
      .select('p.id', 'id')
      .addSelect('p.tracking_number', 'trackingNumber')
      .addSelect('p.client_id', 'clientId')
      .addSelect('p.cod_amount', 'codAmount')
      .addSelect('p.delivery_fee', 'deliveryFee')
      .addSelect('p.delivered_at', 'deliveredAt')
      .from('parcels', 'p')
      .leftJoin('driver_cod_collections', 'c', 'c.parcel_id = p.id')
      .where('p.organization_id = :organizationId', { organizationId })
      .andWhere('p.assigned_driver_id = :driverId', { driverId })
      .andWhere('p.lifecycle_status = :status', { status: 'delivered' })
      .andWhere('c.id IS NULL');
  }

  findSettlement(manager: EntityManager | null, organizationId: string, reference: string): Promise<DriverCodSettlement | null> {
    return (manager ?? this.database.manager).getRepository(DriverCodSettlement).findOneBy({ organizationId, settlementReference: reference });
  }

  async settledParcels(manager: EntityManager | null, settlementId: string): Promise<{ id: string; trackingNumber: string; codAmount: string }[]> {
    const rows: { id: string; trackingNumber: string; codAmount: string }[] = await (manager ?? this.database.manager)
      .createQueryBuilder()
      .select('p.id', 'id')
      .addSelect('p.tracking_number', 'trackingNumber')
      .addSelect('c.amount_collected', 'codAmount')
      .from('driver_cod_collections', 'c')
      .innerJoin('parcels', 'p', 'p.id = c.parcel_id')
      .where('c.settlement_id = :settlementId', { settlementId })
      .orderBy('p.id')
      .getRawMany();
    return rows.map((row) => ({ id: String(row.id), trackingNumber: row.trackingNumber, codAmount: String(row.codAmount) }));
  }

  insertSettlement(manager: EntityManager, values: Omit<DriverCodSettlement, 'id' | 'settledAt' | 'reconciliationNotes'>): Promise<DriverCodSettlement> {
    const repository = manager.getRepository(DriverCodSettlement);
    return repository.save(repository.create({ ...values, reconciliationNotes: null }));
  }

  insertCollection(manager: EntityManager, values: Omit<DriverCodCollection, 'id' | 'collectedAt'>): Promise<DriverCodCollection> {
    const repository = manager.getRepository(DriverCodCollection);
    return repository.save(repository.create(values));
  }
}
