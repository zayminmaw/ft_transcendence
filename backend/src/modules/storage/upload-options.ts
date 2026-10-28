import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

// For FileInterceptor('file', <options>) in the module that owns the upload. Memory storage (Multer's default):
// StorageService picks the path. Too large → 413; another type → 400. The type is the one the client sends.
function uploadOptions(mimeTypes: string[], message: string): MulterOptions {
  return {
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    // Multer reads filenames as latin1 by default; browsers send UTF-8.
    defParamCharset: 'utf8',
    fileFilter: (_request, file, accept) => {
      if (mimeTypes.includes(file.mimetype)) accept(null, true);
      else accept(new BadRequestException(message), false);
    },
  };
}

export const imageUploadOptions = uploadOptions(
  ['image/jpeg', 'image/png', 'image/webp'],
  'Only JPEG, PNG or WebP images can be uploaded.',
);

export const documentUploadOptions = uploadOptions(
  [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  'Only PDF or Word documents can be uploaded.',
);
