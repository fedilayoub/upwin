export const GOAL_OBJECTIVES = [
  'first-client',
  'more-clients',
  'more-responses',
  'higher-paying-projects',
  'scale',
] as const;

export type GoalObjective = (typeof GOAL_OBJECTIVES)[number];

export const PROFILE_SECTION_IDS = [
  'positioning',
  'overview',
  'title',
  'skills',
  'portfolio',
  'experience',
  'trust',
  'goalAlignment',
] as const;

export type ProfileSectionId = (typeof PROFILE_SECTION_IDS)[number];

/**
 * Pipeline order. The applications board renders one lane per status in this
 * sequence, so the order is part of the contract, not a display detail.
 * `sent` keeps its wire value and is labelled "Applied" in the dictionaries.
 */
export const PROPOSAL_OUTCOME_STATUSES = [
  'in-progress',
  'sent',
  'viewed',
  'messaged',
  'interviewing',
  'hired',
  'declined',
  'no-response',
] as const;

export type ProposalOutcomeStatus =
  (typeof PROPOSAL_OUTCOME_STATUSES)[number];

export const FUNNEL_WINDOWS = ['30d', '90d', '365d', 'all'] as const;

export type FunnelWindow = (typeof FUNNEL_WINDOWS)[number];

export const PROPOSAL_LENGTHS = ['short', 'medium', 'long'] as const;
export const PROPOSAL_TONES = [
  'professional',
  'technical',
  'conversational',
  'friendly',
] as const;
export const ANSWER_LENGTHS = ['brief', 'standard', 'detailed'] as const;
/**
 * The languages a draft can be written in, as ISO 639-1 codes. Mirrors the
 * API's list. Each one needs a
 * label in both dictionaries, which `Dictionary['proposals']['languages']`
 * enforces. The app's own interface stays in English and French.
 */
export const OUTPUT_LANGUAGES = [
  'en',
  'fr',
  'de',
  'es',
  'it',
  'nl',
  'pt',
] as const;

export type ProposalLength = (typeof PROPOSAL_LENGTHS)[number];
export type ProposalTone = (typeof PROPOSAL_TONES)[number];
export type AnswerLength = (typeof ANSWER_LENGTHS)[number];
export type OutputLanguage = (typeof OUTPUT_LANGUAGES)[number];

export type RecentActivityItem =
  | {
      kind: 'profile-analysis' | 'job-analysis';
      id: string;
      occurredAt: string;
      label: string;
      score: number;
    }
  | {
      kind: 'proposal-draft';
      id: string;
      occurredAt: string;
      label: string;
      score: null;
    }
  | {
      kind: 'proposal-outcome';
      id: string;
      occurredAt: string;
      label: string;
      score: null;
      status: ProposalOutcomeStatus;
    };

export interface InsightsSummary {
  generatedAt: string;
  profile: {
    latestWinningScore: number | null;
    latestAnalysisId: string | null;
    lastAnalysisAt: string | null;
    daysSinceLastAnalysis: number | null;
    deltaSincePrevious: number | null;
    deltaSinceFirst: number | null;
    latestCompletenessScore: number | null;
    analysesCount: number;
    analysesLast30Days: number;
    strongestSection: ProfileSectionId | null;
    biggestOpportunity: ProfileSectionId | null;
    scoreSparkline: number[];
    goalChangedSinceFirstAnalysis: boolean;
    activeGoal: {
      id: string;
      objective: GoalObjective;
      targetRole: string;
    } | null;
  };
  suggestions: {
    copied: number;
    dismissed: number;
    pending: number;
    adoptionRate: number | null;
  };
  jobs: {
    analysesCount: number;
    analysesLast30Days: number;
    averageMatchScore: number | null;
    averageMatchScoreLast30Days: number | null;
    highFitCount: number;
    highFitShare: number;
    highFitThreshold: number;
    averageMatchScoreApplied: number | null;
  };
  proposals: {
    draftedCount: number;
    draftedLast30Days: number;
    copiedBlocks: number;
    averageProposalWords: number | null;
  };
  outcomes: {
    sent: number;
    viewed: number;
    interviewing: number;
    hired: number;
    declined: number;
    noResponse: number;
    replied: number;
    interviewed: number;
    replyRate: number | null;
    interviewRate: number | null;
    winRate: number | null;
    connectsSpent: number | null;
    connectsPerInterview: number | null;
    sufficientData: boolean;
    minimumSample: number;
  };
  recentActivity: RecentActivityItem[];
}

