import { describe, expect, it } from 'vitest';
import {
  canonicalJobUrl,
  isSupportedJobUrl,
  jobCiphertextFromUrl,
} from './url';

describe('Upwork job URL matching', () => {
  it('accepts the captured job path with its normal referrer query', () => {
    const url =
      'https://www.upwork.com/jobs/~0abc123?referrer_url_path=/best-matches/details/~0abc123';

    expect(isSupportedJobUrl(url)).toBe(true);
    expect(jobCiphertextFromUrl(url)).toBe('~0abc123');
  });

  it('accepts the bare hostname and hexadecimal ciphertext', () => {
    expect(isSupportedJobUrl('https://upwork.com/jobs/~0aBc123')).toBe(true);
    expect(jobCiphertextFromUrl('https://upwork.com/jobs/~0aBc123')).toBe(
      '~0aBc123',
    );
  });

  it('accepts the slugged path that job search links to', () => {
    const url =
      'https://www.upwork.com/jobs/span-class-highlight-Frontend-span-Developer-SaaS-Product_~022119921902377072596/?referrer_url_path=%2Fnx%2Fsearch%2Fjobs%2F';

    expect(isSupportedJobUrl(url)).toBe(true);
    expect(jobCiphertextFromUrl(url)).toBe('~022119921902377072596');
  });

  it('builds the canonical URL from a ciphertext', () => {
    expect(canonicalJobUrl('~0abc123')).toBe(
      'https://www.upwork.com/jobs/~0abc123',
    );
  });

  it('rejects unverified routes, origins, protocols, and malformed ids', () => {
    expect(
      isSupportedJobUrl(
        'https://www.upwork.com/best-matches/details/~0abc123',
      ),
    ).toBe(false);
    expect(
      isSupportedJobUrl(
        'https://www.upwork.com/nx/proposals/job/~0abc123/apply',
      ),
    ).toBe(false);
    expect(
      isSupportedJobUrl('https://evil.example/jobs/~0abc123'),
    ).toBe(false);
    expect(
      isSupportedJobUrl('http://www.upwork.com/jobs/~0abc123'),
    ).toBe(false);
    expect(isSupportedJobUrl('https://www.upwork.com/jobs/~123')).toBe(false);
    expect(
      isSupportedJobUrl('https://www.upwork.com/jobs/Some-Title~0abc123'),
    ).toBe(false);
    expect(
      isSupportedJobUrl('https://www.upwork.com/jobs/a/b_~0abc123'),
    ).toBe(false);
    expect(
      isSupportedJobUrl(
        'https://www.upwork.com/nx/search/jobs/details/~0abc123',
      ),
    ).toBe(false);
    expect(jobCiphertextFromUrl('not a url')).toBeUndefined();
  });
});
