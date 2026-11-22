/**
 * Naming for the port an open side panel holds to the background worker.
 *
 * The port is the worker's only durable answer to "is a panel open in this
 * window?". An in-memory flag would not survive the worker being suspended,
 * and the toggle has to decide synchronously — it cannot await a stored value
 * without spending the user gesture `sidePanel.open()` depends on. A held port
 * keeps the worker alive for exactly as long as the panel is open, so the flag
 * cannot go stale underneath it.
 *
 * The window id travels in the name because a side panel is an extension page
 * rather than a tab, so the worker's `sender` carries no window of its own.
 */
const SIDE_PANEL_PORT_PREFIX = 'sidepanel';

export function createSidePanelPortName(windowId: number): string {
  return `${SIDE_PANEL_PORT_PREFIX}:${windowId}`;
}

export function parseSidePanelPortName(name: string): number | null {
  const [prefix, rawWindowId, ...rest] = name.split(':');
  if (prefix !== SIDE_PANEL_PORT_PREFIX || rest.length > 0) return null;
  if (!rawWindowId) return null;

  const windowId = Number(rawWindowId);
  return Number.isSafeInteger(windowId) && windowId >= 0 ? windowId : null;
}
