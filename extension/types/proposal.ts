export type ProposalTone =
  | 'professional'
  | 'technical'
  | 'conversational'
  | 'friendly';

export type ProposalLength = 'short' | 'medium' | 'long';

export type ProposalRefinement =
  | 'regenerate'
  | 'shorter'
  | 'more-technical'
  | 'more-conversational';

export type ProposalBlockId = 'proposal' | `answer:${number}`;

export interface ProposalBlock {
  blockId: 'proposal';
  text: string;
  wordCount: number;
  variantIndex: number;
}

export interface ScreeningQuestion {
  blockId: `answer:${number}`;
  position: number;
  question: string;
  text: string;
  wordCount: number;
  variantIndex: number;
}

export interface Proposal {
  id: string;
  jobAnalysisId: string;
  proposal: ProposalBlock;
  answers: ScreeningQuestion[];
  versions: {
    prompt: string;
    requestedModel: string;
    gateway?: string;
    provider: string;
    model: string;
  };
  createdAt: string;
}

export type ProposalBlockStatus = 'copied' | 'dismissed';
