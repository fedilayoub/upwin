import type {
  Video,
  VideoLimits,
  VideoListResponse,
  UpdateVideoRequest,
  ApiErrorEnvelope,
  ApplicationStats,
  AiCapability,
  CapabilityModelConsole,
  ModelCatalogEntry,
  ModelConsoleResponse,
  ModelProbeResponse,
  ModelSelectableCapability,
  PromptConsoleResponse,
  PromptDryRunResponse,
  PromptPreviewResponse,
  PromptRevision,
  SavePromptRevisionInput,
  SetCapabilityModelsInput,
  CreateGoalInput,
  FreelancerContext,
  FreelancerContextFields,
  FreelancerContextSaveResponse,
  FunnelWindow,
  GoalConfiguration,
  InsightsActivity,
  InsightsFunnel,
  InsightsScoreHistory,
  InsightsSummary,
  ListProposalOutcomesParams,
  ProposalPreferences,
  ProposalOutcome,
  ProposalOutcomesPage,
  PutProposalPreferencesInput,
  PutProposalOutcomeInput,
  UpdateFreelancerContextInput,
  UpdateGoalInput,
} from '@/lib/api/types';

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

interface BackendApiClientOptions {
  baseUrl: string;
  /** The API's `API_TOKEN`, when it has one. A loopback-only API needs none. */
  token?: string;
  fetcher?: Fetcher;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class BackendApiClient {
  private readonly baseUrl: string;
  private readonly fetcher: Fetcher;
  private readonly token: string | undefined;

  constructor({ baseUrl, token, fetcher = fetch }: BackendApiClientOptions) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.fetcher = fetcher;
    this.token = token;
  }







  getVideoLimits(): Promise<VideoLimits> {
    return this.request('/videos/limits');
  }

  listVideos(params: { cursor?: string; limit?: number } = {}): Promise<VideoListResponse> {
    const query = new URLSearchParams();
    if (params.cursor !== undefined) query.set('cursor', params.cursor);
    if (params.limit !== undefined) query.set('limit', String(params.limit));
    return this.request(`/videos${query.size ? `?${query}` : ''}`);
  }

  getVideo(id: string): Promise<{ video: Video }> {
    return this.request(`/videos/${encodeURIComponent(id)}`);
  }

  renameVideo(id: string, input: UpdateVideoRequest): Promise<{ video: Video }> {
    return this.request(`/videos/${encodeURIComponent(id)}`, { method: 'PATCH', json: input });
  }

