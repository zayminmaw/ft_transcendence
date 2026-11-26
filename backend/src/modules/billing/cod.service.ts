import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { RequestMeta } from '../../common/context/request-meta';
import { isDuplicateKey } from '../../common/database-errors';
import { ID_PATTERN } from '../../common/ids';
import type { TenantContext } from '../../common/types/authenticated-request';
import { AuditService } from '../audit';
import { CodRepository } from './cod.repository';
import { COD_DRIVER_NOT_FOUND, COD_PARCELS_NOT_ELIGIBLE, COD_PENDING_TOO_LOW, COD_REFERENCE_REUSED, codDiscrepancy } from './constants';
import type { ReconcileCodDto } from './dto/reconcile-cod.dto';
import type { DriverCodSettlement } from './entities/driver-cod-settlement.entity';
import { LedgerService } from './ledger.service';
import { fromCents, toCents } from './money';
import type { DeliveredParcel, SettlementView, UnreconciledView } from './types/cod';
import type { LedgerLine } from './types/ledger';

// Who is asking: the verified company, and the account, for the ledger and the audit row.
export interface CodActor {
  tenant: TenantContext;
  userId: string;
  meta: RequestMeta;
}

const isNotEligible = (error: unknown): boolean =>
  error instanceof ConflictException && (error.getResponse() as { code?: string }).code === COD_PARCELS_NOT_ELIGIBLE.code;

const total = (parcels: { codAmount: string }[]): bigint => parcels.reduce((sum, parcel) => sum + toCents(parcel.codAmount), 0n);

// A driver hands the day's cash to the cashier. When the cash is exactly what the delivered parcels were collected for,
// one transaction records the handover, credits each merchant its COD, debits the delivery fee, moves the amount out of
// the merchant's pending balance, and audits it. Anything else is refused and nothing is stored.
@Injectable()
export class CodService {
  constructor(
    private readonly cod: CodRepository,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
  ) {}

  drivers(tenant: TenantContext) {
    return this.cod.driverChoices(tenant.organizationId);
  }

  // What the driver should hand over: delivered parcels with no settlement yet, and their total.
  async waiting(tenant: TenantContext, driverId: string): Promise<UnreconciledView> {
    if (!ID_PATTERN.test(driverId) || !(await this.cod.hasDriver(null, tenant.organizationId, driverId))) {
      throw new NotFoundException(COD_DRIVER_NOT_FOUND);
    }
    const parcels = await this.cod.waiting(tenant.organizationId, driverId);
    return {
      driverId,
      expectedTotal: fromCents(total(parcels)),
      parcels: parcels.map((parcel) => ({
        id: parcel.id, trackingNumber: parcel.trackingNumber, clientId: parcel.clientId, codAmount: parcel.codAmount,
        deliveredAt: parcel.deliveredAt?.toISOString() ?? null,
      })),
    };
  }

  async reconcile(actor: CodActor, body: ReconcileCodDto): Promise<SettlementView> {
    const organizationId = actor.tenant.organizationId;
    // The column is unique across every company, so another company's sheet can never be answered for this one.
    const stored = `${organizationId}-${body.settlementReference}`;
    try {
      return await this.cod.inTransaction((manager) => this.settle(manager, actor, body, stored));
    } catch (error) {
      // Two ways to lose a race with a request for the same parcels. The unique key refused our insert, or we waited
      // for the other request's locks and then found the parcels already settled. Either way this transaction has
      // rolled back; if the other request was the same reference, answer with its sheet.
      if (!isDuplicateKey(error) && !isNotEligible(error)) throw error;
      const existing = await this.cod.findSettlement(null, organizationId, stored);
      if (existing) return this.again(null, existing, body);
      throw isNotEligible(error) ? error : new ConflictException(COD_PARCELS_NOT_ELIGIBLE);
    }
  }

