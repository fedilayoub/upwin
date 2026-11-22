import { describe, expect, it, vi } from 'vitest';
import type { ModelRegistryService } from '../../ai/model-registry.service';
import type { ModelSelectionsService } from '../../ai/model-selections.service';
import { ProfileEvaluator } from './profile-evaluator.service';

describe('ProfileEvaluator model selection', () => {
  it('forwards the resolved admin ids to the model registry', async () => {
    const evaluate = vi.fn().mockResolvedValue({ requestedModelId: 'admin-primary' });
    const selections = {
      resolve: vi.fn().mockResolvedValue({
        primary: 'admin-primary',
        fallback: 'admin-fallback',
        source: 'selection',
        warnings: [],
      }),
    } as unknown as ModelSelectionsService;
    const evaluator = new ProfileEvaluator(
      { evaluate } as unknown as ModelRegistryService,
      selections,
    );

    await evaluator.evaluate({
      system: 'system',
      prompt: 'prompt',
      promptVersion: 'profile-analyzer-v6',
      previousPriorityRefs: [],
    });

    expect(evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        models: {
          primary: 'admin-primary',
          fallback: 'admin-fallback',
          source: 'selection',
          warnings: [],
        },
      }),
    );
  });
});
