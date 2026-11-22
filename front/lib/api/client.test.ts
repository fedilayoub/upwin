import { describe, expect, it, vi } from 'vitest';
import { BackendApiClient } from '@/lib/api/client';

describe('BackendApiClient', () => {
  it('sends no Authorization header when the API has no token', async () => {
    const fetcher = vi.fn<
      (input: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(async () => Response.json([]));
    const client = new BackendApiClient({
      baseUrl: 'http://localhost:3002',
      fetcher,
    });

    await client.listGoals();

    const [, init] = fetcher.mock.calls[0];
    expect(new Headers(init?.headers).has('Authorization')).toBe(false);
  });

  it('sends the API token as a bearer without browser credentials', async () => {
    const fetcher = vi.fn<
      (input: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(async () => Response.json([]));
    const client = new BackendApiClient({
      baseUrl: 'http://localhost:3002/',
      token: 'local-api-token',
      fetcher,
    });

    await client.listGoals();

    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('http://localhost:3002/goals');
    expect(init?.credentials).toBe('omit');
    expect(new Headers(init?.headers).get('Authorization')).toBe(
      'Bearer local-api-token',
    );
  });

  it('surfaces the backend error envelope message and code', async () => {
    const fetcher = vi.fn<
      (input: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(async () =>
      Response.json(
        {
          error: {
            code: 'CONTEXT_INCOMPLETE',
            message: 'Add freelancer details before confirming this context.',
          },
        },
        { status: 409 },
      ),
    );
    const client = new BackendApiClient({
      baseUrl: 'http://localhost:3002',
      token: 'local-api-token',
      fetcher,
    });

    const request = client.confirmFreelancerContext();

    await expect(request).rejects.toMatchObject({
      code: 'CONTEXT_INCOMPLETE',
      message: 'Add freelancer details before confirming this context.',
      status: 409,
    });
  });

  it('accepts an empty 204 response when deleting freelancer context', async () => {
    const fetcher = vi.fn<
      (input: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(async () => new Response(null, { status: 204 }));
    const client = new BackendApiClient({
      baseUrl: 'http://localhost:3002',
      token: 'local-api-token',
      fetcher,
    });

    await expect(client.deleteFreelancerContext()).resolves.toBeUndefined();
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('http://localhost:3002/freelancer-context');
    expect(init?.method).toBe('DELETE');
  });

  it('uses the typed prompt-console endpoints for every admin operation', async () => {
    const fetcher = vi.fn<
      (input: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(async (input) => {
      const url = String(input);
      if (url.endsWith('/reset')) return Response.json({ active: null });
      if (url.endsWith('/revisions')) return Response.json([]);
      return Response.json({});
    });
    const client = new BackendApiClient({
      baseUrl: 'http://localhost:3002',
      token: 'local-api-token',
      fetcher,
    });
    const content = {
      systemPersona: 'Persona',
      policy: 'Policy',
      goalStrategies: {
        'first-client': 'First',
        'more-clients': 'More',
        'more-responses': 'Responses',
        'higher-paying-projects': 'Higher',
        scale: 'Scale',
      },
      criterionAnchors: {},
    };

    await client.getPromptConsole('profileAnalyzer');
    await client.listPromptRevisions('profileAnalyzer');
    await client.createPromptDraft('profileAnalyzer', { content, notes: null });
    await client.updatePromptDraft('profileAnalyzer', 'revision/id', {
      content,
      notes: 'Changed',
    });
    await client.previewPromptRevision('profileAnalyzer', 'revision/id');
    await client.dryRunPromptRevision('profileAnalyzer', 'revision/id');
    await client.activatePromptRevision('profileAnalyzer', 'revision/id');
    await client.resetPromptCapability('profileAnalyzer');

    expect(
      fetcher.mock.calls.map(([url, init]) => [String(url), init?.method]),
    ).toEqual([
      ['http://localhost:3002/admin/prompts/profileAnalyzer', 'GET'],
      [
        'http://localhost:3002/admin/prompts/profileAnalyzer/revisions',
        'GET',
      ],
      [
        'http://localhost:3002/admin/prompts/profileAnalyzer/revisions',
        'POST',
      ],
      [
        'http://localhost:3002/admin/prompts/profileAnalyzer/revisions/revision%2Fid',
        'PATCH',
      ],
      [
        'http://localhost:3002/admin/prompts/profileAnalyzer/revisions/revision%2Fid/preview',
        'POST',
      ],
      [
        'http://localhost:3002/admin/prompts/profileAnalyzer/revisions/revision%2Fid/dry-run',
        'POST',
      ],
      [
        'http://localhost:3002/admin/prompts/profileAnalyzer/revisions/revision%2Fid/activate',
        'POST',
      ],
      [
        'http://localhost:3002/admin/prompts/profileAnalyzer/reset',
        'POST',
      ],
    ]);
  });

  it('uses the typed model-console endpoints for every admin operation', async () => {
    const fetcher = vi.fn<
      (input: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(async () => Response.json({}));
    const client = new BackendApiClient({
      baseUrl: 'http://localhost:3002',
      token: 'local-api-token',
      fetcher,
    });

    await client.getModelConsole();
    await client.getModelCatalog();
    await client.setCapabilityModels('profileAnalyzer', {
      primaryModelId: 'gpt-4.1-mini',
      fallbackModelId: 'claude-haiku-4-5',
      notes: null,
    });
    await client.clearCapabilityModels('jobMatchEvaluator');
    await client.probeCapabilityModels('proposalWriter');

    expect(
      fetcher.mock.calls.map(([url, init]) => [String(url), init?.method]),
    ).toEqual([
      ['http://localhost:3002/admin/models', 'GET'],
      ['http://localhost:3002/admin/models/catalog', 'GET'],
      ['http://localhost:3002/admin/models/profileAnalyzer', 'PUT'],
      ['http://localhost:3002/admin/models/jobMatchEvaluator', 'DELETE'],
      ['http://localhost:3002/admin/models/proposalWriter/probe', 'POST'],
    ]);
  });

  it('uses the typed model-console endpoints for every admin operation', async () => {
    const fetcher = vi.fn<
      (input: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(async () => Response.json({}));
    const client = new BackendApiClient({
      baseUrl: 'http://localhost:3002',
      token: 'local-api-token',
      fetcher,
    });

    await client.getModelConsole();
    await client.getModelCatalog();
    await client.setCapabilityModels('profileAnalyzer', {
      primaryModelId: 'gpt-4.1-mini',
      fallbackModelId: 'claude-haiku-4-5',
      notes: null,
    });
    await client.clearCapabilityModels('jobMatchEvaluator');
    await client.probeCapabilityModels('proposalWriter');

    expect(
      fetcher.mock.calls.map(([url, init]) => [String(url), init?.method]),
    ).toEqual([
      ['http://localhost:3002/admin/models', 'GET'],
      ['http://localhost:3002/admin/models/catalog', 'GET'],
      ['http://localhost:3002/admin/models/profileAnalyzer', 'PUT'],
      ['http://localhost:3002/admin/models/jobMatchEvaluator', 'DELETE'],
      ['http://localhost:3002/admin/models/proposalWriter/probe', 'POST'],
    ]);
  });

  it('replaces proposal preferences with every form-owned field', async () => {
    const fetcher = vi.fn<
      (input: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(async () =>
      Response.json({
        proposalLength: 'long',
        proposalTone: 'technical',
        answerLength: 'detailed',
        language: 'fr',
        signOffName: 'Alex',
        customInstructions: 'Lead with outcomes.',
        updatedAt: '2026-08-23T12:00:00.000Z',
      }),
    );
    const client = new BackendApiClient({
      baseUrl: 'http://localhost:3002',
      token: 'local-api-token',
      fetcher,
    });
    const input = {
      proposalLength: 'long',
      proposalTone: 'technical',
      answerLength: 'detailed',
      language: 'fr',
      signOffName: 'Alex',
      customInstructions: 'Lead with outcomes.',
    } as const;

    await client.putProposalPreferences(input);

    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('http://localhost:3002/proposal-preferences');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toEqual(input);
  });

  it('uses every typed insights and proposal-outcome endpoint', async () => {
    const fetcher = vi.fn<
      (input: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(async () => Response.json({}));
    const client = new BackendApiClient({
      baseUrl: 'http://localhost:3002',
      token: 'local-api-token',
      fetcher,
    });

    await client.getInsightsSummary();
    await client.getInsightsActivity('Africa/Casablanca');
    await client.getInsightsScoreHistory(75);
    await client.getInsightsFunnel('90d');
    await client.listProposalOutcomes({
      pageSize: 20,
      cursor: '2026-08-25T12:00:00.000Z/id',
    });
    await client.putProposalOutcome('job/analysis', {
      status: 'interviewing',
      connectsSpent: 12,
    });

    expect(
      fetcher.mock.calls.map(([url, init]) => [String(url), init?.method]),
    ).toEqual([
      ['http://localhost:3002/insights/summary', 'GET'],
      [
        'http://localhost:3002/insights/activity?timeZone=Africa%2FCasablanca',
        'GET',
      ],
      ['http://localhost:3002/insights/score-history?limit=75', 'GET'],
      ['http://localhost:3002/insights/funnel?window=90d', 'GET'],
      [
        'http://localhost:3002/proposal-outcomes?pageSize=20&cursor=2026-08-25T12%3A00%3A00.000Z%2Fid',
        'GET',
      ],
      [
        'http://localhost:3002/job-analyses/job%2Fanalysis/outcome',
        'PUT',
      ],
    ]);
    expect(JSON.parse(String(fetcher.mock.calls[5]?.[1]?.body))).toEqual({
      status: 'interviewing',
      connectsSpent: 12,
    });
  });

  it('omits optional query strings when insight list defaults are used', async () => {
    const fetcher = vi.fn<
      (input: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(async () => Response.json({}));
    const client = new BackendApiClient({
      baseUrl: 'http://localhost:3002',
      token: 'local-api-token',
      fetcher,
    });

    await client.getInsightsScoreHistory();
    await client.listProposalOutcomes();

    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      'http://localhost:3002/insights/score-history',
      'http://localhost:3002/proposal-outcomes',
    ]);
  });
});
