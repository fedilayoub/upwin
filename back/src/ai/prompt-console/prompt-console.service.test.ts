import { describe, expect, it, vi } from 'vitest';
import type { PromptRevision } from '../../database/schema';
import type { FreelancerContextService } from '../../freelancer-context/freelancer-context.service';
import type { GoalsService } from '../../goals/goals.service';
import type { ProfileAnalysesService } from '../../profile/analysis/profile-analyses.service';
import { PROFILE_SECTION_IDS } from '../../profile/profile-section';
import {
  UNREADABLE_PROFILE_COMPLETENESS,
  type ProfileSnapshot,
} from '../../profile-snapshots/profile-snapshot.schema';
import type { ProfileSnapshotsService } from '../../profile-snapshots/profile-snapshots.service';
import { DEFAULT_ANALYZER_TEMPLATE } from '../prompts/profile-analyzer/default-analyzer-template';
import { PromptConsoleService } from './prompt-console.service';
import type { PromptRevisionsRepository } from './prompt-revisions.repository';
import type { PromptTemplatesService } from './prompt-templates.service';

const USER_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa10';
const REVISION_ID = '018f6a77-4e90-7ab5-a3bf-15c8f850fa17';

describe('PromptConsoleService', () => {
  it('rejects PATCH on active revisions and a second activation', async () => {
    const updateDraft = vi.fn();
    const activate = vi.fn();
    const service = serviceWith({
      revision: revision({ status: 'active' }),
      updateDraft,
      activate,
    });

    await expect(
      service.updateDraft('profileAnalyzer', REVISION_ID, {
        content: DEFAULT_ANALYZER_TEMPLATE,
        notes: null,
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      service.activate('profileAnalyzer', REVISION_ID),
    ).rejects.toMatchObject({ status: 409 });
    expect(updateDraft).not.toHaveBeenCalled();
    expect(activate).not.toHaveBeenCalled();
  });

  it('allows rollback to a retired revision and reset leaves no active row', async () => {
    const target = revision({ status: 'retired' });
    const activate = vi.fn().mockResolvedValue({
      ...target,
      status: 'active',
      activatedAt: new Date('2026-08-25T13:00:00.000Z'),
      retiredAt: null,
    });
    const retireActive = vi.fn().mockResolvedValue(target);
    const service = serviceWith({ revision: target, activate, retireActive });

    await expect(
      service.activate('profileAnalyzer', REVISION_ID),
    ).resolves.toMatchObject({ status: 'active' });
    await expect(service.reset('profileAnalyzer')).resolves.toEqual({
      active: null,
    });
    expect(activate).toHaveBeenCalledWith(REVISION_ID, 'profileAnalyzer');
    expect(retireActive).toHaveBeenCalledWith('profileAnalyzer');
  });

  it('dry-runs candidate and baseline on the caller own data without persisting', async () => {
    const computeAnalysis = vi
      .fn()
      .mockResolvedValueOnce(computed(81, 'profile-analyzer-v6+r1'))
      .mockResolvedValueOnce(computed(70, 'profile-analyzer-v6'));
    const persist = vi.fn();
    const findGoal = vi.fn().mockResolvedValue(goal);
    const findContext = vi.fn().mockResolvedValue(context);
    const findSnapshot = vi.fn().mockResolvedValue(snapshot);
    const service = serviceWith({
      revision: revision({ status: 'draft' }),
      computeAnalysis,
      persist,
      findGoal,
      findContext,
      findSnapshot,
    });

    await expect(
      service.dryRun('profileAnalyzer', REVISION_ID, USER_ID),
    ).resolves.toMatchObject({
      candidate: { winningScore: 81 },
      baseline: { winningScore: 70 },
    });
    expect(computeAnalysis).toHaveBeenCalledTimes(2);
    expect(persist).not.toHaveBeenCalled();
    expect(findGoal).toHaveBeenCalledWith(USER_ID);
    expect(findContext).toHaveBeenCalledWith(USER_ID);
    expect(findSnapshot).toHaveBeenCalledWith(USER_ID);
  });
});

function serviceWith(options: {
  revision: PromptRevision;
  updateDraft?: ReturnType<typeof vi.fn>;
  activate?: ReturnType<typeof vi.fn>;
  retireActive?: ReturnType<typeof vi.fn>;
  computeAnalysis?: ReturnType<typeof vi.fn>;
  persist?: ReturnType<typeof vi.fn>;
  findGoal?: ReturnType<typeof vi.fn>;
  findContext?: ReturnType<typeof vi.fn>;
  findSnapshot?: ReturnType<typeof vi.fn>;
}): PromptConsoleService {
  const revisions = {
    findById: vi.fn().mockResolvedValue(options.revision),
    updateDraft: options.updateDraft ?? vi.fn(),
    activate: options.activate ?? vi.fn(),
    retireActive: options.retireActive ?? vi.fn(),
  } as unknown as PromptRevisionsRepository;
  const templates = {
    resolveAnalyzer: vi.fn().mockResolvedValue({
      content: DEFAULT_ANALYZER_TEMPLATE,
      revisionNumber: null,
      revisionId: null,
      promptVersion: 'profile-analyzer-v6',
    }),
  } as unknown as PromptTemplatesService;
  const goals = {
    findForAnalysis: options.findGoal ?? vi.fn().mockResolvedValue(goal),
  } as unknown as GoalsService;
  const contexts = {
    findConfirmedByUserId:
      options.findContext ?? vi.fn().mockResolvedValue(context),
  } as unknown as FreelancerContextService;
  const snapshots = {
    findLatest: options.findSnapshot ?? vi.fn().mockResolvedValue(snapshot),
  } as unknown as ProfileSnapshotsService;
  const analyses = {
    computeAnalysis: options.computeAnalysis ?? vi.fn(),
    persist: options.persist ?? vi.fn(),
  } as unknown as ProfileAnalysesService;

  return new PromptConsoleService(
    revisions,
    templates,
    goals,
    contexts,
    snapshots,
    analyses,
  );
}

function revision(overrides: Partial<PromptRevision> = {}): PromptRevision {
  return {
    id: REVISION_ID,
    capability: 'profileAnalyzer',
    revisionNumber: 1,
    status: 'draft',
    content: DEFAULT_ANALYZER_TEMPLATE,
    notes: null,
    createdByUserId: USER_ID,
    createdAt: new Date('2026-08-25T12:00:00.000Z'),
    activatedAt: null,
    retiredAt: null,
    ...overrides,
  };
}

const goal = {
  id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa11',
  objective: 'first-client' as const,
  targetRole: 'React Developer',
  targetProjectTypes: ['SaaS'],
  targetClients: ['startups'],
  preferredSkills: ['React'],
  targetRate: null,
  isActive: true,
  createdAt: '2026-08-25T12:00:00.000Z',
  updatedAt: '2026-08-25T12:00:00.000Z',
};
const context = {
  experience: { roles: [] },
  skills: ['React'],
  portfolio: [],
  preferences: {},
  positioning: { targetRole: 'React Developer' },
};
const snapshot: ProfileSnapshot = {
  source: 'manual',
  capturedAt: '2026-08-25T12:00:00.000Z',
  completeness: UNREADABLE_PROFILE_COMPLETENESS,
  profile: {
    title: 'React Developer',
    skills: ['React'],
    portfolio: [],
    employment: [],
    education: [],
    certifications: [],
    languages: [],
  },
};

function computed(winningScore: number, promptVersion: string) {
  return {
    prompt: { system: 'system', prompt: 'prompt', promptVersion },
    winningScore,
    completenessScore: null,
    sectionScores: PROFILE_SECTION_IDS.map((id) => ({
      id,
      score: winningScore,
      criteria: [],
    })),
    summary: 'Summary',
    requestedModel: 'requested',
    gateway: 'openai-compatible',
    provider: 'provider',
    model: 'provider/model',
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    recommendations: [],
  };
}