export interface ActivityDay {
  date: string;
  drafted: number;
  sent: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface InsightsActivity {
  timeZone: string;
  from: string;
  to: string;
  days: ActivityDay[];
  totals: {
    drafted: number;
    sent: number;
    activeDays: number;
  };
  currentStreakWeeks: number;
  longestStreakWeeks: number;
  maxPerDay: number;
}

export interface InsightsScoreHistory {
  points: Array<{
    id: string;
    createdAt: string;
    winningScore: number;
    completenessScore: number | null;
    goalId: string;
    objective: GoalObjective;
  }>;
  goalSegments: Array<{
    goalId: string;
    objective: GoalObjective;
    from: string;
    to: string;
    count: number;
  }>;
  sectionDeltas: Array<{
    id: ProfileSectionId;
    firstScore: number;
    latestScore: number;
    delta: number | null;
  }>;
  comparableAcrossRange: boolean;
  truncated: boolean;
}

export type FunnelStepId =
  | 'jobsAnalyzed'
  | 'proposalsDrafted'
  | 'sent'
  | 'replied'
  | 'interviewing'
  | 'hired';

export interface InsightsFunnel {
  window: FunnelWindow;
  steps: Array<{ id: FunnelStepId; count: number; share: number | null }>;
}

export interface ProposalOutcome {
  id: string;
  jobAnalysisId: string;
  status: ProposalOutcomeStatus;
  connectsSpent: number | null;
  /** Null exactly while the row has never left `in-progress`. */
  sentAt: string | null;
  respondedAt: string | null;
  decidedAt: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalOutcomeListItem extends ProposalOutcome {
  jobTitle: string;
  jobUrl: string;
  matchScore: number;
}

export interface ProposalOutcomesPage {
  items: ProposalOutcomeListItem[];
  pageSize: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export interface ListProposalOutcomesParams {
  pageSize?: number;
  cursor?: string;
  status?: readonly ProposalOutcomeStatus[];
}

export interface ApplicationStats {
  window: FunnelWindow;
  from: string | null;
  to: string;
  /** Rows enrolled in the window. Every job the product drafted for. */
  total: number;
  /**
   * Rows submitted in the window. Filtered on `sentAt`, not `createdAt`, so it
   * is not derivable from `counts`.
   */
  applied: number;
  /** Current status of the `total` set. Sums to `total`; not a journey. */
  counts: Record<ProposalOutcomeStatus, number>;
}

export interface PutProposalOutcomeInput {
  status: ProposalOutcomeStatus;
  connectsSpent?: number | null;
  sentAt?: string;
  note?: string;
}

export interface ProposalPreferences {
  proposalLength: ProposalLength;
  proposalTone: ProposalTone;
  answerLength: AnswerLength;
  language: OutputLanguage;
  signOffName?: string;
  customInstructions?: string;
  updatedAt?: string;
}

export type PutProposalPreferencesInput = Omit<
  ProposalPreferences,
  'updatedAt'
>;

export interface GoalRateRange {
  min?: number;
  max?: number;
}

export interface GoalConfiguration {
  id: string;
  objective: GoalObjective;
  targetRole: string;
  targetProjectTypes: string[];
  targetClients: string[];
  preferredSkills: string[];
  targetRate: GoalRateRange | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGoalInput {
  objective: GoalObjective;
  targetRole: string;
  targetProjectTypes: string[];
  targetClients?: string[];
  preferredSkills?: string[];
  targetRate?: GoalRateRange | null;
}

export interface UpdateGoalInput {
  objective?: GoalObjective;
  targetRole?: string;
  targetProjectTypes?: string[];
  targetClients?: string[];
  preferredSkills?: string[];
  targetRate?: GoalRateRange | null;
  isActive?: true;
}

export interface ExperienceRole {
  title?: string;
  company?: string;
  period?: string;
  description?: string;
}

export interface FreelancerExperience {
  years?: number;
  roles: ExperienceRole[];
}

export interface PortfolioProject {
  title?: string;
  description?: string;
  skills: string[];
  url?: string;
}

export interface FreelancerPreferences {
  tone?: string;
  services?: string[];
}

export interface FreelancerPositioning {
  targetRole?: string;
  targetClients?: string[];
  targetIndustries?: string[];
  targetRate?: number;
}

export interface FreelancerContextFields {
  experience: FreelancerExperience;
  skills: string[];
  portfolio: PortfolioProject[];
  preferences: FreelancerPreferences;
  positioning: FreelancerPositioning;
}

export interface FreelancerContext extends FreelancerContextFields {
  id: string;
  source: 'cv' | 'manual' | 'mixed';
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FreelancerContextSaveResponse extends FreelancerContext {
  replaced: boolean;
}

export type UpdateFreelancerContextInput = Partial<FreelancerContextFields>;

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
  };
}

export const AI_CAPABILITIES = [
  'profileAnalyzer',
  'profileImprover',
  'cvExtractor',
  'jobMatchEvaluator',
  'proposalWriter',
] as const;

export type AiCapability = (typeof AI_CAPABILITIES)[number];
export const MODEL_SELECTABLE_CAPABILITIES = [
  'profileAnalyzer',
  'jobMatchEvaluator',
  'proposalWriter',
] as const;
export type ModelSelectableCapability =
  (typeof MODEL_SELECTABLE_CAPABILITIES)[number];
export type ModelSelectionSource = 'selection' | 'environment' | 'default';

export interface ModelCatalogEntry {
  id: string;
  displayName: string;
  family: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  contextLength: number;
  maxOutput: number | null;
  sunsetsAt: string | null;
  providerIds: string[];
  aliases: string[];
  stability: string | null;
}

export interface ModelCostEstimate {
  estimatedCostUsd: number;
  sampleRuns: number;
  label: 'recent-runs' | 'no-runs-yet';
  medianInputTokens: number;
  medianOutputTokens: number;
}

export interface CapabilityModelConsole {
  capability: ModelSelectableCapability;
  primaryModelId: string;
  fallbackModelId: string;
  primary: ModelCatalogEntry | null;
  fallback: ModelCatalogEntry | null;
  source: ModelSelectionSource;
  warnings: string[];
  notes: string | null;
  defaults: {
    primary: string;
    fallback: string;
    source: 'environment' | 'default';
  };
  costEstimate: ModelCostEstimate;
}

export interface ModelConsoleResponse {
  mode: 'fake' | 'replay' | 'live';
  capabilities: CapabilityModelConsole[];
}

export interface SetCapabilityModelsInput {
  primaryModelId: string;
  fallbackModelId: string;
  notes?: string | null;
}

export interface ModelProbeAttempt {
  ok: boolean;
  servedModelId?: string;
  latencyMs: number;
  error?: string;
}

export interface ModelProbeResponse {
  primary: ModelProbeAttempt;
  fallback: ModelProbeAttempt;
}

export type PromptCapability = 'profileAnalyzer';
export type PromptRevisionStatus = 'draft' | 'active' | 'retired';
export type PromptAnchorScore = '0' | '25' | '50' | '75' | '100';

export interface AnalyzerTemplateContent {
  systemPersona: string;
  policy: string;
  goalStrategies: Record<GoalObjective, string>;
  criterionAnchors: Record<
    string,
    Record<PromptAnchorScore, string>
  >;
}

export interface PromptRevision {
  id: string;
  capability: AiCapability;
  revisionNumber: number;
  status: PromptRevisionStatus;
  content: AnalyzerTemplateContent;
  notes: string | null;
  createdByUserId: string;
  createdAt: string;
  activatedAt: string | null;
  retiredAt: string | null;
}

export interface PromptBlockMetadata {
  systemPersona: { label: string; maxLength: number };
  policy: { label: string; maxLength: number };
  goalStrategies: Array<{
    objective: GoalObjective;
    label: string;
    maxLength: number;
  }>;
  sections: Array<{
    id: string;
    label: string;
    criteria: Array<{
      id: string;
      label: string;
      anchors: Array<{
        score: 0 | 25 | 50 | 75 | 100;
        label: string;
        maxLength: number;
      }>;
    }>;
  }>;
}

export interface PromptConsoleResponse {
  codeDefault: AnalyzerTemplateContent;
  active: PromptRevision | null;
  drafts: PromptRevision[];
  blocks: PromptBlockMetadata;
}

export interface PromptRender {
  revisionNumber: number | null;
  promptVersion: string;
  system: string;
  prompt: string;
}

export interface PromptPreviewResponse {
  candidate: PromptRender;
  baseline: PromptRender;
}

export interface PromptSectionScore {
  id: string;
  score: number;
  criteria: Array<{ id: string; label: string; evidence: string[] }>;
}

export interface PromptDryRunResult {
  revisionNumber: number | null;
  winningScore: number;
  completenessScore: number | null;
  summary: string;
  sectionScores: PromptSectionScore[];
  prompt: PromptRender;
  versions: {
    prompt: string;
    provider: string;
    model: string;
    gateway?: string;
  };
}

export interface PromptDryRunResponse {
  candidate: PromptDryRunResult;
  baseline: PromptDryRunResult;
}

export interface SavePromptRevisionInput {
  content: AnalyzerTemplateContent;
  notes: string | null;
}

// Video proposals. Display types; the API owns the limits, which the install sets.
export type VideoStatus = 'uploading' | 'processing' | 'ready' | 'failed';

export type VideoSourceKind = 'screen' | 'window' | 'tab' | 'area';
// The surface Chrome actually granted, from track.getSettings().displaySurface:
// monitor → 'screen', window → 'window', browser → 'tab'.
// 'area' whenever a crop was applied, whatever the surface.

export type VideoFailureReason =
  | 'upload_abandoned'   // still uploading 24 h after create
  | 'invalid_media'      // ffprobe rejected the container, codecs or dimensions
  | 'too_long'           // probed duration > the 20-minute cap + 5 s
  | 'processing_error';  // remux, poster or storage failed 3 times

export interface Video {
  id: string;                    // uuid
  slug: string;                  // 12 chars, [0-9A-Za-z]
  shareUrl: string;              // `${APP_URL}/v/${slug}`, known from create onwards
  title: string;                 // 1..120 chars, trimmed
  status: VideoStatus;
  failureReason: VideoFailureReason | null;  // non-null iff status === 'failed'
  sourceKind: VideoSourceKind;
  hasCamera: boolean;
  hasAudio: boolean;
  durationMs: number | null;     // probed server-side; null until ready
  width: number | null;          // null until ready
  height: number | null;
  sizeBytes: number | null;      // size of playback.mp4; null until ready
  thumbnailUrl: string | null;   // presigned GET, 1 h TTL; null until ready
  jobSnapshotId: string | null;  // set when recorded from the proposal screen
  viewCount: number;             // integer >= 0; the owner's own plays are never counted
  finishedViews: number;         // views that reached the end
  averageWatchedPercent: number | null; // 0..100; null before any tracked view
  watchTimeMs: number;           // distinct video time watched, summed over views
  lastViewedAt: string | null;   // ISO 8601
  createdAt: string;
  readyAt: string | null;
}

export interface VideoLimits {
  available: boolean;            // false = VIDEO_NOT_CONFIGURED: no bucket is configured
  storage: { usedBytes: number }; // no total cap: a video is kept until deleted
  maxDurationMs: number;
  maxBytes: number;
}

export interface UpdateVideoRequest {
  title: string;                 // 1..120 chars after trim
}

export interface VideoListResponse {
  items: Video[];                // newest first; status 'uploading' excluded
  nextCursor: string | null;     // opaque
}

export interface PublicVideo {
  slug: string;
  title: string;
  status: 'processing' | 'ready';
  durationMs: number | null;
  width: number | null;
  height: number | null;
  playbackUrl: string | null;    // presigned GET of playback.mp4, 3 h TTL; null while processing
  posterUrl: string | null;      // presigned GET of poster.jpg, 3 h TTL; null while processing
  createdAt: string;
}
