import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { AiCapability } from '../capabilities';
import { assembleProfileAnalyzerPrompt } from '../prompts/profile-analyzer/assemble-profile-analyzer-prompt';
import { DEFAULT_ANALYZER_TEMPLATE } from '../prompts/profile-analyzer/default-analyzer-template';
import {
  analyzerTemplateContentSchema,
  type AnalyzerTemplateContent,
} from '../prompts/prompt-template.schema';
import type { PromptRevision } from '../../database/schema';
import { FreelancerContextService } from '../../freelancer-context/freelancer-context.service';
import { GOAL_OBJECTIVES } from '../../goals/goal.schema';
import { GoalsService } from '../../goals/goals.service';
import {
  inspectProfile,
  targetJobProfileFromGoal,
} from '../../profile/analysis/deterministic/profile-facts';
import { profileRubricV1, RUBRIC_ANCHOR_SCORES } from '../../profile/analysis/rubric/upwork-profile-v1';
import {
  type ComputedProfileAnalysis,
  ProfileAnalysesService,
} from '../../profile/analysis/profile-analyses.service';
import { PROFILE_SECTION_IDS } from '../../profile/profile-section';
import { ProfileSnapshotsService } from '../../profile-snapshots/profile-snapshots.service';
import type {
  CreatePromptRevision,
  UpdatePromptRevision,
} from './prompt-console.schema';
import { PromptRevisionsRepository } from './prompt-revisions.repository';
import { PromptTemplatesService } from './prompt-templates.service';

interface PromptRevisionResponse {
  id: string;
  capability: AiCapability;
  revisionNumber: number;
  status: PromptRevision['status'];
  content: AnalyzerTemplateContent;
  notes: string | null;
  createdByUserId: string;
  createdAt: string;
  activatedAt: string | null;
  retiredAt: string | null;
}

interface PromptRenderResponse {
  revisionNumber: number | null;
  promptVersion: string;
  system: string;
  prompt: string;
}

@Injectable()
export class PromptConsoleService {
  constructor(
    private readonly revisions: PromptRevisionsRepository,
    private readonly templates: PromptTemplatesService,
    private readonly goals: GoalsService,
    private readonly contexts: FreelancerContextService,
    private readonly snapshots: ProfileSnapshotsService,
    private readonly analyses: ProfileAnalysesService,
  ) {}

  async getConsole(capability: AiCapability) {
    assertSupportedCapability(capability);
    const revisions = await this.revisions.listByCapability(capability);

    return {
      codeDefault: DEFAULT_ANALYZER_TEMPLATE,
      active: (() => {
        const active = revisions.find(
          (revision) => revision.status === 'active',
        );
        return active ? toRevisionResponse(active) : null;
      })(),
      drafts: revisions
        .filter((revision) => revision.status === 'draft')
        .map(toRevisionResponse),
      blocks: templateBlockMetadata(),
    };
  }

  async listRevisions(
    capability: AiCapability,
  ): Promise<PromptRevisionResponse[]> {
    assertSupportedCapability(capability);
    return (await this.revisions.listByCapability(capability)).map(
      toRevisionResponse,
    );
  }

  async createDraft(
    capability: AiCapability,
    userId: string,
    input: CreatePromptRevision,
  ): Promise<PromptRevisionResponse> {
    assertSupportedCapability(capability);
    const content = analyzerTemplateContentSchema.parse(input.content);
    return toRevisionResponse(
      await this.revisions.createDraft({
        capability,
        content,
        notes: input.notes,
        createdByUserId: userId,
      }),
    );
  }

  async updateDraft(
    capability: AiCapability,
    revisionId: string,
    input: UpdatePromptRevision,
  ): Promise<PromptRevisionResponse> {
    assertSupportedCapability(capability);
    const revision = await this.requireRevision(capability, revisionId);
    if (revision.status !== 'draft') throw revisionConflict('edited');
    const content = analyzerTemplateContentSchema.parse(input.content);
    const updated = await this.revisions.updateDraft(
      revisionId,
      content,
      input.notes,
    );
    if (!updated) throw revisionConflict('edited');
    return toRevisionResponse(updated);
  }

  async preview(
    capability: AiCapability,
    revisionId: string,
    userId: string,
  ): Promise<{ candidate: PromptRenderResponse; baseline: PromptRenderResponse }> {
    assertSupportedCapability(capability);
    const revision = await this.requireRevision(capability, revisionId);
    const content = analyzerTemplateContentSchema.parse(revision.content);
    const scenario = await this.loadScenario(userId);
    const active = await this.templates.resolveAnalyzer();

    return {
      candidate: toPromptRender(
        assembleProfileAnalyzerPrompt(
          scenario,
          content,
          revision.revisionNumber,
        ),
        revision.revisionNumber,
      ),
      baseline: toPromptRender(
        assembleProfileAnalyzerPrompt(
          scenario,
          active.content,
          active.revisionNumber,
        ),
        active.revisionNumber,
      ),
    };
  }

