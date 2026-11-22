import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';
import { describe, expect, it, vi } from 'vitest';
import { JOB_SELECTORS } from './selectors';
import {
  captureJobInPage,
  extractJobFromDocument,
  ManualJobSource,
  UpworkDomJobSource,
} from './source';

const CAPTURED_AT = '2026-08-23T12:00:00.000Z';

describe('sanitized Upwork job fixtures', () => {
  it('reads the measured DOM fields and keeps skill relevance', async () => {
    const result = await extractFixture('with-questions.html');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.dom).toMatchObject({
      title: 'Synthetic SaaS redesign',
      questions: [
        'Which design systems have you used?',
        'How do you validate accessibility?',
        'Describe a relevant dashboard project.',
      ],
      workload: 'Less than 30 hrs/week',
      durationLabel: '1 to 3 months',
      experienceLevel: 'Intermediate',
    });
    expect(result.dom.description?.replace(/\s+/gu, ' ').trim()).toBe(
      'Redesign a synthetic SaaS dashboard and public website with accessible responsive components.',
    );
    expect(result.dom.skills).toEqual([
      { name: 'Web Design', relevanceLabel: 'Mandatory skills' },
      { name: 'HTML5', relevanceLabel: 'Mandatory skills' },
      { name: 'Web Development', relevanceLabel: 'Nice-to-have skills' },
      { name: 'JavaScript', relevanceLabel: 'Nice-to-have skills' },
    ]);
  });

  it('matches either duration suffix and scopes facts away from the client sidebar', async () => {
    const result = await extractFixture('without-questions.html');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.dom.durationLabel).toBe('Less than 1 month');
    expect(result.dom.workload).toBe('Less than 30 hrs/week');
    expect(result.dom.workload).not.toContain('999');
    expect(result.dom.questions).toEqual([]);
  });

  it('degrades one missing selector to undefined without throwing', async () => {
    const html = await fixtureHtml('dom-only.html');
    const { document } = parseHTML(html);
    document.querySelector('h4 > span.flex-1')?.remove();

    const result = extractJobFromDocument(
      JOB_SELECTORS,
      document as unknown as Document,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dom.title).toBeUndefined();
    expect(result.dom.description).toContain('Convert supplied synthetic');
  });

  it('never relies on Vue scoped-style hashes', () => {
    expect(JSON.stringify(JOB_SELECTORS)).not.toContain('data-v-');
  });
});

