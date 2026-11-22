import type { LanguageModelMiddleware } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitConfigReader } from './git-author-identity';
import type { CassetteMiddlewareOptions } from './middleware/cassette.middleware';

interface CassetteMiddlewareModule {
  createCassetteMiddleware(
    options: CassetteMiddlewareOptions,
  ): LanguageModelMiddleware;
}

const cassetteMiddlewareSpy = vi.hoisted(() => vi.fn());

vi.mock('./middleware/cassette.middleware', async (importOriginal) => {
  const actual = await importOriginal<CassetteMiddlewareModule>();

  return {
    ...actual,
    createCassetteMiddleware: (
      options: Parameters<typeof actual.createCassetteMiddleware>[0],
    ) => {
      cassetteMiddlewareSpy(options);
      return actual.createCassetteMiddleware(options);
    },
  };
});

import { buildModelRegistry } from './model-registry';

describe('buildModelRegistry cassette privacy', () => {
  beforeEach(() => {
    cassetteMiddlewareSpy.mockClear();
  });

  it('populates live cassette sensitive terms from a faked git identity reader once', () => {
    const gitConfigReader = vi.fn<GitConfigReader>((key) =>
      key === 'user.name' ? 'Jane Developer' : 'jane.dev@example.test',
    );
    const registry = buildModelRegistry(
      {
        NODE_ENV: 'development',
        AI_RECORD_CASSETTES: 'on',
        AI_API_KEY: 'test-only-key',
        AI_BASE_URL: 'https://ai.example.test/v1',
      },
      {
        gitConfigReader,
        sensitiveTerms: ['Project Alias'],
      },
    );

    expect(gitConfigReader).toHaveBeenCalledTimes(2);
    registry.resolve('profileAnalyzer', 'primary', 0);
    registry.resolve('profileAnalyzer', 'fallback', 1);

    expect(gitConfigReader).toHaveBeenCalledTimes(2);
    expect(cassetteMiddlewareSpy).toHaveBeenCalled();
    for (const [options] of cassetteMiddlewareSpy.mock.calls) {
      expect(options).toEqual(
        expect.objectContaining({
          sensitiveTerms: [
            'Jane Developer',
            'Developer Jane',
            'jane.dev@example.test',
            'jane.dev',
            'Project Alias',
          ],
        }),
      );
    }
  });

  it('never records cassettes or reads the git identity in production', () => {
    const gitConfigReader = vi.fn<GitConfigReader>(() => 'Jane Developer');
    const registry = buildModelRegistry(
      {
        NODE_ENV: 'production',
        AI_RECORD_CASSETTES: 'on',
        AI_API_KEY: 'test-only-key',
        AI_BASE_URL: 'https://ai.example.test/v1',
      },
      { gitConfigReader },
    );

    registry.resolve('cvExtractor', 'primary', 0);
    registry.resolve('profileAnalyzer', 'fallback', 0);

    expect(registry.mode).toBe('live');
    expect(cassetteMiddlewareSpy).not.toHaveBeenCalled();
    expect(gitConfigReader).not.toHaveBeenCalled();
  });

  it('never writes a self-hoster\'s profile data to disk unless recording is switched on', () => {
    const gitConfigReader = vi.fn<GitConfigReader>(() => 'Jane Developer');
    const registry = buildModelRegistry(
      {
        NODE_ENV: 'development',
        AI_API_KEY: 'test-only-key',
        AI_BASE_URL: 'https://ai.example.test/v1',
      },
      { gitConfigReader },
    );

    registry.resolve('profileAnalyzer', 'primary', 0);

    expect(registry.mode).toBe('live');
    expect(cassetteMiddlewareSpy).not.toHaveBeenCalled();
    expect(gitConfigReader).not.toHaveBeenCalled();
  });
});
