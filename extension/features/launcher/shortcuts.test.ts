import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/side-panel', () => ({
  sidePanelService: {
    startProposalDraft: vi.fn(),
    startProfileAnalysis: vi.fn(),
    toggle: vi.fn(),
  },
}));

import { launcherShortcutsFor } from './shortcuts';

describe('launcherShortcutsFor', () => {
  it('offers the analyse shortcut above the panel toggle on an own profile', () => {
    const shortcuts = launcherShortcutsFor({
      isJobPage: false,
      isOwnProfilePage: true,
    });

    // Order is the rendered order, and the analyse shortcut must sit on top.
    expect(shortcuts.map(({ id }) => id)).toEqual([
      'analyze-profile',
      'toggle-side-panel',
    ]);
    expect(shortcuts[0]?.label).toBe('Analyze profile');
  });

  it('offers the draft shortcut above the panel toggle on a job page', () => {
    expect(
      launcherShortcutsFor({ isJobPage: true, isOwnProfilePage: false }).map(
        ({ id }) => id,
      ),
    ).toEqual(['draft-proposal', 'toggle-side-panel']);
  });

  it('keeps the profile shortcut first if both page flags are true', () => {
    expect(
      launcherShortcutsFor({ isJobPage: true, isOwnProfilePage: true }).map(
        ({ id }) => id,
      ),
    ).toEqual([
      'analyze-profile',
      'draft-proposal',
      'toggle-side-panel',
    ]);
  });

  it('offers only the panel toggle everywhere else', () => {
    // Offering the shortcut off-profile would promise a capture that can only
    // come back as UNSUPPORTED_PAGE.
    const [toggle] = launcherShortcutsFor({
      isJobPage: false,
      isOwnProfilePage: false,
    });

    expect(toggle?.id).toBe('toggle-side-panel');
    expect(toggle?.visual).toEqual({ kind: 'orb', state: 'composing' });
  });
});
