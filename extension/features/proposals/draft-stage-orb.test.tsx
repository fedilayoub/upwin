import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  DRAFT_FLOW_ORB_STATES,
  DraftStageOrb,
} from './draft-stage-orb';

describe('DraftStageOrb', () => {
  it('assigns a distinct tuned animation to each finite draft stage', () => {
    expect(DRAFT_FLOW_ORB_STATES).toEqual({
      capture: 'searching',
      persist: 'connecting',
      analysis: 'solving',
      draft: 'composing',
    });
  });

  it('describes the live proposal-writing state accessibly', () => {
    const markup = renderToStaticMarkup(<DraftStageOrb stage="draft" />);

    expect(markup).toContain('data-orb-state="composing"');
    expect(markup).toContain('aria-label="Writing your proposal…"');
  });
});
