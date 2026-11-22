import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import {
  buildCvExtractionPrompt,
  CV_EXTRACTION_PROMPT_VERSION,
} from '../ai/prompts/cv-extraction.prompt';
import {
  cvExtractionSchema,
  normalizeProjectUrl,
  stripModelNulls,
  type CvExtraction,
} from '../ai/schemas/cv-extraction.schema';
import {
  AiEvaluationError,
  ModelRegistryService,
} from '../ai/model-registry.service';
import {
  freelancerContextFieldsSchema,
  type FreelancerContextFields,
} from './freelancer-context.schema';
import { type CvUpload, CvTextService } from './cv-text.service';

@Injectable()
export class CvExtractionService {
  private readonly logger = new Logger(CvExtractionService.name);

  constructor(
    private readonly textExtractor: CvTextService,
    private readonly models: ModelRegistryService,
  ) {}

  async extract(upload: CvUpload): Promise<FreelancerContextFields> {
    const cvText = await this.textExtractor.extract(upload);
    const prompt = buildCvExtractionPrompt(cvText);

    try {
      const result = await this.models.evaluate({
        capability: 'cvExtractor',
        schema: cvExtractionSchema,
        schemaName: CV_EXTRACTION_PROMPT_VERSION,
        system: prompt.system,
        prompt: prompt.prompt,
        temperature: 0.1,
      });

      // API/domain validation happens after the model-facing schema. This is
      // where numeric bounds are enforced without emitting them to a provider.
      const bounded = freelancerContextFieldsSchema.safeParse(
        toDomainInput(result.object),
      );

      if (!bounded.success) {
        // Without this the cause is swallowed by the global filter and the
        // client sees only "The CV could not be extracted", which is
        // undebuggable. Log the field paths, never the values.
        this.logger.error(
          `CV extraction failed domain validation: ${bounded.error.issues
            .map(
              (issue) => `${issue.path.join('.') || '(root)'}: ${issue.code}`,
            )
            .join(', ')}`,
        );
        throw aiExtractionFailed(bounded.error);
      }

      return bounded.data;
    } catch (error: unknown) {
      if (error instanceof BadGatewayException) throw error;
      if (error instanceof AiEvaluationError) throw aiExtractionFailed(error);
      throw error;
    }
  }
}

/**
 * Bridges the model-facing shape to the domain shape: drops the nulls the model
 * uses for "not stated", and repairs scheme-less URLs copied verbatim from the
 * CV text layer.
 */
function toDomainInput(extraction: CvExtraction): unknown {
  const repaired: CvExtraction = {
    ...extraction,
    portfolio: extraction.portfolio.map((project) => ({
      ...project,
      url: project.url === null ? null : normalizeProjectUrl(project.url),
    })),
  };

  return stripModelNulls(repaired);
}

function aiExtractionFailed(cause: unknown): BadGatewayException {
  return new BadGatewayException(
    {
      code: 'AI_EVALUATION_FAILED',
      message:
        'The CV could not be extracted. Please try again or enter details manually.',
    },
    { cause },
  );
}
