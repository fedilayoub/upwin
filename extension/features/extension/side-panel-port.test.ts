import { describe, expect, it } from 'vitest';
import {
  createSidePanelPortName,
  parseSidePanelPortName,
} from './side-panel-port';

describe('side panel port names', () => {
  it('round-trips the window a panel belongs to', () => {
    expect(parseSidePanelPortName(createSidePanelPortName(7))).toBe(7);
    expect(parseSidePanelPortName(createSidePanelPortName(0))).toBe(0);
  });

  it('ignores ports opened by anything other than a side panel', () => {
    expect(parseSidePanelPortName('other:1')).toBeNull();
    expect(parseSidePanelPortName('sidepanel')).toBeNull();
    expect(parseSidePanelPortName('')).toBeNull();
  });

  it('rejects names carrying anything but a single window id', () => {
    expect(parseSidePanelPortName('sidepanel:')).toBeNull();
    expect(parseSidePanelPortName('sidepanel:abc')).toBeNull();
    expect(parseSidePanelPortName('sidepanel:1:2')).toBeNull();
    expect(parseSidePanelPortName('sidepanel:-1')).toBeNull();
    expect(parseSidePanelPortName('sidepanel:1.5')).toBeNull();
  });
});
