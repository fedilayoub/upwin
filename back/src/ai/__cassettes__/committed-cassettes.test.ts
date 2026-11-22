import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { CassetteNotFoundError } from '../middleware/cassette.middleware';
import { readGitAuthorSensitiveTerms } from '../git-author-identity';
import { buildModelRegistry } from '../model-registry';
import { ModelRegistryService } from '../model-registry.service';

const cassetteDirectory = resolve(process.cwd(), 'src/ai/__cassettes__');
const phase8ProbeSchema = z.object({
  capability: z.literal('profileAnalyzer'),
  fixtureVersion: z.literal('phase-8-gateway-probe'),
  probeScore: z.number(),
});

describe('committed AI cassettes', () => {
  it('replays the committed probe with identical output and no network', async () => {
    const registry = buildModelRegistry({
      NODE_ENV: 'test',
      AI_MODE: 'replay',
      AI_BASE_URL: 'https://ai.example.test/v1',
      AI_MODEL_PROFILE_ANALYZER_PRIMARY: 'gpt-4.1-nano',
    });
    const service = new ModelRegistryService(registry);

    await expect(
      service.evaluate({
        capability: 'profileAnalyzer',
        schema: phase8ProbeSchema,
        schemaName: 'profileAnalyzerGatewayProbe',
        system: 'Gateway structured-output cassette probe.',
        prompt: 'Return the phase-8 gateway probe object for profileAnalyzer.',
        temperature: 0.2,
        variantIndex: 0,
      }),
    ).resolves.toMatchObject({
      object: {
        capability: 'profileAnalyzer',
        fixtureVersion: 'phase-8-gateway-probe',
        probeScore: 85,
      },
      requestedModelId: 'gpt-4.1-nano',
      provider: 'openai',
      model: 'openai/gpt-4.1-nano',
      gateway: 'openai-compatible',
    });
  });

  it('throws instead of repeating v0 when the next replay variant is exhausted', async () => {
    const service = new ModelRegistryService(
      buildModelRegistry({
        NODE_ENV: 'test',
        AI_MODE: 'replay',
        AI_BASE_URL: 'https://ai.example.test/v1',
        AI_MODEL_PROFILE_ANALYZER_PRIMARY: 'gpt-4.1-nano',
      }),
    );

    const evaluation = service.evaluate({
      capability: 'profileAnalyzer',
      schema: phase8ProbeSchema,
      schemaName: 'profileAnalyzerGatewayProbe',
      system: 'Gateway structured-output cassette probe.',
      prompt: 'Return the phase-8 gateway probe object for profileAnalyzer.',
      temperature: 0.2,
      variantIndex: 1,
    });

    await expect(evaluation).rejects.toBeInstanceOf(CassetteNotFoundError);
    await expect(evaluation).rejects.toThrowError(
      /AI_RECORD_CASSETTES=on pnpm start:dev/,
    );
  });

  it('contains no email address or local git author identity', async () => {
    const fileNames = (await readdir(cassetteDirectory)).filter((name) =>
      name.endsWith('.json'),
    );
    const cassettes = await Promise.all(
      fileNames.map(async (name) => ({
        name,
        source: await readFile(resolve(cassetteDirectory, name), 'utf8'),
      })),
    );
    const gitAuthorSensitiveTerms = readGitAuthorSensitiveTerms();
    const emailLeaks = cassettes
      .filter(({ source }) => /[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(source))
      .map(({ name }) => name);

    expect(fileNames.length).toBeGreaterThan(0);
    expect(emailLeaks, 'cassette files containing an email address').toEqual(
      [],
    );
    for (const term of gitAuthorSensitiveTerms) {
      const identityLeaks = cassettes
        .filter(({ source }) =>
          source.toLocaleLowerCase().includes(term.toLocaleLowerCase()),
        )
        .map(({ name }) => name);
      expect(
        identityLeaks,
        'cassette files containing the local git author identity',
      ).toEqual([]);
    }
  });
});
