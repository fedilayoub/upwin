#!/usr/bin/env node
// Generates a key pair that pins this extension's id, so its origin
// (chrome-extension://<id>) stays the same on every machine and reinstall.
//
//   pnpm crx:keygen
//
// Writes the private key to .crx-key.pem (gitignored; only needed to sign a
// .crx yourself) and prints the two lines to copy:
//   - WXT_CRX_PUBLIC_KEY for this extension's .env.local
//   - EXTENSION_ALLOWED_ORIGINS for the API's .env
// Without a pinned key, an unpacked extension's id depends on its folder path.

import { generateKeyPairSync } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { extensionIdFromPublicKey } from './crx-id.mjs';

const privateKeyFile = new URL('../.crx-key.pem', import.meta.url);

if (existsSync(privateKeyFile)) {
  console.error(
    '.crx-key.pem already exists. Delete it first to make a new id; every allowlist then needs the new origin.',
  );
  process.exit(1);
}

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'der' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

writeFileSync(privateKeyFile, privateKey, { mode: 0o600 });

const base64 = Buffer.from(publicKey).toString('base64');
const origin = `chrome-extension://${extensionIdFromPublicKey(base64)}`;

console.log(`Private key written to .crx-key.pem (keep it; never commit it).

Add to this extension's .env.local:
WXT_CRX_PUBLIC_KEY=${base64}

Add to the API's .env (comma-separate several):
EXTENSION_ALLOWED_ORIGINS=${origin}
`);
