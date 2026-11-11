import type { MigrationInterface, QueryRunner } from 'typeorm';

// Dispatch: a parcel goes out with a driver, the vehicle the driver has checked out, and a run. A run is one driver's
// work for one day, shown as RUN-<yyyymmdd>-<id>; the first parcel assigned to a driver on a day opens it. Each
// parcel event also keeps who and what it was handed to, and the failure code, so the history doesn't depend on the
// parcel's current values.
export class DispatchRuns1793491200000 implements MigrationInterface {
  // MariaDB DDL commits implicitly.
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE dispatch_runs (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        organization_id BIGINT UNSIGNED NOT NULL,
        driver_id BIGINT UNSIGNED NOT NULL,
        run_date DATE NOT NULL,
        created_by_user_id BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_run_org_driver_date (organization_id, driver_id, run_date),
        CONSTRAINT fk_run_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
        CONSTRAINT fk_run_driver FOREIGN KEY (driver_id) REFERENCES delivery_drivers (employee_id) ON DELETE CASCADE,
        CONSTRAINT fk_run_creator FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL,
        INDEX idx_dispatch_runs_driver_id (driver_id),
        INDEX idx_dispatch_runs_created_by_user_id (created_by_user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryRunner.query(`
      ALTER TABLE parcels
        ADD COLUMN dispatch_run_id BIGINT UNSIGNED NULL AFTER assigned_asset_id,
        ADD CONSTRAINT fk_parcel_run FOREIGN KEY (dispatch_run_id) REFERENCES dispatch_runs (id) ON DELETE SET NULL,
        ADD INDEX idx_parcels_dispatch_run_id (dispatch_run_id),
        ADD INDEX idx_parcels_org_status (organization_id, lifecycle_status),
        ADD INDEX idx_parcels_org_created (organization_id, created_at),
        ADD INDEX idx_parcels_org_zone (organization_id, delivery_city_zone)
    `);
    // The company indexes above start with organization_id, so they also serve its foreign key.
    await queryRunner.query('ALTER TABLE parcels DROP INDEX idx_parcels_organization_id');
    await queryRunner.query(`
      ALTER TABLE parcel_events
        ADD COLUMN driver_id BIGINT UNSIGNED NULL AFTER hub_location,
        ADD COLUMN asset_id BIGINT UNSIGNED NULL AFTER driver_id,
        ADD COLUMN dispatch_run_id BIGINT UNSIGNED NULL AFTER asset_id,
        ADD COLUMN reason_code VARCHAR(64) NULL AFTER dispatch_run_id,
        ADD CONSTRAINT fk_pe_driver FOREIGN KEY (driver_id) REFERENCES delivery_drivers (employee_id) ON DELETE SET NULL,
        ADD CONSTRAINT fk_pe_asset FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE SET NULL,
        ADD CONSTRAINT fk_pe_run FOREIGN KEY (dispatch_run_id) REFERENCES dispatch_runs (id) ON DELETE SET NULL,
        ADD INDEX idx_parcel_events_driver_id (driver_id),
        ADD INDEX idx_parcel_events_asset_id (asset_id),
        ADD INDEX idx_parcel_events_dispatch_run_id (dispatch_run_id)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE parcel_events
        DROP FOREIGN KEY fk_pe_driver,
        DROP FOREIGN KEY fk_pe_asset,
        DROP FOREIGN KEY fk_pe_run,
        DROP INDEX idx_parcel_events_driver_id,
        DROP INDEX idx_parcel_events_asset_id,
        DROP INDEX idx_parcel_events_dispatch_run_id,
        DROP COLUMN driver_id,
        DROP COLUMN asset_id,
        DROP COLUMN dispatch_run_id,
        DROP COLUMN reason_code
    `);
    await queryRunner.query('ALTER TABLE parcels ADD INDEX idx_parcels_organization_id (organization_id)');
    await queryRunner.query(`
      ALTER TABLE parcels
        DROP FOREIGN KEY fk_parcel_run,
        DROP INDEX idx_parcels_dispatch_run_id,
        DROP INDEX idx_parcels_org_status,
        DROP INDEX idx_parcels_org_created,
        DROP INDEX idx_parcels_org_zone,
        DROP COLUMN dispatch_run_id
    `);
    await queryRunner.query('DROP TABLE dispatch_runs');
  }
}