  private async settle(manager: EntityManager, actor: CodActor, body: ReconcileCodDto, stored: string): Promise<SettlementView> {
    const organizationId = actor.tenant.organizationId;
    const existing = await this.cod.findSettlement(manager, organizationId, stored);
    if (existing) return this.again(manager, existing, body);
    if (!(await this.cod.hasDriver(manager, organizationId, body.driverId))) throw new NotFoundException(COD_DRIVER_NOT_FOUND);

    const parcels = await this.cod.lockWaiting(manager, organizationId, body.driverId, body.parcelIds);
    if (parcels.length !== body.parcelIds.length) throw new ConflictException(COD_PARCELS_NOT_ELIGIBLE);
    const expected = total(parcels);
    if (toCents(body.totalCashDropped) !== expected) {
      throw new ConflictException(codDiscrepancy(fromCents(expected), body.totalCashDropped));
    }

    const settlement = await this.cod.insertSettlement(manager, {
      organizationId, settlementReference: stored, driverId: body.driverId, reconciledByUserId: actor.userId,
      totalCodExpected: fromCents(expected), totalCashDropped: body.totalCashDropped, discrepancyAmount: '0.00', settlementStatus: 'verified',
    });
    await this.postToMerchants(manager, actor, settlement, parcels);
    await this.audit.record(manager, {
      module: 'billing', action: 'create', resourceType: 'settlement', recordId: settlement.id, resourceLabel: body.settlementReference,
      organizationId, actorId: actor.userId,
      after: {
        totalCodExpected: settlement.totalCodExpected, totalCashDropped: settlement.totalCashDropped,
        discrepancyAmount: settlement.discrepancyAmount, settlementStatus: settlement.settlementStatus,
      },
      params: { parcels: parcels.length }, meta: actor.meta,
    });
    return this.view(settlement, body.settlementReference, parcels, false);
  }

  // One ledger post per merchant, merchants in id order (the parcels arrive sorted that way), so two handovers that
  // share merchants lock them in the same order and cannot wait on each other.
  private async postToMerchants(manager: EntityManager, actor: CodActor, settlement: DriverCodSettlement, parcels: DeliveredParcel[]): Promise<void> {
    const byMerchant = new Map<string, DeliveredParcel[]>();
    for (const parcel of parcels) byMerchant.set(parcel.clientId, [...(byMerchant.get(parcel.clientId) ?? []), parcel]);

    for (const [clientId, group] of byMerchant) {
      const lines: LedgerLine[] = [];
      let inTransit = 0n;
      for (const parcel of group) {
        const collection = await this.cod.insertCollection(manager, {
          settlementId: settlement.id, parcelId: parcel.id, amountCollected: parcel.codAmount, paymentMethod: 'cash',
        });
        const cod = toCents(parcel.codAmount);
        if (cod > 0n) {
          lines.push({ direction: 'credit', amount: parcel.codAmount, referenceType: 'cod_credit', referenceId: collection.id, description: `COD credit ${parcel.trackingNumber}` });
          inTransit += cod;
        }
        // When the delivery fee is charged is still open (DEC-12). This follows the domain doc, charged at the handover.
        if (toCents(parcel.deliveryFee) > 0n) {
          lines.push({ direction: 'debit', amount: parcel.deliveryFee, referenceType: 'delivery_fee_debit', referenceId: parcel.id, description: `Delivery fee ${parcel.trackingNumber}` });
        }
      }
      if (lines.length === 0) continue;
      const result = await this.ledger.post(manager, {
        organizationId: settlement.organizationId, clientId, lines, pendingChange: fromCents(-inTransit), createdByUserId: actor.userId,
      });
      // Refused, so the whole handover rolls back. The cash enters pending when a delivery is recorded; parcels that
      // never went through that step have nothing to clear.
      if (result.status === 'pending_too_low') throw new ConflictException(COD_PENDING_TOO_LOW);
      if (result.status !== 'posted') throw new Error('A merchant of a delivered parcel was not found, so the handover was rolled back.');
    }
  }

  // A reference identifies one handover, including its driver, cash and parcel set. Order does not matter on retry.
  private async again(manager: EntityManager | null, settlement: DriverCodSettlement, body: ReconcileCodDto): Promise<SettlementView> {
    if (settlement.driverId !== body.driverId || toCents(settlement.totalCashDropped) !== toCents(body.totalCashDropped)) {
      throw new ConflictException(COD_REFERENCE_REUSED);
    }
    const parcels = (await this.cod.settledParcels(manager, settlement.id)).map((parcel) => ({ ...parcel, clientId: '', deliveryFee: '0.00', deliveredAt: null }));
    const requestedIds = new Set(body.parcelIds);
    if (requestedIds.size !== body.parcelIds.length || parcels.length !== requestedIds.size || parcels.some((parcel) => !requestedIds.has(parcel.id))) {
      throw new ConflictException(COD_REFERENCE_REUSED);
    }
    return this.view(settlement, body.settlementReference, parcels, true);
  }

  private view(settlement: DriverCodSettlement, reference: string, parcels: DeliveredParcel[], repeated: boolean): SettlementView {
    return {
      id: settlement.id, reference, driverId: settlement.driverId, status: settlement.settlementStatus,
      totalCodExpected: settlement.totalCodExpected, totalCashDropped: settlement.totalCashDropped,
      discrepancyAmount: settlement.discrepancyAmount, settledAt: (settlement.settledAt ?? new Date()).toISOString(),
      parcels: parcels.map((parcel) => ({ id: parcel.id, trackingNumber: parcel.trackingNumber, codAmount: parcel.codAmount })),
      repeated,
    };
  }
}
