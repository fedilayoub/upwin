/** How the applications page lays out the same set of proposals. */
export const APPLICATION_VIEWS = ['board', 'table'] as const;

export type ApplicationView = (typeof APPLICATION_VIEWS)[number];

/** Remembers the last view picked, so a bare `/applications` reopens it. */
export const APPLICATION_VIEW_COOKIE = 'upilot-applications-view';

export const DEFAULT_APPLICATION_VIEW: ApplicationView = 'board';
