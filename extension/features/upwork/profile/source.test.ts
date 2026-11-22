import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';
import { describe, expect, it, vi } from 'vitest';
import { mapExtractedProfile } from './mapper';
import { PROFILE_SELECTORS } from './selectors';
import { UNREADABLE_PROFILE_COMPLETENESS } from './schema';
import {
  captureProfileInPage,
  extractProfileFromDocument,
  isSupportedOwnProfileUrl,
  ManualProfileSource,
  UpworkDomProfileSource,
} from './source';

const CAPTURED_AT = '2026-08-18T12:00:00.000Z';

describe('sanitized Upwork profile fixtures', () => {
  it('matches every completeness selector against the complete fixture', async () => {
    const html = await readFile(
      new URL('./__fixtures__/complete.html', import.meta.url),
      'utf8',
    );
    const { document } = parseHTML(html);
    const result = extractProfileFromDocument(
      PROFILE_SELECTORS,
      document as unknown as Document,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      mapExtractedProfile(result.raw, CAPTURED_AT).snapshot.completeness,
    ).toEqual({
      hasIntroVideo: true,
      hasProfilePhoto: true,
      availabilityBadge: true,
      hoursPerWeek: 'As Needed - Open to Offers',
      avgResponseTime: '12-24 hours',
      idVerified: true,
      verifications: ['ID'],
      licenses: 0,
      linkedAccounts: ['GitHub'],
    });
  });

  it('extracts and normalizes a complete profile without HTML', async () => {
    const result = await extractFixture('complete.html');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const capture = mapExtractedProfile(result.raw, CAPTURED_AT);

    expect(capture.snapshot).toMatchObject({
      source: 'upwork',
      capturedAt: CAPTURED_AT,
      completeness: {
        hasIntroVideo: true,
        hasProfilePhoto: true,
        availabilityBadge: true,
        hoursPerWeek: 'As Needed - Open to Offers',
        avgResponseTime: '12-24 hours',
        idVerified: true,
        verifications: ['ID'],
        licenses: 0,
        linkedAccounts: ['GitHub'],
      },
      profile: {
        name: 'Sample Freelancer',
        title: 'Sample Profile Title',
        overview: 'Sample overview prose for parser testing.',
        hourlyRate: 75,
        skills: ['Sample Skill Alpha', 'Sample Skill Beta'],
        portfolio: [
          {
            title: 'Sample Portfolio Project',
            skills: [],
          },
        ],
        employment: [
          {
            title: 'Sample Employment Role | Sample Company',
            period: 'January 2024 - Present',
            description: 'Sample employment prose for parser testing.',
          },
        ],
        education: [
          {
            school: 'Sample University',
            degree: 'Sample Degree',
          },
        ],
        certifications: [
          {
            name: 'Sample Certification',
            issuer: 'Provider: Sample Issuer',
            year: 'Issued: January 2026',
          },
        ],
        languages: [
          {
            name: 'Sample Language',
            proficiency: 'Sample Proficiency',
          },
        ],
      },
    });
    expect(capture.snapshot.profile.education[0]?.period).toBeUndefined();
    expect(JSON.stringify(capture.snapshot)).not.toContain('<');
  });

  it('distinguishes readable absence from selector drift', async () => {
    const absentResult = await extractFixture('missing-completeness.html');
    expect(absentResult.ok).toBe(true);
    if (!absentResult.ok) return;

    const absent = mapExtractedProfile(
      absentResult.raw,
      CAPTURED_AT,
    ).snapshot.completeness;
    expect(absent).toEqual({
      hasIntroVideo: false,
      hasProfilePhoto: false,
      availabilityBadge: false,
      hoursPerWeek: undefined,
      avgResponseTime: undefined,
      idVerified: false,
      verifications: [],
      licenses: 0,
      linkedAccounts: [],
    });

    const unreadableResult = await extractFixture('no-portfolio.html');
    expect(unreadableResult.ok).toBe(true);
    if (!unreadableResult.ok) return;

    expect(
      mapExtractedProfile(unreadableResult.raw, CAPTURED_AT).snapshot
        .completeness,
    ).toEqual(UNREADABLE_PROFILE_COMPLETENESS);
  });

  it('keeps education and languages empty when the captured page omits them', async () => {
    const result = await extractFixture('no-portfolio.html');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const profile = mapExtractedProfile(result.raw, CAPTURED_AT).snapshot.profile;
    expect(profile.education).toEqual([]);
    expect(profile.languages).toEqual([]);
  });

  it('keeps an absent portfolio as a present empty array', async () => {
    const result = await extractFixture('no-portfolio.html');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      mapExtractedProfile(result.raw, CAPTURED_AT).snapshot.profile.portfolio,
    ).toEqual([]);
  });

  it('degrades a missing overview to undefined', async () => {
    const result = await extractFixture('missing-overview.html');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      mapExtractedProfile(result.raw, CAPTURED_AT).snapshot.profile.overview,
    ).toBeUndefined();
  });

  it('keeps the paragraphs and bullet lines of a formatted overview', async () => {
    const html = (
      await readFile(
        new URL('__fixtures__/complete.html', import.meta.url),
        'utf8',
      )
    ).replace(
      'Sample overview prose for parser testing.',
      [
        'I help SaaS teams   ship products.',
        '',
        '',
        '',
        'What you can expect:',
        '\t• A product that ships.<br>• Clean, documented code.  ',
      ].join('\n'),
    );
    const { document } = parseHTML(html);
    const result = extractProfileFromDocument(
      PROFILE_SELECTORS,
      document as unknown as Document,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      mapExtractedProfile(result.raw, CAPTURED_AT).snapshot.profile.overview,
    ).toBe(
      [
        'I help SaaS teams ship products.',
        '',
        'What you can expect:',
        '• A product that ships.',
        '• Clean, documented code.',
      ].join('\n'),
    );
  });

  it('does not throw when a selector disappears', async () => {
    const result = await extractFixture('changed-markup.html');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      mapExtractedProfile(result.raw, CAPTURED_AT).snapshot.profile.title,
    ).toBeUndefined();
  });

  it('never relies on Vue scoped-style hashes', () => {
    expect(JSON.stringify(PROFILE_SELECTORS)).not.toContain('data-v-');
  });
});

