import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Mirrors `storage_files`: one stored file of one company, or of one account (organizationId null, e.g. a profile
// picture). The bytes are at <STORAGE_DIR>/<organizationId or "accounts">/<storedName>.
@Entity('storage_files')
export class StorageFile {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'organization_id', type: 'bigint', unsigned: true, nullable: true })
  organizationId!: string | null;

  @Column({ name: 'uploaded_by_user_id', type: 'bigint', unsigned: true, nullable: true })
  uploadedByUserId!: string | null;

  @Column({ name: 'stored_name', type: 'char', length: 36, unique: true })
  storedName!: string;

  @Column({ name: 'original_name', type: 'varchar', length: 255 })
  originalName!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType!: string;

  @Column({ name: 'size_bytes', type: 'int', unsigned: true })
  sizeBytes!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}
