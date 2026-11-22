export type JobSnapshotSource = 'upwork-payload' | 'upwork-dom' | 'manual';

export const JOB_MATCH_DIMENSION_IDS = [
  'skills',
  'domain',
  'experience',
  'budget',
  'goalAlignment',
] as const;

export type JobMatchDimensionId = (typeof JOB_MATCH_DIMENSION_IDS)[number];

export interface JobSkill {
  name: string;
  relevance: 'mandatory' | 'nice-to-have' | 'unknown';
}

export interface JobQuestion {
  position: number;
  question: string;
}

export interface JobSnapshot {
  source: JobSnapshotSource;
  capturedAt: string;
  job: {
    ciphertext: string;
    url: string;
    title: string;
    description: string;
    postedAt?: string;
    category?: string;
    categoryGroup?: string;
    engagement: {
      budgetType: 'hourly' | 'fixed' | 'unknown';
      fixedBudget?: { amount: number; currency: string };
      hourlyBudget?: { min?: number; max?: number; currency: string };
      workload?: string;
      durationLabel?: string;
      experienceLevel?: 'entry' | 'intermediate' | 'expert';
      projectType?: string;
    };
    skills: JobSkill[];
    questions: JobQuestion[];
    client: {
      country?: string;
      paymentVerified: boolean | null;
      rating?: number;
      reviewCount?: number;
      totalSpend?: number;
      hires?: number;
      jobsPosted?: number;
      hireRate?: number;
      avgHourlyRatePaid?: number;
      industry?: string;
      companySize?: string;
    };
    activity: {
      applicants?: number;
      interviewing?: number;
      hired?: number;
      lastClientActivityAt?: string;
    };
  };
}

export interface JobCaptureResult {
  snapshot: JobSnapshot;
  truncatedFields: string[];
}

export interface JobPageStatus {
  supported: boolean;
}

export interface JobSnapshotReceipt {
  id: string;
  ciphertext: string;
  capturedAt: string;
  createdAt: string;
  truncatedFields: string[];
}

export interface JobCriterionEvidence {
  id: string;
  label: string;
  evidence: string[];
}

export interface JobDimensionScore {
  id: JobMatchDimensionId;
  score: number;
  criteria: JobCriterionEvidence[];
}

export interface JobAnalysis {
  id: string;
  jobSnapshotId: string;
  goalId: string;
  matchScore: number;
  summary: string;
  dimensions: JobDimensionScore[];
  strengths: string[];
  concerns: string[];
  questionCount: number;
  versions: {
    prompt: string;
    rubric: string;
    scoring: string;
    requestedModel: string;
    gateway?: string;
    provider: string;
    model: string;
  };
  createdAt: string;
}
