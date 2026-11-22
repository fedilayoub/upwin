import { Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PromptRevision } from '../../database/schema';
import { DEFAULT_ANALYZER_TEMPLATE } from '../prompts/profile-analyzer/default-analyzer-template';
import type { PromptRevisionsRepository } from './prompt-revisions.repository';
import { PromptTemplatesService } from './prompt-templates.service';

describe('PromptTemplatesService', () => {
  it('uses the byte-identical code default when no active row exists', async () => {
    const service = serviceWith(null);

    await expect(service.resolveAnalyzer()).resolves.toEqual({
      content: DEFAULT_ANALYZER_TEMPLATE,
      revisionNumber: null,
      revisionId: null,
      promptVersion: 'profile-analyzer-v6',
    });
  });

  it('resolves a valid active revision and revision-stamped version', async () => {
    const content = structuredClone(DEFAULT_ANALYZER_TEMPLATE);
    content.policy = 'Use supplied evidence and criterion anchors.';
    const service = serviceWith(revision({ content, revisionNumber: 7 }));

    await expect(service.resolveAnalyzer()).resolves.toMatchObject({
      content,
      revisionNumber: 7,
      revisionId: '018f6a77-4e90-7ab5-a3bf-15c8f850fa17',
      promptVersion: 'profile-analyzer-v6+r7',
    });
  });

  it('warns and falls back instead of breaking analyses for stale invalid content', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const invalid = structuredClone(DEFAULT_ANALYZER_TEMPLATE);
    delete invalid.criterionAnchors.positioningClarity;
    const service = serviceWith(revision({ content: invalid }));

    await expect(service.resolveAnalyzer()).resolves.toMatchObject({
      content: DEFAULT_ANALYZER_TEMPLATE,
      revisionNumber: null,
      revisionId: null,
      promptVersion: 'profile-analyzer-v6',
    });
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).not.toContain(
      DEFAULT_ANALYZER_TEMPLATE.policy,
    );
    warn.mockRestore();
  });
});

function serviceWith(active: PromptRevision | null): PromptTemplatesService {
  const repository = {
    findActive: vi.fn().mockResolvedValue(active),
  } as unknown as PromptRevisionsRepository;
  return new PromptTemplatesService(repository);
}

function revision(
  overrides: Partial<PromptRevision> = {},
): PromptRevision {
  return {
    id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa17',
    capability: 'profileAnalyzer',
    revisionNumber: 1,
    status: 'active',
    content: DEFAULT_ANALYZER_TEMPLATE,
    notes: null,
    createdByUserId: '018f6a77-4e90-7ab5-a3bf-15c8f850fa10',
    createdAt: new Date('2026-08-25T12:00:00.000Z'),
    activatedAt: new Date('2026-08-25T12:05:00.000Z'),
    retiredAt: null,
    ...overrides,
  };
}