  async dryRun(
    capability: AiCapability,
    revisionId: string,
    userId: string,
  ) {
    assertSupportedCapability(capability);
    const revision = await this.requireRevision(capability, revisionId);
    const content = analyzerTemplateContentSchema.parse(revision.content);
    const scenario = await this.loadScenario(userId);
    const active = await this.templates.resolveAnalyzer();

    const [candidate, baseline] = await Promise.all([
      this.analyses.computeAnalysis(
        scenario.goal,
        scenario.context,
        scenario.snapshot,
        content,
        revision.revisionNumber,
      ),
      this.analyses.computeAnalysis(
        scenario.goal,
        scenario.context,
        scenario.snapshot,
        active.content,
        active.revisionNumber,
      ),
    ]);

    return {
      candidate: toDryRunResult(candidate, revision.revisionNumber),
      baseline: toDryRunResult(baseline, active.revisionNumber),
    };
  }

  async activate(
    capability: AiCapability,
    revisionId: string,
  ): Promise<PromptRevisionResponse> {
    assertSupportedCapability(capability);
    const revision = await this.requireRevision(capability, revisionId);
    if (revision.status === 'active') throw revisionConflict('activated');
    analyzerTemplateContentSchema.parse(revision.content);
    const activated = await this.revisions.activate(revisionId, capability);
    if (!activated) throw revisionNotFound();
    return toRevisionResponse(activated);
  }

  async reset(capability: AiCapability): Promise<{ active: null }> {
    assertSupportedCapability(capability);
    await this.revisions.retireActive(capability);
    return { active: null };
  }

  private async requireRevision(
    capability: AiCapability,
    revisionId: string,
  ): Promise<PromptRevision> {
    const revision = await this.revisions.findById(revisionId);
    if (!revision || revision.capability !== capability) {
      throw revisionNotFound();
    }
    return revision;
  }

  private async loadScenario(userId: string) {
    const [goal, context, snapshot] = await Promise.all([
      this.goals.findForAnalysis(userId),
      this.contexts.findConfirmedByUserId(userId),
      this.snapshots.findLatest(userId),
    ]);
    if (!goal) {
      throw new ConflictException({
        code: 'NO_ACTIVE_GOAL',
        message: 'Configure an active goal before previewing a prompt.',
      });
    }
    if (!context) {
      throw new ConflictException({
        code: 'CONTEXT_INCOMPLETE',
        message: 'Confirm your freelancer context before previewing a prompt.',
      });
    }
    if (!snapshot) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Capture a profile snapshot before previewing a prompt.',
      });
    }
    const targetJobProfile = targetJobProfileFromGoal(goal);
    return {
      goal,
      context,
      snapshot,
      targetJobProfile,
      facts: inspectProfile(snapshot, targetJobProfile),
    };
  }
}

function assertSupportedCapability(
  capability: AiCapability,
): asserts capability is 'profileAnalyzer' {
  if (capability !== 'profileAnalyzer') {
    throw new UnprocessableEntityException({
      code: 'PROMPT_CAPABILITY_UNSUPPORTED',
      message: 'Only profileAnalyzer is supported by the prompt console.',
    });
  }
}

function toRevisionResponse(revision: PromptRevision): PromptRevisionResponse {
  return {
    id: revision.id,
    capability: revision.capability,
    revisionNumber: revision.revisionNumber,
    status: revision.status,
    content: analyzerTemplateContentSchema.parse(revision.content),
    notes: revision.notes,
    createdByUserId: revision.createdByUserId,
    createdAt: revision.createdAt.toISOString(),
    activatedAt: revision.activatedAt?.toISOString() ?? null,
    retiredAt: revision.retiredAt?.toISOString() ?? null,
  };
}

function toPromptRender(
  prompt: ReturnType<typeof assembleProfileAnalyzerPrompt>,
  revisionNumber: number | null,
): PromptRenderResponse {
  return { revisionNumber, ...prompt };
}

function toDryRunResult(
  computed: ComputedProfileAnalysis,
  revisionNumber: number | null,
) {
  return {
    revisionNumber,
    winningScore: computed.winningScore,
    completenessScore: computed.completenessScore,
    summary: computed.summary,
    sectionScores: computed.sectionScores,
    prompt: toPromptRender(computed.prompt, revisionNumber),
    versions: {
      prompt: computed.prompt.promptVersion,
      provider: computed.provider,
      model: computed.model,
      ...(computed.gateway === null ? {} : { gateway: computed.gateway }),
    },
  };
}

function templateBlockMetadata() {
  return {
    systemPersona: { label: 'System persona', maxLength: 2_000 },
    policy: { label: 'Analyzer policy', maxLength: 4_000 },
    goalStrategies: GOAL_OBJECTIVES.map((objective) => ({
      objective,
      label: objective
        .split('-')
        .map((word) => word[0]?.toUpperCase() + word.slice(1))
        .join(' '),
      maxLength: 600,
    })),
    sections: PROFILE_SECTION_IDS.map((sectionId) => ({
      id: sectionId,
      label: profileRubricV1[sectionId].label,
      criteria: profileRubricV1[sectionId].criteria
        .filter((criterion) => criterion.source === 'ai')
        .map((criterion) => ({
          id: criterion.id,
          label: criterion.label,
          anchors: RUBRIC_ANCHOR_SCORES.map((score) => ({
            score,
            label: String(score),
            maxLength: 400,
          })),
        })),
    })),
  };
}

function revisionNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'NOT_FOUND',
    message: 'Prompt revision not found.',
  });
}

function revisionConflict(action: string): ConflictException {
  return new ConflictException({
    code: 'PROMPT_REVISION_CONFLICT',
    message: `Only an eligible prompt revision can be ${action}.`,
  });
}
