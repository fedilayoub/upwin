import { Injectable, Logger } from '@nestjs/common';
import { DEFAULT_ANALYZER_TEMPLATE } from '../prompts/profile-analyzer/default-analyzer-template';
import { profileAnalyzerPromptVersion } from '../prompts/profile-analyzer/assemble-profile-analyzer-prompt';
import {
  analyzerTemplateContentSchema,
  type AnalyzerTemplateContent,
} from '../prompts/prompt-template.schema';
import { PromptRevisionsRepository } from './prompt-revisions.repository';

export interface ResolvedAnalyzerTemplate {
  content: AnalyzerTemplateContent;
  revisionNumber: number | null;
  revisionId: string | null;
  promptVersion: string;
}

@Injectable()
export class PromptTemplatesService {
  private readonly logger = new Logger(PromptTemplatesService.name);

  constructor(private readonly revisions: PromptRevisionsRepository) {}

  async resolveAnalyzer(): Promise<ResolvedAnalyzerTemplate> {
    const active = await this.revisions.findActive('profileAnalyzer');
    if (!active) return defaultTemplate();

    const parsed = analyzerTemplateContentSchema.safeParse(active.content);
    if (!parsed.success) {
      this.logger.warn(
        `Active profileAnalyzer prompt revision ${active.revisionNumber} failed current template validation; using the code default.`,
      );
      return defaultTemplate();
    }

    return {
      content: parsed.data,
      revisionNumber: active.revisionNumber,
      revisionId: active.id,
      promptVersion: `${profileAnalyzerPromptVersion}+r${active.revisionNumber}`,
    };
  }
}

function defaultTemplate(): ResolvedAnalyzerTemplate {
  return {
    content: DEFAULT_ANALYZER_TEMPLATE,
    revisionNumber: null,
    revisionId: null,
    promptVersion: profileAnalyzerPromptVersion,
  };
}
