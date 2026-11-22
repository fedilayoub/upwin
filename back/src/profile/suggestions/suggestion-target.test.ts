import { describe, expect, it } from 'vitest';
import type { ProfileFacts } from '../analysis/deterministic/profile-facts';
import type { ProfileSuggestionField } from './profile-suggestion.schema';
import {
  resolveSuggestionTarget,
  suggestionKindForField,
} from './suggestion-target';

const EMPTY_COUNTS: ProfileFacts['counts'] = {
  skills: 0,
  portfolio: 0,
  employment: 0,
  education: 0,
  certifications: 0,
  languages: 0,
};

const POPULATED_COUNTS: ProfileFacts['counts'] = {
  skills: 4,
  portfolio: 2,
  employment: 3,
  education: 1,
  certifications: 1,
  languages: 2,
};

describe('suggestionKindForField', () => {
  it.each<{
    empty: 'rewrite' | 'fill';
    field: ProfileSuggestionField;
    populated: 'rewrite' | 'fill';
  }>([
    { field: 'title', empty: 'rewrite', populated: 'rewrite' },
    { field: 'overview', empty: 'rewrite', populated: 'rewrite' },
    { field: 'skills', empty: 'fill', populated: 'fill' },
    { field: 'portfolio', empty: 'fill', populated: 'fill' },
    { field: 'employment', empty: 'fill', populated: 'rewrite' },
  ])(
    'classifies $field in empty and populated states',
    ({ empty, field, populated }) => {
      expect(suggestionKindForField(field, { counts: EMPTY_COUNTS })).toBe(
        empty,
      );
      expect(suggestionKindForField(field, { counts: POPULATED_COUNTS })).toBe(
        populated,
      );
    },
  );
});

describe('resolveSuggestionTarget', () => {
  it('maps analytical dimensions to explicit editable fields', () => {
    expect(
      resolveSuggestionTarget('positioning', { counts: EMPTY_COUNTS }),
    ).toEqual({
      field: 'title',
      kind: 'rewrite',
      itemIndex: null,
    });
    expect(
      resolveSuggestionTarget('goalAlignment', { counts: EMPTY_COUNTS }),
    ).toEqual({
      field: 'overview',
      kind: 'rewrite',
      itemIndex: null,
    });
    expect(
      resolveSuggestionTarget('experience', { counts: EMPTY_COUNTS }),
    ).toEqual({
      field: 'employment',
      kind: 'fill',
      itemIndex: null,
    });
    expect(resolveSuggestionTarget('trust', { counts: EMPTY_COUNTS })).toEqual({
      field: 'portfolio',
      kind: 'fill',
      itemIndex: null,
    });
  });

  it('keeps portfolio as a field-level fill and scopes employment rewrites', () => {
    expect(
      resolveSuggestionTarget('portfolio', { counts: POPULATED_COUNTS }),
    ).toEqual({
      field: 'portfolio',
      kind: 'fill',
      itemIndex: null,
    });
    expect(
      resolveSuggestionTarget('experience', { counts: POPULATED_COUNTS }),
    ).toEqual({
      field: 'employment',
      kind: 'rewrite',
      itemIndex: 0,
    });
  });
});
