import { randomBytes } from 'node:crypto';
const ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export function generateVideoSlug(
  bytes: (size: number) => Uint8Array = randomBytes,
): string {
  let slug = '';
  while (slug.length < 12) {
    for (const byte of bytes(16)) {
      if (byte >= 248) continue;
      slug += ALPHABET[byte % 62];
      if (slug.length === 12) break;
    }
  }
  return slug;
}
