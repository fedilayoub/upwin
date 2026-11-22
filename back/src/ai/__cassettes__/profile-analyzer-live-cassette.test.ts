import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { buildModelRegistry } from '../model-registry';
import { ModelRegistryService } from '../model-registry.service';
import { profileEvaluationV1Schema } from '../schemas/profile-evaluation.schema';

const cassettePath = resolve(
  process.cwd(),
  'src/ai/__cassettes__/profileAnalyzer-5ec116efcad23d4a6a902cd6086149345efc0e8c5b3d2294ce6a5f5701c45209-v0.json',
);
const cassetteSchema = z.object({
  request: z.object({
    system: z.string(),
    prompt: z.string(),
    temperature: z.number(),
  }),
  response: z.object({ object: profileEvaluationV1Schema }),
});

describe('recorded profile analysis', () => {
  it('replays through the real analyzer schema without network access', async () => {
    const cassette = cassetteSchema.parse(
      JSON.parse(await readFile(cassettePath, 'utf8')),
    );
    const originalPrompt = restoreSyntheticNames(cassette.request.prompt);
    const service = new ModelRegistryService(
      buildModelRegistry({
        NODE_ENV: 'test',
        AI_MODE: 'replay',
        AI_BASE_URL: 'https://ai.example.test/v1',
        AI_MODEL_PROFILE_ANALYZER_PRIMARY: 'gpt-4.1-nano',
      }),
    );

    await expect(
      service.evaluate({
        capability: 'profileAnalyzer',
        schema: profileEvaluationV1Schema,
        schemaName: 'profileEvaluation',
        system: cassette.request.system,
        prompt: originalPrompt,
        temperature: cassette.request.temperature,
        variantIndex: 0,
      }),
    ).resolves.toMatchObject({
      object: cassette.response.object,
      requestedModelId: 'gpt-4.1-nano',
      provider: 'openai',
      model: 'openai/gpt-4.1-nano',
      gateway: 'openai-compatible',
    });
  });
});

function restoreSyntheticNames(sanitizedPrompt: string): string {
  return [
    'Synthetic Phase Four Freelancer',
    'Synthetic Cloud Developer Certificate',
    'English',
  ].reduce(
    (prompt, name) =>
      prompt.replace('"name": "[REDACTED_NAME]"', `"name": "${name}"`),
    sanitizedPrompt,
  );
}
