import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { StorageFile } from './entities/storage-file.entity';
import type { FileRecord, NewFile } from './types/storage-file';

// Lookups are scoped to the company, so another company's file is simply not found. The one exception, findById,
// is only for signed links, where the signature already proves the link was handed out for that file.
@Injectable()
export class StorageRepository {
  constructor(private readonly database: DataSource) {}

  async insert(input: NewFile): Promise<FileRecord> {
    // On MariaDB, insert() already reads back the generated id and created_at.
    const { generatedMaps } = await this.database.getRepository(StorageFile).insert(input);
    return this.toRecord({ ...input, ...generatedMaps[0] } as StorageFile);
  }

  async find(organizationId: string, id: string): Promise<FileRecord | undefined> {
    const row = await this.database.getRepository(StorageFile).findOneBy({ organizationId, id });
    return row ? this.toRecord(row) : undefined;
  }

  async findById(id: string): Promise<FileRecord | undefined> {
    const row = await this.database.getRepository(StorageFile).findOneBy({ id });
    return row ? this.toRecord(row) : undefined;
  }

  async delete(organizationId: string, id: string): Promise<void> {
    await this.database.getRepository(StorageFile).delete({ organizationId, id });
  }

  private toRecord(row: StorageFile): FileRecord {
    return {
      id: String(row.id),
      organizationId: String(row.organizationId),
      uploadedByUserId: row.uploadedByUserId === null ? null : String(row.uploadedByUserId),
      storedName: row.storedName,
      originalName: row.originalName,
      mimeType: row.mimeType,
      sizeBytes: Number(row.sizeBytes),
      createdAt: row.createdAt,
    };
  }
}
