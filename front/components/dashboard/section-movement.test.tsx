import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  SectionMovement,
  SectionMovementLoading,
} from '@/components/dashboard/section-movement';
import en from '@/i18n/dictionaries/en';
import type { InsightsScoreHistory } from '@/lib/api';

const sectionDeltas: InsightsScoreHistory['sectionDeltas'] = [
  {
    id: 'positioning',
    firstScore: 52,
    latestScore: 76,
    delta: 24,
  },
  {
    id: 'overview',
    firstScore: 81,
    latestScore: 74,
    delta: -7,
  },
];

describe('SectionMovement', () => {
  it('renders an Evil Charts radar and preserves the section score summary', () => {
    const markup = renderToStaticMarkup(
      <SectionMovement
        copy={en.dashboard.sections}
        sectionDeltas={sectionDeltas}
      />,
    );

    expect(markup).toContain('data-section-movement-radar="true"');
    expect(markup).toContain('data-chart="chart-');
    expect(markup).toContain('data-section-movement="positioning"');
    expect(markup).toContain('Positioning: First 52, Latest 76, +24');
    expect(markup).toContain('Overview: First 81, Latest 74, -7');
  });

  it('uses the Evil Charts animated radar loading state', () => {
    const markup = renderToStaticMarkup(<SectionMovementLoading />);

    expect(markup).toContain('data-section-movement-loading="true"');
    expect(markup).toContain('Loading section movement');
    expect(markup).toContain('Loading');
  });
});
