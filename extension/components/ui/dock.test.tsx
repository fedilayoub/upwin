import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Dock, DockItem, getDockItemScale } from './dock';

describe('Dock', () => {
  it('magnifies items smoothly inside the configured proximity', () => {
    expect(getDockItemScale(0, 100, 1.4)).toBeCloseTo(1.4);
    expect(getDockItemScale(50, 100, 1.4)).toBeCloseTo(1.2);
    expect(getDockItemScale(100, 100, 1.4)).toBe(1);
    expect(getDockItemScale(140, 100, 1.4)).toBe(1);
  });

  it('renders an accessible active item and its visual label', () => {
    const markup = renderToStaticMarkup(
      <Dock>
        <DockItem active label="Profile" onClick={vi.fn()}>
          <span>icon</span>
        </DockItem>
      </Dock>,
    );

    expect(markup).toContain('data-slot="dock"');
    expect(markup).toContain('data-slot="dock-item-slot"');
    expect(markup).toContain('data-slot="dock-item"');
    expect(markup).toContain('aria-label="Profile"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('>Profile</span>');
  });
});
