import type { MigrationInterface, QueryRunner } from 'typeorm';

// Run with all application writers stopped (see .docs/Pending-COD-Cutover.md). Rebuild the derived balance rather
// than subtracting old holds blindly: settled, returned and legacy-imported parcels must not strand phantom cash.
export class PendingCodAtDelivery1793750400000 implements MigrationInterface {
  // DML only. Up overrides migrationsTransactionMode: 'none'. TypeORM's revert path needs --transaction each.
  transaction = true;

  up(queryRunner: QueryRunner): Promise<void> {
    return this.rebuild(queryRunner, true);
  }

  down(queryRunner: QueryRunner): Promise<void> {
    // Restore the old accounting basis from current records, never a stale pre-deployment balance snapshot.
    return this.rebuild(queryRunner, false);
  }

  private async rebuild(queryRunner: QueryRunner, atDelivery: boolean): Promise<void> {
    if (!queryRunner.isTransactionActive) throw new Error('Pending COD cutover requires a transaction; use --transaction each for migration:revert.');
    const statuses = atDelivery ? "'delivered'" : "'out_for_delivery', 'failed_attempt', 'delivered'";
    const amount = atDelivery ? 'COALESCE(parcel.collected_amount, parcel.cod_amount)' : 'parcel.cod_amount';
    const outstanding = `FROM parcels parcel
      JOIN clients merchant ON merchant.id = parcel.client_id AND merchant.organization_id = parcel.organization_id
      LEFT JOIN driver_cod_collections collection ON collection.parcel_id = parcel.id
      WHERE parcel.lifecycle_status IN (${statuses}) AND collection.id IS NULL`;

    if (atDelivery) {
      // Handover still clears COD due, and the delivery command requires exact collection. Imported mismatches need
      // reconciliation, not an inferred balance. NULL legacy amounts follow the old handover's COD-due basis;
      // do not populate collected_amount and pretend a collection was recorded.
      const inconsistent = await queryRunner.query(`SELECT parcel.id ${outstanding}
        AND parcel.collected_amount IS NOT NULL AND parcel.collected_amount <> parcel.cod_amount LIMIT 1`);
      if (inconsistent.length) throw new Error('Pending COD cutover: reconcile delivered parcels whose recorded collection differs from COD due before retrying.');
    }
    const tooLarge = await queryRunner.query(`SELECT merchant.id ${outstanding}
      GROUP BY merchant.id HAVING SUM(${amount}) > 9999999999.99 LIMIT 1`);
    if (tooLarge.length) throw new Error('Pending COD cutover: an outstanding total exceeds DECIMAL(12,2); reconcile it before retrying.');

    await queryRunner.query(`UPDATE clients merchant SET pending_cod_balance = COALESCE((
      SELECT SUM(${amount}) FROM parcels parcel
      LEFT JOIN driver_cod_collections collection ON collection.parcel_id = parcel.id
      WHERE parcel.client_id = merchant.id AND parcel.organization_id = merchant.organization_id
        AND parcel.lifecycle_status IN (${statuses}) AND collection.id IS NULL
    ), 0.00)`);
  }
}
