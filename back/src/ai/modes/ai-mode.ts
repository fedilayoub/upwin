export const AI_MODES = ['live', 'replay', 'fake'] as const;

export type AiMode = (typeof AI_MODES)[number];

export interface AiModeEnvironment {
  NODE_ENV: 'development' | 'test' | 'production';
  /** Tests only: pick `fake` or `replay`. Outside tests it is ignored. */
  AI_MODE?: AiMode;
}

/**
 * The app always calls the configured AI provider. Fixtures (`fake`) and
 * recorded cassettes (`replay`) exist so the test suite never reaches a model
 * or the network; nothing outside NODE_ENV=test can select them.
 */
export function resolveAiMode(environment: AiModeEnvironment): AiMode {
  if (environment.NODE_ENV !== 'test') return 'live';
  if (environment.AI_MODE === 'live') {
    throw new Error('A live AI provider is forbidden when NODE_ENV=test.');
  }
  return environment.AI_MODE ?? 'fake';
}
