import { describe, expect, it } from 'vitest';
import { developmentDefaults, resolveCapabilityModels } from './capabilities';

describe('resolveCapabilityModels', () => {
  it('uses the defaults when nothing is configured', () => {
    expect(resolveCapabilityModels({})).toEqual(developmentDefaults);
  });

  it('retries the configured primary when no fallback is set', () => {
    const models = resolveCapabilityModels({
      AI_MODEL_PROFILE_ANALYZER_PRIMARY: 'llama3.1:8b',
    });

    expect(models.profileAnalyzer).toEqual({
      primary: 'llama3.1:8b',
      fallback: 'llama3.1:8b',
    });
  });

  it('keeps an explicit fallback', () => {
    const models = resolveCapabilityModels({
      AI_MODEL_PROPOSAL_WRITER_PRIMARY: 'openai/gpt-4.1-mini',
      AI_MODEL_PROPOSAL_WRITER_FALLBACK: 'anthropic/claude-haiku-4.5',
    });

    expect(models.proposalWriter).toEqual({
      primary: 'openai/gpt-4.1-mini',
      fallback: 'anthropic/claude-haiku-4.5',
    });
  });

  it('uses AI_MODEL for every capability without its own key', () => {
    const models = resolveCapabilityModels({
      AI_MODEL: 'llama3.1:8b',
      AI_MODEL_CV_EXTRACTOR_PRIMARY: 'qwen2.5:7b',
    });

    for (const [capability, ids] of Object.entries(models)) {
      const expected = capability === 'cvExtractor' ? 'qwen2.5:7b' : 'llama3.1:8b';
      expect(ids).toEqual({ primary: expected, fallback: expected });
    }
  });

  it('keeps a capability fallback over AI_MODEL', () => {
    const models = resolveCapabilityModels({
      AI_MODEL: 'openai/gpt-4.1-mini',
      AI_MODEL_PROFILE_ANALYZER_FALLBACK: 'anthropic/claude-haiku-4.5',
    });

    expect(models.profileAnalyzer).toEqual({
      primary: 'openai/gpt-4.1-mini',
      fallback: 'anthropic/claude-haiku-4.5',
    });
  });

  it('never defaults a fallback to a model from another provider', () => {
    for (const ids of Object.values(developmentDefaults)) {
      expect(ids.fallback).toBe(ids.primary);
    }
  });
});
