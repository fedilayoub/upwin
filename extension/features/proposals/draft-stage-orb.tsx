import {
  BrandThinkingOrb,
  type BrandThinkingOrbProps,
} from '@/components/shared/brand-thinking-orb';
import type { OrbState } from 'thinking-orbs/engine';
import {
  DRAFT_FLOW_STAGE_LABELS,
  type DraftFlowStage,
} from './use-draft-flow';

export const DRAFT_FLOW_ORB_STATES = {
  capture: 'searching',
  persist: 'connecting',
  analysis: 'solving',
  draft: 'composing',
} as const satisfies Readonly<Record<DraftFlowStage, OrbState>>;

interface DraftStageOrbProps
  extends Omit<BrandThinkingOrbProps, 'aria-label' | 'state'> {
  stage: DraftFlowStage;
}

export function DraftStageOrb({ stage, ...props }: DraftStageOrbProps) {
  return (
    <BrandThinkingOrb
      aria-label={`${DRAFT_FLOW_STAGE_LABELS[stage]}…`}
      state={DRAFT_FLOW_ORB_STATES[stage]}
      {...props}
    />
  );
}
