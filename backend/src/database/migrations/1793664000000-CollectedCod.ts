import type { MigrationInterface, QueryRunner } from 'typeorm';

// Legacy deliveries have no recorded collection; leave them NULL rather than inferring cash from COD due.
export class CollectedCod1793664000000 implements MigrationInterface {
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE parcels ADD COLUMN collected_amount DECIMAL(12,2) NULL AFTER cod_amount');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE parcels DROP COLUMN collected_amount');
  }
}