describe('UpworkDomProfileSource', () => {
  it('uses one injection for a user-triggered capture', async () => {
    const executeScript = vi.fn().mockResolvedValue([
      {
        result: {
          ok: true,
          raw: {
            name: 'Sample Freelancer',
            skills: [],
            portfolio: [],
            employment: [],
            education: [],
            certifications: [],
            languages: [],
            completeness: UNREADABLE_PROFILE_COMPLETENESS,
          },
        },
      },
    ]);
    const source = new UpworkDomProfileSource(
      {
        tabs: {
          query: vi
            .fn()
            .mockResolvedValue([
              { id: 42, url: 'https://www.upwork.com/freelancers/~012345' },
            ]),
          sendMessage: noLauncher(),
        },
        scripting: { executeScript },
      },
      () => new Date(CAPTURED_AT),
    );

    await expect(source.capture()).resolves.toMatchObject({
      source: 'upwork',
      capturedAt: CAPTURED_AT,
    });
    expect(executeScript).toHaveBeenCalledOnce();
    expect(executeScript.mock.calls[0]?.[0]).toMatchObject({
      target: { tabId: 42 },
      args: [PROFILE_SELECTORS],
    });
  });

  it('rejects unsupported URLs before injecting', async () => {
    const executeScript = vi.fn();
    const source = new UpworkDomProfileSource({
      tabs: {
        query: vi
          .fn()
          .mockResolvedValue([{ id: 42, url: 'https://example.com/profile' }]),
        sendMessage: noLauncher(),
      },
      scripting: { executeScript },
    });

    await expect(source.capture()).rejects.toMatchObject({
      code: 'UNSUPPORTED_PAGE',
    });
    expect(executeScript).not.toHaveBeenCalled();
  });

  it('requires an own-profile marker inside the injected document', async () => {
    const source = new UpworkDomProfileSource({
      tabs: {
        query: vi
          .fn()
          .mockResolvedValue([
            { id: 42, url: 'https://www.upwork.com/freelancers/~otherprofile' },
          ]),
        sendMessage: noLauncher(),
      },
      scripting: {
        executeScript: vi
          .fn()
          .mockResolvedValue([
            { result: { ok: false, reason: 'unsupported-page' } },
          ]),
      },
    });

    // The URL matched and the script ran, so this is selector drift rather than
    // the user being on the wrong page. Conflating the two hides the real cause.
    await expect(source.capture()).rejects.toMatchObject({
      code: 'OWN_PROFILE_NOT_DETECTED',
    });
  });

  it('reports an unsupported page when the URL itself does not match', async () => {
    const executeScript = vi.fn();
    const source = new UpworkDomProfileSource({
      tabs: {
        query: vi
          .fn()
          .mockResolvedValue([{ id: 42, url: 'https://www.upwork.com/nx/find-work/' }]),
        sendMessage: noLauncher(),
      },
      scripting: { executeScript },
    });

    await expect(source.capture()).rejects.toMatchObject({
      code: 'UNSUPPORTED_PAGE',
    });
    expect(executeScript).not.toHaveBeenCalled();
  });
});

