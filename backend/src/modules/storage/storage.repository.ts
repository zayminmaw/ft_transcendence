import { Injectable } from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import { StorageFile } from './entities/storage-file.entity';
import type { FileRecord, NewFile } from './types/storage-file';

// Lookups are scoped to the company, so another company's file is simply not found. A null company means an account's
// files, which no company lookup reaches either. The one exception, findById, is only for signed links, where the
// signature already proves the link was handed out for that file.
@Injectable()
export class StorageRepository {
  constructor(private readonly database: DataSource) {}

  async insert(input: NewFile): Promise<FileRecord> {
    // On MariaDB, insert() already reads back the generated id and created_at.
    const { generatedMaps } = await this.database.getRepository(StorageFile).insert(input);
    return this.toRecord({ ...input, ...generatedMaps[0] } as StorageFile);
  }

  async find(organizationId: string | null, id: string): Promise<FileRecord | undefined> {
    const row = await this.database.getRepository(StorageFile).findOneBy({ organizationId: owner(organizationId), id });
    return row ? this.toRecord(row) : undefined;
  }

  async findById(id: string): Promise<FileRecord | undefined> {
    const row = await this.database.getRepository(StorageFile).findOneBy({ id });
    return row ? this.toRecord(row) : undefined;
  }

  async delete(organizationId: string | null, id: string): Promise<void> {
    await this.database.getRepository(StorageFile).delete({ organizationId: owner(organizationId), id });
  }

  private toRecord(row: StorageFile): FileRecord {
    return {
      id: String(row.id),
      organizationId: row.organizationId === null ? null : String(row.organizationId),
      uploadedByUserId: row.uploadedByUserId === null ? null : String(row.uploadedByUserId),
      storedName: row.storedName,
      originalName: row.originalName,
      mimeType: row.mimeType,
      sizeBytes: Number(row.sizeBytes),
      createdAt: row.createdAt,
    };
  }
}

// TypeORM skips a plain null in a where clause, which would match every company: an account's files need IS NULL.
function owner(organizationId: string | null) {
  return organizationId === null ? IsNull() : organizationId;
}
