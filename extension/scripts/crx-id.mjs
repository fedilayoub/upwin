#!/usr/bin/env node
// Derives the Chromium extension ID from a CRX public key, so the API's
// EXTENSION_ALLOWED_ORIGINS and the bucket's CORS policy can be set before the
// extension is ever loaded. The ID is the first 16 bytes of sha256(DER public key),
// hex-encoded with 0-f remapped to a-p.
//
//   pnpm crx:id                 # reads WXT_CRX_PUBLIC_KEY from the env files
//   pnpm crx:id <base64 key>    # derives from an explicit key

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const ENV_FILES = [
  '.env.development.local',
  '.env.development',
  '.env.production.local',
  '.env.production',
  '.env.local',
  '.env',
];

export function extensionIdFromPublicKey(publicKey) {
  const digest = createHash('sha256')
    .update(Buffer.from(publicKey, 'base64'))
    .digest()
    .subarray(0, 16);

  return [...digest]
    .map(
      (byte) =>
        String.fromCharCode(97 + (byte >> 4)) +
        String.fromCharCode(97 + (byte & 15)),
    )
    .join('');
}

function readConfiguredKey() {
  for (const file of ENV_FILES) {
    let contents;

    try {
      contents = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    } catch {
      continue;
    }

    const match = contents.match(/^\s*WXT_CRX_PUBLIC_KEY\s*=\s*(\S+)\s*$/m);
    if (match) return { file, key: match[1] };
  }

  return null;
}

import { pathToFileURL } from 'node:url';

// Only when run as a command: crx-keygen.mjs imports extensionIdFromPublicKey.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argumentKey = process.argv[2]?.trim();
  const source = argumentKey
    ? { file: 'command line', key: argumentKey }
    : readConfiguredKey();

  if (!source) {
    console.error(
      'No CRX public key found. Pass the base64 key as an argument, or set WXT_CRX_PUBLIC_KEY in .env.development.',
    );
    process.exit(1);
  }

  const id = extensionIdFromPublicKey(source.key);

  if (!/^[a-p]{32}$/.test(id)) {
    console.error(
      `The value in ${source.file} did not produce a valid extension ID. It must be the single-line base64 DER public key, not a PEM block or an extension ID.`,
    );
    process.exit(1);
  }

  console.log(`source   ${source.file}`);
  console.log(`id       ${id}`);
  console.log(`origin   chrome-extension://${id}`);
}
