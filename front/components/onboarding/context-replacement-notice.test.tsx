import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ContextReplacementNotice } from '@/components/onboarding/context-replacement-notice';

describe('ContextReplacementNotice', () => {
  it('renders the replacement message only when an overwrite happened', () => {
    const hidden = renderToStaticMarkup(
      <ContextReplacementNotice message="Previous context replaced." visible={false} />,
    );
    const visible = renderToStaticMarkup(
      <ContextReplacementNotice message="Previous context replaced." visible />,
    );

    expect(hidden).toBe('');
    expect(visible).toContain('role="status"');
    expect(visible).toContain('Previous context replaced.');
  });
});
