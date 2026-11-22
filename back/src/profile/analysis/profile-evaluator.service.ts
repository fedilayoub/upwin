import { Injectable } from '@nestjs/common';
import {
  buildProfileEvaluationSchema,
  type ProfileEvaluationWithReviews,
} from '../../ai/schemas/profile-evaluation.schema';
import {
  ModelRegistryService,
  type AiEvaluationResult,
} from '../../ai/model-registry.service';
import type { AssembledProfileAnalyzerPrompt } from '../../ai/prompts/profile-analyzer/assemble-profile-analyzer-prompt';
import { ModelSelectionsService } from '../../ai/model-selections.service';

@Injectable()
export class ProfileEvaluator {
  constructor(
    private readonly models: ModelRegistryService,
    private readonly selections: ModelSelectionsService,
  ) {}

  async evaluate(
    prompt: AssembledProfileAnalyzerPrompt,
  ): Promise<AiEvaluationResult<ProfileEvaluationWithReviews>> {
    const models = await this.selections.resolve('profileAnalyzer');
    return this.models.evaluate({
      capability: 'profileAnalyzer',
      // Arity of the review array is part of the schema, so it is enforced
      // where the model can still be retried.
      schema: buildProfileEvaluationSchema(prompt.previousPriorityRefs.length),
      schemaName: 'profileEvaluation',
      system: prompt.system,
      prompt: prompt.prompt,
      temperature: 0.2,
      models,
    });
  }
}
