import { createHmac, randomUUID } from 'node:crypto';
import { mkdir, open, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ForbiddenException, Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../common/config/environment';
import { safeEqual } from '../../common/safe-equal';
import { StorageRepository } from './storage.repository';
import type { FileRecord, FileView, UploadedFileInput } from './types/storage-file';

// Links expire on 5-minute boundaries, 10 to 15 minutes ahead, so a link stays the same URL for 5 minutes and the
// browser cache can reuse the image across refetches.
const LINK_STEP_SECONDS = 5 * 60;
const LINK_STEPS = 3;
// The folder for files of an account rather than a company. Company folders are numeric ids, so it can't clash.
const ACCOUNT_FOLDER = 'accounts';

// Keeps files on disk, one folder per company, and knows nothing about who may upload or read: the module that owns
// the record (e.g. parcels) checks its own permissions, then saves files or hands out signed links to them. Files of
// an account (a profile picture) belong to no company: the *AccountFile methods, which never reach a company's file.
@Injectable()
export class StorageService {
  private readonly root: string;
  // Derived from JWT_SECRET, so a link signature can never be mistaken for (or turned into) a token.
  private readonly signingKey: Buffer;

  constructor(private readonly files: StorageRepository, config: ConfigService<Environment, true>) {
    this.root = resolve(config.get('STORAGE_DIR', { infer: true }));
    this.signingKey = createHmac('sha256', config.get('JWT_SECRET', { infer: true })).update('storage-signed-url').digest();
  }

  save(organizationId: string, uploadedByUserId: string, file: UploadedFileInput): Promise<FileView> {
    return this.store(organizationId, uploadedByUserId, file);
  }

  // A file of the account itself, in no company (e.g. a profile picture).
  saveAccountFile(userId: string, file: UploadedFileInput): Promise<FileView> {
    return this.store(null, userId, file);
  }

  async find(organizationId: string, id: string): Promise<FileView> {
    return this.view(await this.require(organizationId, id));
  }

  // Ready to return from a controller: streams the bytes with their type and name.
  async download(organizationId: string, id: string): Promise<StreamableFile> {
    return this.stream(await this.require(organizationId, id));
  }

  // A link anyone holding it can open for 10 to 15 minutes, e.g. for <img src>. Only hand it to someone who may
  // read the file: the link itself is the permission. The company check happens here, before signing.
  async signedUrl(organizationId: string, id: string): Promise<string> {
    return this.link(await this.require(organizationId, id));
  }

  async accountFileUrl(id: string): Promise<string> {
    return this.link(await this.require(null, id));
  }

  async delete(organizationId: string, id: string): Promise<void> {
    await this.remove(await this.require(organizationId, id));
  }

  async deleteAccountFile(id: string): Promise<void> {
    await this.remove(await this.require(null, id));
  }

  // For the public signed-link route. Any bad, tampered or expired link gets the same 403. Returns the seconds the
  // link stays valid, so the browser may cache the image that long.
  async downloadSigned(id: string, exp: unknown, sig: unknown): Promise<{ file: StreamableFile; secondsLeft: number }> {
    // A malformed id or expiry cannot carry a valid signature, so no separate format check is needed.
    const expires = Number(exp);
    const secondsLeft = expires - Math.floor(Date.now() / 1000);
    if (!(secondsLeft > 0) || !safeEqual(this.sign(id, expires), sig)) {
      throw new ForbiddenException('This link is invalid or has expired.');
    }
    const record = await this.files.findById(id);
    if (!record) throw new NotFoundException('File not found.');
    return { file: await this.stream(record), secondsLeft };
  }

  // The file goes to disk under a random name first; the row only exists once the bytes do.
  private async store(organizationId: string | null, uploadedByUserId: string, file: UploadedFileInput): Promise<FileView> {
    const storedName = randomUUID();
    const path = this.pathOf(organizationId, storedName);
    await mkdir(join(this.root, organizationId ?? ACCOUNT_FOLDER), { recursive: true });
    await writeFile(path, file.buffer);
    try {
      const record = await this.files.insert({
        organizationId,
        uploadedByUserId,
        storedName,
        originalName: file.originalname.slice(0, 255),
        mimeType: file.mimetype,
        sizeBytes: file.buffer.length,
      });
      return this.view(record);
    } catch (error) {
      // A failed cleanup must not hide the insert error.
      await unlink(path).catch(() => undefined);
      throw error;
    }
  }

  private link(record: FileRecord): string {
    const expires = (Math.floor(Date.now() / 1000 / LINK_STEP_SECONDS) + LINK_STEPS) * LINK_STEP_SECONDS;
    return `/api/storage/files/${record.id}?exp=${expires}&sig=${this.sign(record.id, expires)}`;
  }

  private async remove(record: FileRecord): Promise<void> {
    // File first: if the unlink fails the row is still there, so a retry can finish the job.
    await this.removeQuietly(this.pathOf(record.organizationId, record.storedName));
    await this.files.delete(record.organizationId, record.id);
  }

  private async require(organizationId: string | null, id: string): Promise<FileRecord> {
    const record = /^[1-9]\d*$/.test(id) ? await this.files.find(organizationId, id) : undefined;
    if (!record) throw new NotFoundException('File not found.');
    return record;
  }

  private async stream(record: FileRecord): Promise<StreamableFile> {
    // Opened before any header is sent, so a missing file is still a clean 404.
    let handle;
    try {
      handle = await open(this.pathOf(record.organizationId, record.storedName), 'r');
    } catch {
      throw new NotFoundException('File not found.');
    }
    return new StreamableFile(handle.createReadStream(), {
      type: record.mimeType,
      length: record.sizeBytes,
      // filename*= is the form browsers decode, so non-ASCII names come through intact.
      disposition: `inline; filename*=UTF-8''${encodeURIComponent(record.originalName)}`,
    });
  }

  private sign(id: string, expires: number): string {
    return createHmac('sha256', this.signingKey).update(`${id}.${expires}`).digest('base64url');
  }

  // Both parts are ours (a verified company id, or the accounts folder, and a UUID), never the client's filename.
  private pathOf(organizationId: string | null, storedName: string): string {
    return join(this.root, organizationId ?? ACCOUNT_FOLDER, storedName);
  }

  private view({ id, originalName, mimeType, sizeBytes, createdAt }: FileRecord): FileView {
    return { id, originalName, mimeType, sizeBytes, createdAt };
  }

  // A file that is already gone is fine; any other error is not.
  private async removeQuietly(path: string): Promise<void> {
    try {
      await unlink(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}
