// What each type StorageService accepts must start with. The type a client sends is only a claim; these bytes are
// what makes it true, so a page or a script cannot be kept (and later served) as an image or a document.
const startsWith = (buffer: Buffer, bytes: number[], at = 0): boolean =>
  buffer.length >= at + bytes.length && bytes.every((byte, index) => buffer[at + index] === byte);
const ascii = (text: string): number[] => [...Buffer.from(text, 'ascii')];

// A Map, so a claimed type such as "constructor" or "__proto__" is simply not in it.
const SIGNATURES = new Map<string, (buffer: Buffer) => boolean>([
  ['image/jpeg', (buffer) => startsWith(buffer, [0xff, 0xd8, 0xff])],
  ['image/png', (buffer) => startsWith(buffer, [0x89, ...ascii('PNG'), 0x0d, 0x0a, 0x1a, 0x0a])],
  // RIFF, a 4-byte size, then WEBP.
  ['image/webp', (buffer) => startsWith(buffer, ascii('RIFF')) && startsWith(buffer, ascii('WEBP'), 8)],
  ['application/pdf', (buffer) => startsWith(buffer, ascii('%PDF-'))],
  // .docx is a zip archive; .doc is the older OLE compound file.
  [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    (buffer) => startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]),
  ],
  ['application/msword', (buffer) => startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])],
]);

// True when the type is one we keep and the bytes begin the way that type does.
export function matchesDeclaredType(mimeType: string, buffer: Buffer): boolean {
  return SIGNATURES.get(mimeType)?.(buffer) === true;
}
