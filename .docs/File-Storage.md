# File storage

How to save, serve and delete uploaded files (parcel photos, documents, avatars, …) from a backend module.

## What the storage module does and does not do

`StorageModule` (`backend/src/modules/storage`) keeps files on disk, one folder per company, and records each one in the `storage_files` table. It **does not check permissions**: it has no upload route and no idea who may read a file. The module that owns the file (e.g. parcels) checks its own permission in its controller, then calls `StorageService`.

- Files live under `STORAGE_DIR/<organizationId>/<random UUID>`. In Docker that is `/app/storage`, on the `uploads_data` volume; locally it defaults to `backend/storage`.
- The client's filename is only kept as `originalName` for display and download; it is never part of the path.
- Every method except the signed-link route takes the `organizationId`, so one company can never reach another company's file.

## 1. Import the module

```ts
import { StorageModule } from '../storage';

@Module({
  imports: [StorageModule],
  // ...
})
export class ParcelsModule {}
```

Import everything from `../storage` (its `index.ts`), not from files inside it: `StorageService`, `FileView`, `UploadedFileInput`, `imageUploadOptions`, `documentUploadOptions`.

## 2. Accept the upload in your controller

Use Multer's `FileInterceptor` with one of the ready-made option sets. They keep the file in memory, allow one file of at most 10 MB, and reject other types:

| Options | Allowed types | Errors |
| --- | --- | --- |
| `imageUploadOptions` | JPEG, PNG, WebP | 413 if too large, 400 for another type |
| `documentUploadOptions` | PDF, Word (`.doc`, `.docx`) | 413 if too large, 400 for another type |

```ts
import { BadRequestException, Controller, Param, Post, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { imageUploadOptions, type UploadedFileInput } from '../storage';

@Controller('parcels')
export class ParcelsController {
  constructor(private readonly parcels: ParcelsService) {}

  @Post(':parcelId/photo')
  @RequirePermission('parcels.update') // your module's own permission check
  @UseInterceptors(FileInterceptor('file', imageUploadOptions))
  uploadPhoto(
    @Param('parcelId') parcelId: string,
    @UploadedFile() file: UploadedFileInput | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!file) throw new BadRequestException('Choose a file to upload.');
    return this.parcels.setPhoto(request.tenant!.organizationId, request.user!.id, parcelId, file);
  }
}
```

The frontend sends `multipart/form-data` with the file in a field named `file`, plus the usual `X-Organization-Id` header.

The allowed type is the one the client claims (`Content-Type` of the part), not sniffed from the bytes. That is fine because files are only served back with that same type and never executed.

## 3. Save it and keep the id

```ts
const saved = await this.storage.save(organizationId, userId, file);
// saved: { id, originalName, mimeType, sizeBytes, createdAt }
```

Store `saved.id` on your own row (e.g. `parcels.photo_file_id`). The file is written to disk first and the row inserted after; if the insert fails, the file is removed again.

## 4. Give the file back to the browser

There are two ways. Pick by how the browser will use it.

### Signed link — for `<img src>`, `<a href>` and previews

```ts
const url = await this.storage.signedUrl(organizationId, fileId);
// "/api/storage/files/42?exp=1792627500&sig=…"
```

Return this URL in your API response (e.g. `photoUrl`). Anyone holding it can open the file for **10 to 15 minutes**, with no login or company header, which is what lets a plain `<img src>` work. **The link itself is the permission**, so only create one for a user who is allowed to see the file.

Links are rounded to 5-minute steps, so asking again within those 5 minutes returns the same URL and the browser can reuse its cached image. When a link expires, fetch your resource again to get a fresh one.

### Download through your own route — when every request must be checked

```ts
@Get(':parcelId/photo')
@RequirePermission('parcels.view')
async photo(@Param('parcelId') parcelId: string, @Req() request: AuthenticatedRequest) {
  const fileId = await this.parcels.photoFileId(request.tenant!.organizationId, parcelId);
  return this.storage.download(request.tenant!.organizationId, fileId);
}
```

`download()` returns a `StreamableFile` with the right `Content-Type`, `Content-Length` and filename, so return it as is. This needs the normal auth headers, so the frontend has to `fetch` it rather than use `<img src>`.

## 5. Other methods

| Method | Use |
| --- | --- |
| `find(organizationId, id)` | The file's details (`FileView`) without its bytes. |
| `delete(organizationId, id)` | Removes the file from disk, then its row. Clear your own reference to it first (or in the same flow). |

Every method throws `404 File not found.` when the id does not exist or belongs to another company.

## Rules

- Check your own permission before calling `StorageService`; the storage module never does.
- Always pass `request.tenant!.organizationId`, never a company id from the request body or URL.
- Keep the file `id` on your row, never a path or a signed URL (signed URLs expire).
- When you delete your record, also call `storage.delete()` for its files, or they stay on disk.
