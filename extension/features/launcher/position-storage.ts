import { storage } from '#imports';
import { DEFAULT_LAUNCHER_FRACTION } from './position';

/**
 * Where the user parked the launcher, as a track fraction.
 *
 * `local:` rather than `sync:`: the bar's position is a per-screen ergonomic
 * choice, and syncing it would drag a laptop-sized offset onto a desktop.
 * Shared across the tabs of one browser, so the launcher does not jump when
 * the user switches tabs.
 */
export const launcherPositionItem = storage.defineItem<number>(
  'local:launcher-position',
  { fallback: DEFAULT_LAUNCHER_FRACTION },
);
