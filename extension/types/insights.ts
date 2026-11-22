import type {
  GoalObjective,
  ProfileSectionId,
} from '@/types/profile';

/**
 * Pipeline order, matching the API's insights response. Drafting a
 * proposal enrols the job at `in-progress`; `sent` is rendered as "Applied".
 */
export type ProposalOutcomeStatus =
  | 'in-progress'
  | 'sent'
  | 'viewed'
  | 'messaged'
  | 'interviewing'
  | 'hired'
  | 'declined'
  | 'no-response';

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

export interface ActivityCalendar {
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

export interface ProposalOutcome {
  id: string;
  jobAnalysisId: string;
  status: ProposalOutcomeStatus;
  connectsSpent: number | null;
  /** Null while the application has never left `in-progress`. */
  sentAt: string | null;
  respondedAt: string | null;
  decidedAt: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}
