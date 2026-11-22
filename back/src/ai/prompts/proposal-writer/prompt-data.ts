import type { FreelancerContextFields } from '../../../freelancer-context/freelancer-context.schema';
import type { GoalResponse } from '../../../goals/goals.service';
import type { JobSnapshot } from '../../../job-snapshots/job-snapshot.schema';
import type { JobDimensionScore } from '../../../jobs/scoring/job-match-scoring';
import type { ProposalPreferencesResponse } from '../../../proposal-preferences/proposal-preferences.service';

export interface ProposalMatchFindings {
  summary: string;
  dimensions: JobDimensionScore[];
  strengths: string[];
  concerns: string[];
}

export type ProposalRefinement =
  | 'regenerate'
  | 'shorter'
  | 'more-technical'
  | 'more-conversational';

export interface ProposalRefinementContext {
  blockId: string;
  refinement: ProposalRefinement;
  existingDraft: {
    proposal: string;
    answers: Array<{ position: number; answer: string }>;
  };
}

export interface ProposalWriterPromptInput {
  goal: GoalResponse;
  context: FreelancerContextFields;
  snapshot: JobSnapshot;
  findings: ProposalMatchFindings;
  preferences: ProposalPreferencesResponse;
  refinement?: ProposalRefinementContext;
}
