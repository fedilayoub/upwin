export type ProfileSectionId =
  | 'positioning'
  | 'overview'
  | 'title'
  | 'skills'
  | 'portfolio'
  | 'experience'
  | 'trust'
  | 'goalAlignment';

export const PROFILE_SECTION_IDS = [
  'positioning',
  'overview',
  'title',
  'skills',
  'portfolio',
  'experience',
  'trust',
  'goalAlignment',
] as const satisfies readonly ProfileSectionId[];

export type GoalObjective =
  | 'first-client'
  | 'more-clients'
  | 'more-responses'
  | 'higher-paying-projects'
  | 'scale';

export interface ActiveProfileGoal {
  id: string;
  objective: GoalObjective;
  targetRole: string;
  targetProjectTypes: string[];
  targetClients: string[];
  preferredSkills: string[];
  targetRate: { min?: number; max?: number } | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileSectionScore {
  id: ProfileSectionId;
  score: number;
  criteria: Array<{
    id: string;
    label: string;
    evidence: string[];
  }>;
}

export interface ProfileAnalysisGoal {
  id: string;
  objective: GoalObjective;
  targetRole: string;
}

export type PriorityOutcomeStatus =
  | 'implemented'
  | 'partial'
  | 'not-implemented';

interface ProfileRecommendationBase {
  id: string;
  section: ProfileSectionId;
  rank: number;
  impact: 'high' | 'medium' | 'low';
  estimatedMinutes: number;
  recommendation: string;
  reason: string;
  evidence: string[];
  /**
   * Set when a previous analysis already raised this same priority, with
   * whether the backend judged it acted on. Absent for a new priority, and for
   * a first analysis.
   */
  previousOutcome?: {
    status: PriorityOutcomeStatus;
    note: string;
  };
}

export interface ProfileEvaluationRecommendation
  extends ProfileRecommendationBase {
  kind?: never;
}

export interface ProfileCompletenessRecommendation
  extends ProfileRecommendationBase {
  kind: 'fill';
  field: null;
  itemIndex: null;
  guidance: string;
  items: string[];
}

export type ProfileRecommendation =
  | ProfileEvaluationRecommendation
  | ProfileCompletenessRecommendation;

export type ProfileSuggestionStyle =
  | 'concise'
  | 'technical'
  | 'premium'
  | 'conversational';

export type ProfileSuggestionField =
  | 'title'
  | 'overview'
  | 'skills'
  | 'portfolio'
  | 'employment';

interface ProfileSuggestionBase {
  id: string;
  section: ProfileSectionId;
  field: ProfileSuggestionField | null;
  itemIndex: number | null;
  explanation: string;
  impact: 'high' | 'medium' | 'low';
}

export interface ProfileRewriteSuggestion extends ProfileSuggestionBase {
  kind: 'rewrite';
  originalValue?: string;
  suggestedValue: string;
}

export interface ProfileFillSuggestion extends ProfileSuggestionBase {
  kind: 'fill';
  guidance: string;
  items: string[];
}

export type ProfileSuggestion =
  | ProfileRewriteSuggestion
  | ProfileFillSuggestion;

export type RecommendationActionStatus = 'copied' | 'dismissed';

export interface ProfileAnalysis {
  id: string;
  createdAt: string;
  winningScore: number;
  completenessScore: number | null;
  previousWinningScore: number | null;
  goal: ProfileAnalysisGoal;
  summary: string;
  strongestSection: ProfileSectionId;
  biggestOpportunity: ProfileSectionId;
  sectionScores: ProfileSectionScore[];
  priorities: ProfileRecommendation[];
  versions: {
    prompt: string;
    rubric: string;
    scoring: string;
    /** Bare id requested for the call; `model` is the upstream that answered. */
    requestedModel?: string;
    provider: string;
    model: string;
    gateway?: string;
  };
}

export interface ProfileAnalysisListItem {
  id: string;
  createdAt: string;
  winningScore: number;
  sectionScores: ProfileSectionScore[];
  goal: ProfileAnalysisGoal;
}

export interface ProfileAnalysisList {
  items: ProfileAnalysisListItem[];
  pageSize: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export interface ProfileAnalysisProgress {
  latest: {
    id: string;
    createdAt: string;
    winningScore: number;
  } | null;
  deltaSinceFirst: number | null;
  trend: Array<{
    id: string;
    createdAt: string;
    winningScore: number;
  }>;
  sectionDeltas: Array<{
    id: ProfileSectionId;
    firstScore: number;
    latestScore: number;
    delta: number | null;
  }>;
}

export interface ProfileSnapshotDiff {
  fromSnapshotId: string;
  toSnapshotId: string;
  fromCapturedAt: string;
  toCapturedAt: string;
  changes: {
    title: { status: 'changed' | 'unchanged' };
    overview: { status: 'updated' | 'unchanged' };
    portfolio: {
      status: 'changed' | 'unchanged';
      added: number;
      removed: number;
    };
    skills: {
      status: 'changed' | 'unchanged';
      added: string[];
      removed: string[];
    };
  };
}

export interface ProfileAnalyzerSetup {
  activeGoal: ActiveProfileGoal | null;
  contextConfirmed: boolean;
  latestAnalysis: ProfileAnalysis | null;
  progress: ProfileAnalysisProgress;
  snapshotDiff: ProfileSnapshotDiff | null;
}

export interface ProfilePageStatus {
  supported: boolean;
}
