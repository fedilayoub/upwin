import { describe, expect, it } from 'vitest';
import { normalizeCrxPublicKey } from './crx-public-key';

describe('normalizeCrxPublicKey', () => {
  it('allows the key to remain unset for temporary development', () => {
    expect(normalizeCrxPublicKey(undefined)).toBeUndefined();
    expect(normalizeCrxPublicKey('')).toBeUndefined();
  });

  it.each([
    'BASE64_CRX_PUBLIC_KEY',
    'bkbnbhccfngcfkepekmhjcdgniggajoh',
    '-----BEGIN PUBLIC KEY-----value-----END PUBLIC KEY-----',
    'not-base64!',
  ])('rejects an invalid manifest key value: %s', (value) => {
    expect(() => normalizeCrxPublicKey(value)).toThrow('WXT_CRX_PUBLIC_KEY');
  });

  it('accepts a plausible single-line base64 public key', () => {
    const publicKey = 'A'.repeat(128);
    expect(normalizeCrxPublicKey(publicKey)).toBe(publicKey);
  });
});
