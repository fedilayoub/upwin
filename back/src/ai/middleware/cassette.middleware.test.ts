import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateObject, wrapLanguageModel } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { z } from 'zod';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readGitAuthorSensitiveTerms,
  type GitConfigReader,
} from '../git-author-identity';
import {
  CassetteNotFoundError,
  createCassetteMiddleware,
} from './cassette.middleware';

describe('cassette middleware', () => {
  let cassetteDirectory: string;

  beforeEach(async () => {
    cassetteDirectory = await mkdtemp(join(tmpdir(), 'upwin-cassettes-'));
  });

  afterEach(async () => {
    await rm(cassetteDirectory, { recursive: true, force: true });
  });

  it('throws with the record command when replay has no matching cassette', async () => {
    const baseGenerate = vi.fn(() => {
      throw new Error('Replay must not fall through to a base model.');
    });
    const model = wrapLanguageModel({
      model: new MockLanguageModelV4({ doGenerate: baseGenerate }),
      middleware: createCassetteMiddleware({
        mode: 'read',
        capability: 'profileAnalyzer',
        requestedModelId: 'gpt-4.1-nano',
        variantIndex: 0,
        cassetteDirectory,
      }),
    });

    const evaluation = generateObject({
      model,
      schema: z.object({ answer: z.string() }),
      schemaName: 'probe',
      system: 'System prompt',
      prompt: 'User prompt',
      temperature: 0.2,
      maxRetries: 0,
    });

    await expect(evaluation).rejects.toBeInstanceOf(CassetteNotFoundError);
    await expect(evaluation).rejects.toThrowError(
      /profileAnalyzer[\s\S]*AI_RECORD_CASSETTES=on pnpm start:dev/,
    );
    expect(baseGenerate).not.toHaveBeenCalled();
  });

  it('records once and replays identical structured output without calling a base model', async () => {
    const schema = z.object({ answer: z.string() });
    const liveGenerate = vi.fn(async () => ({
      content: [{ type: 'text' as const, text: '{"answer":"recorded"}' }],
      finishReason: { unified: 'stop' as const, raw: 'stop' },
      usage: {
        inputTokens: {
          total: 10,
          noCache: 8,
          cacheRead: 2,
          cacheWrite: undefined,
        },
        outputTokens: { total: 4, text: 4, reasoning: undefined },
      },
      warnings: [],
      response: { modelId: 'openai/gpt-4.1-nano' },
    }));
    const options = {
      capability: 'profileAnalyzer' as const,
      requestedModelId: 'gpt-4.1-nano',
      variantIndex: 0,
      cassetteDirectory,
    };
    const recordModel = wrapLanguageModel({
      model: new MockLanguageModelV4({ doGenerate: liveGenerate }),
      middleware: createCassetteMiddleware({ ...options, mode: 'write' }),
    });
    const request = {
      schema,
      schemaName: 'probe',
      system: 'System prompt',
      prompt: 'User prompt',
      temperature: 0.2,
      maxRetries: 0,
    } as const;
    const recorded = await generateObject({ model: recordModel, ...request });

    const replayGenerate = vi.fn(() => {
      throw new Error('A cassette hit must not call the replay base model.');
    });
    const replayModel = wrapLanguageModel({
      model: new MockLanguageModelV4({ doGenerate: replayGenerate }),
      middleware: createCassetteMiddleware({ ...options, mode: 'read' }),
    });
    const replayed = await generateObject({ model: replayModel, ...request });

    expect(replayed.object).toEqual(recorded.object);
    expect(replayed.usage).toEqual(recorded.usage);
    expect(replayed.response.modelId).toBe('openai/gpt-4.1-nano');
    expect(liveGenerate).toHaveBeenCalledOnce();
    expect(replayGenerate).not.toHaveBeenCalled();
  });

  it('sanitizes profile names and email addresses before writing', async () => {
    const model = wrapLanguageModel({
      model: new MockLanguageModelV4({
        doGenerate: {
          content: [{ type: 'text', text: '{"answer":"Jane Developer"}' }],
          finishReason: { unified: 'stop', raw: 'stop' },
          usage: {
            inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: 1, text: 1, reasoning: 0 },
          },
          warnings: [],
          response: { modelId: 'openai/gpt-4.1-nano' },
        },
      }),
      middleware: createCassetteMiddleware({
        mode: 'write',
        capability: 'profileAnalyzer',
        requestedModelId: 'gpt-4.1-nano',
        variantIndex: 0,
        cassetteDirectory,
        sensitiveTerms: ['Jane Developer'],
      }),
    });

    await generateObject({
      model,
      schema: z.object({ answer: z.string() }),
      prompt: '{"name":"Jane Developer","email":"jane@example.com"}',
      maxRetries: 0,
    });

    const [fileName] = await import('node:fs/promises').then(({ readdir }) =>
      readdir(cassetteDirectory),
    );
    expect(fileName).toBeDefined();
    const source = await readFile(
      join(cassetteDirectory, fileName ?? ''),
      'utf8',
    );

    expect(source).not.toContain('Jane Developer');
    expect(source).not.toContain('jane@example.com');
    expect(source).toContain('[REDACTED_NAME]');
    expect(source).toContain('[REDACTED_EMAIL]');
  });

  it('records successfully when no git identity is available', async () => {
    const noGitIdentity = vi.fn<GitConfigReader>(() => undefined);
    const model = wrapLanguageModel({
      model: recordedAnswerModel('recorded without an identity'),
      middleware: createCassetteMiddleware({
        mode: 'write',
        capability: 'profileAnalyzer',
        requestedModelId: 'gpt-4.1-nano',
        variantIndex: 0,
        cassetteDirectory,
        sensitiveTerms: readGitAuthorSensitiveTerms(noGitIdentity),
      }),
    });

    await generateObject({
      model,
      schema: z.object({ answer: z.string() }),
      prompt: 'A recording with no configured git identity.',
      maxRetries: 0,
    });

    const fileNames = await import('node:fs/promises').then(({ readdir }) =>
      readdir(cassetteDirectory),
    );
    expect(fileNames).toHaveLength(1);
    expect(noGitIdentity).toHaveBeenCalledTimes(2);
  });

  it('redacts every git-author term that the committed-cassette guard checks', async () => {
    const gitConfigReader = vi.fn<GitConfigReader>((key) =>
      key === 'user.name' ? 'Jane Developer' : 'jane.dev@example.test',
    );
    const sensitiveTerms = readGitAuthorSensitiveTerms(gitConfigReader);
    const model = wrapLanguageModel({
      model: recordedAnswerModel('DEVELOPER JANE owns jane.dev artifacts.'),
      middleware: createCassetteMiddleware({
        mode: 'write',
        capability: 'profileAnalyzer',
        requestedModelId: 'gpt-4.1-nano',
        variantIndex: 0,
        cassetteDirectory,
        sensitiveTerms,
      }),
    });

    await generateObject({
      model,
      schema: z.object({ answer: z.string() }),
      prompt:
        'The configured author jAnE dEvElOpEr appears in prose at jane.dev@example.test.',
      maxRetries: 0,
    });

    const [fileName] = await import('node:fs/promises').then(({ readdir }) =>
      readdir(cassetteDirectory),
    );
    expect(fileName).toBeDefined();
    const source = await readFile(
      join(cassetteDirectory, fileName ?? ''),
      'utf8',
    );

    for (const term of sensitiveTerms) {
      expect(source.toLocaleLowerCase()).not.toContain(
        term.toLocaleLowerCase(),
      );
    }
    expect(source).toContain('[REDACTED]');
    expect(source).toContain('[REDACTED_EMAIL]');
  });
});

function recordedAnswerModel(answer: string): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doGenerate: {
      content: [{ type: 'text', text: JSON.stringify({ answer }) }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 1, text: 1, reasoning: 0 },
      },
      warnings: [],
      response: { modelId: 'openai/gpt-4.1-nano' },
    },
  });
}
