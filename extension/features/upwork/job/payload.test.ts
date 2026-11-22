import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';
import { describe, expect, it } from 'vitest';
import { readJobFromPayload, resolveNuxtPayload } from './payload';

describe('Nuxt job payload reader', () => {
  it('resolves the devalue table and reads all three screening questions', async () => {
    const job = await readFixture('with-questions.html');

    expect(job?.questions).toEqual([
      { position: 0, question: 'Which design systems have you used?' },
      { position: 1, question: 'How do you validate accessibility?' },
      { position: 2, question: 'Describe a relevant dashboard project.' },
    ]);
    expect(job?.skills).toHaveLength(4);
  });

  it('keeps a readable absence of screening questions as an empty array', async () => {
    const job = await readFixture('without-questions.html');

    expect(job?.questions).toEqual([]);
    expect(job?.hourlyBudgetMin).toBe(15);
    expect(job?.hourlyBudgetMax).toBe(30);
  });

  it('stands alone when the body contains no job DOM', async () => {
    const job = await readFixture('payload-only.html');

    expect(job).toMatchObject({
      title: 'Synthetic Next.js conversion',
      ciphertext: '~0def456',
      workload: 'Less than 30 hrs/week',
    });
  });

  it('returns undefined for an absent or malformed script instead of throwing', async () => {
    const html = await readFile(
      new URL('__fixtures__/dom-only.html', import.meta.url),
      'utf8',
    );
    const { document } = parseHTML(html);

    expect(
      document.querySelector('#__NUXT_DATA__')?.textContent,
    ).toBeUndefined();
    expect(resolveNuxtPayload('{malformed')).toBeUndefined();
    expect(
      readJobFromPayload(resolveNuxtPayload('{malformed')),
    ).toBeUndefined();
  });

  it('copies only the explicit whitelist, including within nested objects', async () => {
    const job = await readFixture('with-questions.html');
    expect(job).toBeDefined();
    if (!job) return;

    expect(Object.keys(job).sort()).toEqual(
      [
        'activity',
        'budgetCurrency',
        'category',
        'categoryGroup',
        'ciphertext',
        'client',
        'contractorTier',
        'description',
        'durationLabel',
        'fixedBudgetAmount',
        'hourlyBudgetMax',
        'hourlyBudgetMin',
        'hourlyBudgetType',
        'postedAt',
        'projectType',
        'questions',
        'skills',
        'title',
        'workload',
      ].sort(),
    );
    expect(Object.keys(job.client).sort()).toEqual(
      [
        'avgHourlyRatePaid',
        'companySize',
        'country',
        'hires',
        'industry',
        'jobsPosted',
        'jobsWithHires',
        'paymentVerified',
        'rating',
        'reviewCount',
        'totalSpend',
      ].sort(),
    );
    expect(Object.keys(job.activity).sort()).toEqual(
      ['applicants', 'hired', 'interviewing', 'lastClientActivityAt'].sort(),
    );

    const serialized = JSON.stringify(job);
    expect(serialized).not.toContain('user-sanitized');
    expect(serialized).not.toContain('company-sanitized');
    expect(serialized).not.toContain('tracking-sanitized');
    expect(serialized).not.toContain('connectsBalance');
  });
});

async function readFixture(name: string) {
  const html = await readFile(
    new URL(`__fixtures__/${name}`, import.meta.url),
    'utf8',
  );
  const { document } = parseHTML(html);
  const json = document.querySelector('#__NUXT_DATA__')?.textContent;
  return json ? readJobFromPayload(resolveNuxtPayload(json)) : undefined;
}