describe('UpworkDomJobSource', () => {
  it('uses exactly one injection and marks a payload capture', async () => {
    const extracted = await extractFixture('with-questions.html');
    const executeScript = vi.fn().mockResolvedValue([{ result: extracted }]);
    const source = new UpworkDomJobSource(
      {
        tabs: {
          query: vi.fn().mockResolvedValue([
            {
              id: 42,
              url: 'https://www.upwork.com/jobs/~0abc123?referrer_url_path=/best-matches/details/~0abc123',
            },
          ]),
          sendMessage: noLauncher(),
        },
        scripting: { executeScript },
      },
      () => new Date(CAPTURED_AT),
    );

    const capture = await source.captureWithMetadata();

    expect(capture.snapshot.source).toBe('upwork-payload');
    expect(capture.snapshot.job.questions).toHaveLength(3);
    expect(capture.snapshot.job.engagement.hourlyBudget).toBeUndefined();
    expect(executeScript).toHaveBeenCalledOnce();
    expect(executeScript.mock.calls[0]?.[0]).toMatchObject({
      target: { tabId: 42 },
      args: [JOB_SELECTORS],
    });
  });

  it('falls back to the DOM with no invented budget', async () => {
    const extracted = await extractFixture('dom-only.html');
    const executeScript = vi.fn().mockResolvedValue([{ result: extracted }]);
    const source = new UpworkDomJobSource(
      {
        tabs: {
          query: vi
            .fn()
            .mockResolvedValue([
              { id: 42, url: 'https://www.upwork.com/jobs/~0def456' },
            ]),
          sendMessage: noLauncher(),
        },
        scripting: { executeScript },
      },
      () => new Date(CAPTURED_AT),
    );

    const snapshot = await source.capture();

    expect(snapshot.source).toBe('upwork-dom');
    expect(snapshot.job.engagement).toMatchObject({
      budgetType: 'unknown',
      durationLabel: 'Less than 1 month',
      experienceLevel: 'intermediate',
    });
    expect(snapshot.job.engagement.hourlyBudget).toBeUndefined();
    expect(executeScript).toHaveBeenCalledOnce();
  });

  it('rejects an unsupported URL before any injection', async () => {
    const executeScript = vi.fn();
    const source = new UpworkDomJobSource({
      tabs: {
        query: vi.fn().mockResolvedValue([
          {
            id: 42,
            url: 'https://www.upwork.com/best-matches/details/~0def456',
          },
        ]),
        sendMessage: noLauncher(),
      },
      scripting: { executeScript },
    });

    await expect(source.capture()).rejects.toMatchObject({
      code: 'UNSUPPORTED_PAGE',
    });
    expect(executeScript).not.toHaveBeenCalled();
  });

  it('reports a missing in-page marker as JOB_NOT_DETECTED', async () => {
    const executeScript = vi
      .fn()
      .mockResolvedValue([
        { result: { ok: false, reason: 'unsupported-page' } },
      ]);
    const source = new UpworkDomJobSource({
      tabs: {
        query: vi
          .fn()
          .mockResolvedValue([
            { id: 42, url: 'https://www.upwork.com/jobs/~0def456' },
          ]),
        sendMessage: noLauncher(),
      },
      scripting: { executeScript },
    });

    await expect(source.capture()).rejects.toMatchObject({
      code: 'JOB_NOT_DETECTED',
    });
  });

  it('stores the canonical URL when the tab is on the slugged path', async () => {
    const extracted = await extractFixture('dom-only.html');
    const source = new UpworkDomJobSource(
      {
        tabs: {
          query: vi.fn().mockResolvedValue([
            {
              id: 42,
              url: 'https://www.upwork.com/jobs/Synthetic-Title_~0def456/?referrer_url_path=%2Fnx%2Fsearch%2Fjobs%2F',
            },
          ]),
          sendMessage: noLauncher(),
        },
        scripting: {
          executeScript: vi.fn().mockResolvedValue([{ result: extracted }]),
        },
      },
      () => new Date(CAPTURED_AT),
    );

    const snapshot = await source.capture();

    expect(snapshot.job.ciphertext).toBe('~0def456');
    expect(snapshot.job.url).toBe('https://www.upwork.com/jobs/~0def456');
  });

  it('captures through the launcher when the tab URL is scrubbed (no activeTab)', async () => {
    const { document } = parseHTML(await fixtureHtml('with-questions.html'));
    const pageResponse = captureJobInPage(
      'https://www.upwork.com/jobs/Synthetic-Title_~0abc123/',
      new Date(CAPTURED_AT),
      'page-request',
      document as unknown as Document,
    );
    const sendMessage = vi.fn().mockResolvedValue(pageResponse);
    const executeScript = vi.fn();
    const source = new UpworkDomJobSource({
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 42 }]),
        sendMessage,
      },
      scripting: { executeScript },
    });

    const capture = await source.captureWithMetadata();

    expect(capture.snapshot.job.ciphertext).toBe('~0abc123');
    expect(capture.snapshot.job.url).toBe(
      'https://www.upwork.com/jobs/~0abc123',
    );
    expect(capture.snapshot.job.questions).toHaveLength(3);
    expect(sendMessage).toHaveBeenCalledOnce();
    expect(sendMessage.mock.calls[0]?.[0]).toBe(42);
    expect(sendMessage.mock.calls[0]?.[1]).toMatchObject({ type: 'CAPTURE_JOB' });
    expect(executeScript).not.toHaveBeenCalled();
  });

  it('passes a launcher capture error through without injecting', async () => {
    const executeScript = vi.fn();
    const source = new UpworkDomJobSource({
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 42 }]),
        sendMessage: vi.fn().mockResolvedValue(
          captureJobInPage(
            'https://www.upwork.com/nx/search/jobs/details/~0abc123',
            new Date(CAPTURED_AT),
            'page-request',
          ),
        ),
      },
      scripting: { executeScript },
    });

    await expect(source.capture()).rejects.toMatchObject({
      code: 'UNSUPPORTED_PAGE',
    });
    expect(executeScript).not.toHaveBeenCalled();
  });

  it('rejects a launcher answer that is not a valid capture', async () => {
    const source = new UpworkDomJobSource({
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 42 }]),
        sendMessage: vi.fn().mockResolvedValue({
          data: { snapshot: {} },
          ok: true,
          requestId: 'page-request',
        }),
      },
      scripting: { executeScript: vi.fn() },
    });

    await expect(source.capture()).rejects.toMatchObject({
      code: 'JOB_CAPTURE_FAILED',
    });
  });
});

describe('captureJobInPage', () => {
  it('reports a page without the job marker as JOB_NOT_DETECTED', () => {
    const { document } = parseHTML('<html><body><main></main></body></html>');

    expect(
      captureJobInPage(
        'https://www.upwork.com/jobs/~0abc123',
        new Date(CAPTURED_AT),
        'page-request',
        document as unknown as Document,
      ),
    ).toMatchObject({ ok: false, error: { code: 'JOB_NOT_DETECTED' } });
  });
});

describe('ManualJobSource', () => {
  it('provides a validated manual source without an API-source stub', async () => {
    const source = new ManualJobSource(
      {
        ciphertext: '~0def456',
        url: 'https://www.upwork.com/jobs/~0def456',
        title: 'Manual job',
        description: 'Manual description',
        engagement: { budgetType: 'unknown' },
        skills: [],
        questions: [],
        client: { paymentVerified: null },
        activity: {},
      },
      () => new Date(CAPTURED_AT),
    );

    await expect(source.isAvailable()).resolves.toBe(true);
    await expect(source.capture()).resolves.toMatchObject({ source: 'manual' });
  });
});

function noLauncher() {
  return vi
    .fn()
    .mockRejectedValue(
      new Error('Could not establish connection. Receiving end does not exist.'),
    );
}

async function extractFixture(name: string) {
  const { document } = parseHTML(await fixtureHtml(name));
  return extractJobFromDocument(JOB_SELECTORS, document as unknown as Document);
}

async function fixtureHtml(name: string): Promise<string> {
  return readFile(new URL(`__fixtures__/${name}`, import.meta.url), 'utf8');
}
