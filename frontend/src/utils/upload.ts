// The types the API's upload options accept (backend storage/upload-options.ts). A file is checked here first, so a
// wrong one is never sent; the server checks again.
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const PDF_TYPE = 'application/pdf';

// Why a chosen file can't be sent: not one of `types`, or larger than `maxBytes`.
export function fileProblem(file: File, types: string[], maxBytes: number): 'type' | 'size' | null {
	if (!types.includes(file.type)) return 'type';
	if (file.size > maxBytes) return 'size';
	return null;
}