describe('UpworkDomProfileSource through the launcher', () => {
  it('captures without activeTab when the tab URL is scrubbed', async () => {
    const { document } = parseHTML(
      await readFile(
        new URL('./__fixtures__/complete.html', import.meta.url),
        'utf8',
      ),
    );
    const sendMessage = vi.fn().mockResolvedValue(
      captureProfileInPage(
        'https://www.upwork.com/freelancers/~012345',
        new Date(CAPTURED_AT),
        'page-request',
        document as unknown as Document,
      ),
    );
    const executeScript = vi.fn();
    const source = new UpworkDomProfileSource({
      tabs: { query: vi.fn().mockResolvedValue([{ id: 42 }]), sendMessage },
      scripting: { executeScript },
    });

    await expect(source.capture()).resolves.toMatchObject({
      source: 'upwork',
      capturedAt: CAPTURED_AT,
    });
    expect(sendMessage.mock.calls[0]?.[0]).toBe(42);
    expect(sendMessage.mock.calls[0]?.[1]).toMatchObject({
      type: 'CAPTURE_PROFILE',
    });
    expect(executeScript).not.toHaveBeenCalled();
  });

  it('reads the own profile on the username URL Upwork rewrites to', async () => {
    const { document } = parseHTML(
      await readFile(
        new URL('./__fixtures__/complete.html', import.meta.url),
        'utf8',
      ),
    );

    expect(
      captureProfileInPage(
        'https://www.upwork.com/freelancers/sample-freelancer',
        new Date(CAPTURED_AT),
        'page-request',
        document as unknown as Document,
      ),
    ).toMatchObject({
      ok: true,
      data: { snapshot: { source: 'upwork' } },
    });
  });

  it('passes the page answer through when the launcher is not on a profile', async () => {
    const source = new UpworkDomProfileSource({
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 42 }]),
        sendMessage: vi.fn().mockResolvedValue(
          captureProfileInPage(
            'https://www.upwork.com/nx/find-work/',
            new Date(CAPTURED_AT),
            'page-request',
          ),
        ),
      },
      scripting: { executeScript: vi.fn() },
    });

    await expect(source.capture()).rejects.toMatchObject({
      code: 'UNSUPPORTED_PAGE',
    });
  });
});

function noLauncher() {
  return vi
    .fn()
    .mockRejectedValue(
      new Error('Could not establish connection. Receiving end does not exist.'),
    );
}

describe('ProfileSource implementations', () => {
  it('recognizes only supported own-profile URL shapes', () => {
    expect(
      isSupportedOwnProfileUrl('https://www.upwork.com/freelancers/~012345'),
    ).toBe(true);
    // Upwork rewrites the ~01 link to the username form after load.
    expect(
      isSupportedOwnProfileUrl('https://www.upwork.com/freelancers/sample-freelancer'),
    ).toBe(true);
    expect(
      isSupportedOwnProfileUrl(
        'https://www.upwork.com/freelancers/jane_doe-2?viewMode=1',
      ),
    ).toBe(true);
    // The settings page carries no own-profile markers.
    expect(
      isSupportedOwnProfileUrl(
        'https://www.upwork.com/freelancers/settings/profile',
      ),
    ).toBe(false);
    expect(
      isSupportedOwnProfileUrl('https://www.upwork.com/freelancers/settings'),
    ).toBe(false);
    expect(
      isSupportedOwnProfileUrl('https://www.upwork.com/freelancers/a/b'),
    ).toBe(false);
    expect(isSupportedOwnProfileUrl('https://www.upwork.com/freelancers/')).toBe(
      false,
    );
    expect(
      isSupportedOwnProfileUrl('http://www.upwork.com/freelancers/~012345'),
    ).toBe(false);
    expect(
      isSupportedOwnProfileUrl('https://evil.example/freelancers/~012345'),
    ).toBe(false);
  });

  it('accepts either profile spelling in any case, with a query or hash', () => {
    expect(
      isSupportedOwnProfileUrl('https://www.upwork.com/freelancers/~01AbCdEf'),
    ).toBe(true);
    expect(
      isSupportedOwnProfileUrl(
        'https://upwork.com/freelancers/Jane_Doe-2/?viewMode=1#about',
      ),
    ).toBe(true);
    for (const url of [
      undefined,
      'not a url',
      'https://www.upwork.com/nx/find-work/',
    ]) {
      expect(isSupportedOwnProfileUrl(url)).toBe(false);
    }
  });

  it('provides a validated manual source without a future API stub', async () => {
    const source = new ManualProfileSource(
      {
        title: 'Manual profile',
        skills: [],
        portfolio: [],
        employment: [],
        education: [],
        certifications: [],
        languages: [],
      },
      () => new Date(CAPTURED_AT),
    );

    await expect(source.isAvailable()).resolves.toBe(true);
    await expect(source.capture()).resolves.toMatchObject({ source: 'manual' });
  });
});

async function extractFixture(name: string) {
  const html = await readFile(
    new URL(`__fixtures__/${name}`, import.meta.url),
    'utf8',
  );
  const { document } = parseHTML(html);

  return extractProfileFromDocument(
    PROFILE_SELECTORS,
    document as unknown as Document,
  );
}
