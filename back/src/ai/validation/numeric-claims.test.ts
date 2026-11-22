import { describe, expect, it } from 'vitest';
import {
  extractNumericClaims,
  hasUnsupportedNumericClaim,
  normalizeNumericClaim,
} from './numeric-claims';

describe('numeric claims', () => {
  it.each([
    ['years of experience', 'I have 8 years of experience.'],
    ['years spent building', 'I bring 5+ yrs building React products.'],
    ['a percentage', 'The measured improvement was 40%.'],
    ['an outcome delta', 'I increased signups by 30.'],
    ['a count of past work', 'I built 30 websites.'],
    ['another count of past work', 'I delivered 12 projects.'],
    ['a star rating', 'My rating is 4.9 stars.'],
    ['a fractional rating', 'I am rated 5/5.'],
    ['a review count', 'My profile has 98 reviews.'],
    ['earnings tied to an outcome', 'I generated $50,000 in revenue.'],
  ])('flags %s', (_name, candidate) => {
    expect(hasUnsupportedNumericClaim(candidate)).toBe(true);
  });

  it.each([
    ['a requested example count', 'I can share 2-3 examples.'],
    ['the client budget', 'Your budget is $100 fixed price.'],
    ['a delivery estimate', 'I can deliver in 7 days.'],
    ['technology versions', 'I work with Next.js 15, HTML5, and CSS3.'],
    ['a structural step', 'Step 1 is discovery.'],
    ['a responsive-design phrase', 'I build 100% responsive interfaces.'],
  ])('does not flag %s', (_name, candidate) => {
    expect(hasUnsupportedNumericClaim(candidate)).toBe(false);
  });

  it('closes the word-numeral spelling escape hatch', () => {
    expect(
      hasUnsupportedNumericClaim('I have eight years of experience.'),
    ).toBe(true);
    expect(
      hasUnsupportedNumericClaim('I improved client results by 97 percent.'),
    ).toBe(true);
  });

  it('accepts a credential-shaped number present in the factual inputs', () => {
    expect(
      hasUnsupportedNumericClaim('I have 5 years of experience.', {
        experience: { years: 5 },
      }),
    ).toBe(false);
    expect(
      hasUnsupportedNumericClaim('I have five years of experience.', {
        experience: { years: 5 },
      }),
    ).toBe(false);
  });

  it.each([
    ['twenty', '20'],
    ['thirty-seven', '37'],
    ['one hundred', '100'],
    ['one hundred and five', '105'],
    ['one thousand', '1000'],
  ])('normalizes %s to %s', (claim, expected) => {
    expect(normalizeNumericClaim(claim)).toBe(expected);
  });

  it('keeps the factual whitelist as every digit run', () => {
    expect(extractNumericClaims('v15 on 2026-08-24 for $50,000')).toEqual([
      '15',
      '2026',
      '8',
      '24',
      '50000',
    ]);
  });
});