  deleteVideo(id: string): Promise<void> {
    return this.request(`/videos/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  listGoals(): Promise<GoalConfiguration[]> {
    return this.request('/goals');
  }

  getActiveGoal(): Promise<GoalConfiguration> {
    return this.request('/goals/active');
  }

  createGoal(input: CreateGoalInput): Promise<GoalConfiguration> {
    return this.request('/goals', { method: 'POST', json: input });
  }

  updateGoal(id: string, input: UpdateGoalInput): Promise<GoalConfiguration> {
    return this.request(`/goals/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      json: input,
    });
  }

  deleteGoal(id: string): Promise<void> {
    return this.request(`/goals/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  getProposalPreferences(): Promise<ProposalPreferences> {
    return this.request('/proposal-preferences');
  }

  putProposalPreferences(
    input: PutProposalPreferencesInput,
  ): Promise<ProposalPreferences> {
    return this.request('/proposal-preferences', { method: 'PUT', json: input });
  }

  getFreelancerContext(): Promise<FreelancerContext | null> {
    return this.request('/freelancer-context');
  }

  createFreelancerContext(
    input: FreelancerContextFields,
  ): Promise<FreelancerContextSaveResponse> {
    return this.request('/freelancer-context', { method: 'POST', json: input });
  }

  updateFreelancerContext(
    input: UpdateFreelancerContextInput,
  ): Promise<FreelancerContext> {
    return this.request('/freelancer-context', { method: 'PATCH', json: input });
  }

  uploadCv(file: File): Promise<FreelancerContextSaveResponse> {
    const formData = new FormData();
    formData.set('file', file);
    return this.request('/freelancer-context/cv', {
      method: 'POST',
      body: formData,
    });
  }

  confirmFreelancerContext(): Promise<FreelancerContext> {
    return this.request('/freelancer-context/confirm', { method: 'POST' });
  }

  deleteFreelancerContext(): Promise<void> {
    return this.request('/freelancer-context', { method: 'DELETE' });
  }

  getInsightsSummary(): Promise<InsightsSummary> {
    return this.request('/insights/summary');
  }




  getInsightsActivity(timeZone: string): Promise<InsightsActivity> {
    const query = new URLSearchParams({ timeZone });
    return this.request(`/insights/activity?${query.toString()}`);
  }

  getInsightsScoreHistory(limit?: number): Promise<InsightsScoreHistory> {
    const query = new URLSearchParams();
    if (limit !== undefined) query.set('limit', String(limit));
    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    return this.request(`/insights/score-history${suffix}`);
  }

  getInsightsFunnel(window: FunnelWindow): Promise<InsightsFunnel> {
    const query = new URLSearchParams({ window });
    return this.request(`/insights/funnel?${query.toString()}`);
  }

  listProposalOutcomes(
    params: ListProposalOutcomesParams = {},
  ): Promise<ProposalOutcomesPage> {
    const query = new URLSearchParams();
    if (params.pageSize !== undefined) {
      query.set('pageSize', String(params.pageSize));
    }
    if (params.cursor !== undefined) query.set('cursor', params.cursor);
    if (params.status !== undefined && params.status.length > 0) {
      query.set('status', params.status.join(','));
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    return this.request(`/proposal-outcomes${suffix}`);
  }

  getApplicationStats(window: FunnelWindow): Promise<ApplicationStats> {
    const query = new URLSearchParams({ window });
    return this.request(`/proposal-outcomes/stats?${query.toString()}`);
  }

  putProposalOutcome(
    jobAnalysisId: string,
    input: PutProposalOutcomeInput,
  ): Promise<ProposalOutcome> {
    return this.request(
      `/job-analyses/${encodeURIComponent(jobAnalysisId)}/outcome`,
      { method: 'PUT', json: input },
    );
  }

  getPromptConsole(capability: AiCapability): Promise<PromptConsoleResponse> {
    return this.request(`/admin/prompts/${encodeURIComponent(capability)}`);
  }

  listPromptRevisions(capability: AiCapability): Promise<PromptRevision[]> {
    return this.request(
      `/admin/prompts/${encodeURIComponent(capability)}/revisions`,
    );
  }

  createPromptDraft(
    capability: AiCapability,
    input: SavePromptRevisionInput,
  ): Promise<PromptRevision> {
    return this.request(
      `/admin/prompts/${encodeURIComponent(capability)}/revisions`,
      { method: 'POST', json: input },
    );
  }

  updatePromptDraft(
    capability: AiCapability,
    revisionId: string,
    input: SavePromptRevisionInput,
  ): Promise<PromptRevision> {
    return this.request(
      `/admin/prompts/${encodeURIComponent(capability)}/revisions/${encodeURIComponent(revisionId)}`,
      { method: 'PATCH', json: input },
    );
  }

  previewPromptRevision(
    capability: AiCapability,
    revisionId: string,
  ): Promise<PromptPreviewResponse> {
    return this.request(
      `/admin/prompts/${encodeURIComponent(capability)}/revisions/${encodeURIComponent(revisionId)}/preview`,
      { method: 'POST' },
    );
  }

  dryRunPromptRevision(
    capability: AiCapability,
    revisionId: string,
  ): Promise<PromptDryRunResponse> {
    return this.request(
      `/admin/prompts/${encodeURIComponent(capability)}/revisions/${encodeURIComponent(revisionId)}/dry-run`,
      { method: 'POST' },
    );
  }

  activatePromptRevision(
    capability: AiCapability,
    revisionId: string,
  ): Promise<PromptRevision> {
    return this.request(
      `/admin/prompts/${encodeURIComponent(capability)}/revisions/${encodeURIComponent(revisionId)}/activate`,
      { method: 'POST' },
    );
  }

  resetPromptCapability(
    capability: AiCapability,
  ): Promise<{ active: null }> {
    return this.request(
      `/admin/prompts/${encodeURIComponent(capability)}/reset`,
      { method: 'POST' },
    );
  }

  getModelConsole(): Promise<ModelConsoleResponse> {
    return this.request('/admin/models');
  }

  getModelCatalog(): Promise<ModelCatalogEntry[]> {
    return this.request('/admin/models/catalog');
  }

  setCapabilityModels(
    capability: ModelSelectableCapability,
    input: SetCapabilityModelsInput,
  ): Promise<CapabilityModelConsole> {
    return this.request(`/admin/models/${encodeURIComponent(capability)}`, {
      method: 'PUT',
      json: input,
    });
  }

  clearCapabilityModels(
    capability: ModelSelectableCapability,
  ): Promise<CapabilityModelConsole> {
    return this.request(`/admin/models/${encodeURIComponent(capability)}`, {
      method: 'DELETE',
    });
  }

  probeCapabilityModels(
    capability: ModelSelectableCapability,
  ): Promise<ModelProbeResponse> {
    return this.request(
      `/admin/models/${encodeURIComponent(capability)}/probe`,
      { method: 'POST' },
    );
  }





  private async request<T>(
    path: string,
    options: {
      method?: 'DELETE' | 'GET' | 'POST' | 'PATCH' | 'PUT';
      json?: unknown;
      body?: BodyInit;
    } = {},
  ): Promise<T> {
    const headers = new Headers({ Accept: 'application/json' });
    if (this.token) headers.set('Authorization', `Bearer ${this.token}`);
    const body = options.json === undefined ? options.body : JSON.stringify(options.json);
    if (options.json !== undefined) headers.set('Content-Type', 'application/json');

    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      body,
      cache: 'no-store',
      credentials: 'omit',
      headers,
      method: options.method ?? 'GET',
    });

    if (!response.ok) {
      const envelope = await readErrorEnvelope(response);
      throw new ApiError(
        envelope?.error.message ?? 'The API request failed.',
        envelope?.error.code ?? 'UNKNOWN_ERROR',
        response.status,
      );
    }

    if (response.status === 204) return undefined as T;

    return (await response.json()) as T;
  }
}

async function readErrorEnvelope(response: Response): Promise<ApiErrorEnvelope | null> {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'object' &&
      body.error !== null &&
      'code' in body.error &&
      typeof body.error.code === 'string' &&
      'message' in body.error &&
      typeof body.error.message === 'string'
    ) {
      return { error: { code: body.error.code, message: body.error.message } };
    }
  } catch {
    // A malformed backend response is converted into a stable client error below.
  }

  return null;
}
