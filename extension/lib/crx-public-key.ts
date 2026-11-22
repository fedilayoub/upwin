const CHROMIUM_EXTENSION_ID = /^[a-p]{32}$/;
const BASE64_VALUE = /^[A-Za-z0-9+/]+={0,2}$/;
const PLACEHOLDER = /^(?:<.*>|placeholder|base64[_ -]?crx[_ -]?public[_ -]?key|replace(?:[_ -]?with)?[_ -]?(?:real[_ -]?)?public[_ -]?key|your[_ -]?(?:crx[_ -]?)?public[_ -]?key)$/i;

export function normalizeCrxPublicKey(value: string | undefined): string | undefined {
  const candidate = value?.trim();

  if (!candidate) return undefined;

  if (
    candidate.includes('BEGIN PUBLIC KEY') ||
    candidate.includes('END PUBLIC KEY') ||
    CHROMIUM_EXTENSION_ID.test(candidate) ||
    PLACEHOLDER.test(candidate) ||
    candidate.length < 128 ||
    candidate.length % 4 === 1 ||
    !BASE64_VALUE.test(candidate)
  ) {
    throw new Error(
      'WXT_CRX_PUBLIC_KEY must be the long, single-line base64 public key from the browser store or key generator. Leave it unset for temporary local development.',
    );
  }

  return candidate;
}
