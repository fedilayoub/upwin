import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CornerBorder } from '@/components/ui/corner-border';

describe('CornerBorder', () => {
  it('renders four decorative corners and accepts style overrides', () => {
    const markup = renderToStaticMarkup(
      <CornerBorder
        className="custom-frame"
        cornerClassName="custom-corner"
      />,
    );

    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('data-slot="corner-border"');
    expect(markup).toContain('custom-frame');
    expect(markup.match(/custom-corner/g)).toHaveLength(4);
    expect(markup).toContain('top-0 left-0');
    expect(markup).not.toContain('-top-px');
  });
});
