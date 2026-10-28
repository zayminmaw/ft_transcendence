// One `storage_files` row, as the repository returns it.
export interface FileRecord {
  id: string;
  organizationId: string;
  uploadedByUserId: string | null;
  storedName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}

export type NewFile = Omit<FileRecord, 'id' | 'createdAt'>;

// What callers get back: the disk name, company and uploader stay inside the service.
export interface FileView {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}

// The parts of a Multer file the service needs (Multer's memory storage provides them).
export interface UploadedFileInput {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
