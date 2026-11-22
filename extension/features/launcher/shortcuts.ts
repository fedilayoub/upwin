import {
  FileText,
  ScanSearch,
  type LucideIcon,
} from 'lucide-react';
import type { OrbState } from 'thinking-orbs/engine';
import { sidePanelService } from '@/services/side-panel';

export type LauncherShortcutId =
  | 'analyze-profile'
  | 'draft-proposal'
  | 'toggle-side-panel';

export type LauncherShortcutVisual =
  | { kind: 'icon'; icon: LucideIcon }
  | { kind: 'orb'; state: OrbState };

export interface LauncherShortcut {
  id: LauncherShortcutId;
  label: string;
  /**
   * Called straight from the click handler. Must reach `sendMessage`
   * synchronously: the worker's `sidePanel.open()` needs the user gesture the
   * click is carrying, and the gesture does not survive an await.
   */
  run: () => Promise<unknown>;
  visual: LauncherShortcutVisual;
}

/**
 * Whether the page the launcher is sitting on can be analysed. Derived from the
 * URL in the content script, which already knows it without a host permission.
 */
export interface LauncherShortcutContext {
  isJobPage: boolean;
  isOwnProfilePage: boolean;
}

const analyzeProfileShortcut: LauncherShortcut = {
  id: 'analyze-profile',
  label: 'Analyze profile',
  run: () => sidePanelService.startProfileAnalysis(),
  visual: { kind: 'icon', icon: ScanSearch },
};

const toggleSidePanelShortcut: LauncherShortcut = {
  id: 'toggle-side-panel',
  label: 'upwin',
  run: () => sidePanelService.toggle(),
  visual: { kind: 'orb', state: 'composing' },
};

const draftProposalShortcut: LauncherShortcut = {
  id: 'draft-proposal',
  label: 'Draft proposal',
  run: () => sidePanelService.startProposalDraft(),
  visual: { kind: 'icon', icon: FileText },
};

/**
 * The bar renders top to bottom, so the analyse shortcut is listed first to sit
 * above the panel toggle. It appears only on the user's own profile, where it
 * has something to act on — offering it everywhere would promise a capture that
 * can only come back as UNSUPPORTED_PAGE.
 */
export function launcherShortcutsFor({
  isJobPage,
  isOwnProfilePage,
}: LauncherShortcutContext): readonly LauncherShortcut[] {
  return [
    ...(isOwnProfilePage ? [analyzeProfileShortcut] : []),
    ...(isJobPage ? [draftProposalShortcut] : []),
    toggleSidePanelShortcut,
  ];
}
