import type { MigrationInterface, QueryRunner } from 'typeorm';

// Proof of delivery keeps file ids, not links (signed links expire): the recipient's signature, the doorstep photo,
// and an optional delivery note (a photo or PDF of the paper the recipient signed). Each points at a storage_files
// row; removing the file clears the reference. Nothing ever wrote the old URL columns, so no data is lost.
export class DeliveryProof1793577600000 implements MigrationInterface {
  // MariaDB DDL commits implicitly.
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE parcels
        DROP COLUMN recipient_signature_url,
        DROP COLUMN doorstep_photo_url,
        ADD COLUMN signature_file_id BIGINT UNSIGNED NULL AFTER failed_reason_code,
        ADD COLUMN doorstep_photo_file_id BIGINT UNSIGNED NULL AFTER signature_file_id,
        ADD COLUMN delivery_note_file_id BIGINT UNSIGNED NULL AFTER doorstep_photo_file_id,
        ADD CONSTRAINT fk_parcel_signature_file FOREIGN KEY (signature_file_id) REFERENCES storage_files (id) ON DELETE SET NULL,
        ADD CONSTRAINT fk_parcel_photo_file FOREIGN KEY (doorstep_photo_file_id) REFERENCES storage_files (id) ON DELETE SET NULL,
        ADD CONSTRAINT fk_parcel_note_file FOREIGN KEY (delivery_note_file_id) REFERENCES storage_files (id) ON DELETE SET NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE parcels
        DROP FOREIGN KEY fk_parcel_signature_file,
        DROP FOREIGN KEY fk_parcel_photo_file,
        DROP FOREIGN KEY fk_parcel_note_file,
        DROP INDEX fk_parcel_signature_file,
        DROP INDEX fk_parcel_photo_file,
        DROP INDEX fk_parcel_note_file,
        DROP COLUMN signature_file_id,
        DROP COLUMN doorstep_photo_file_id,
        DROP COLUMN delivery_note_file_id,
        ADD COLUMN recipient_signature_url VARCHAR(255) NULL AFTER failed_reason_code,
        ADD COLUMN doorstep_photo_url VARCHAR(255) NULL AFTER recipient_signature_url
    `);
  }
}
