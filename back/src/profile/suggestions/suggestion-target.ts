import type { ProfileFacts } from '../analysis/deterministic/profile-facts';
import type { ProfileSectionId } from '../profile-section';
import type {
  ProfileSuggestionField,
  ProfileSuggestionKind,
} from './profile-suggestion.schema';

export interface ProfileSuggestionTarget {
  field: ProfileSuggestionField;
  kind: ProfileSuggestionKind;
  itemIndex: number | null;
}

const SECTION_TARGET_FIELDS: Record<ProfileSectionId, ProfileSuggestionField> =
  {
    positioning: 'title',
    overview: 'overview',
    title: 'title',
    skills: 'skills',
    portfolio: 'portfolio',
    experience: 'employment',
    trust: 'portfolio',
    goalAlignment: 'overview',
  };

export function suggestionKindForField(
  field: ProfileSuggestionField,
  facts: Pick<ProfileFacts, 'counts'>,
): ProfileSuggestionKind {
  switch (field) {
    case 'title':
    case 'overview':
      return 'rewrite';
    case 'skills':
      return 'fill';
    case 'portfolio':
      // Upwork shelf capture exposes portfolio titles, not descriptions. There
      // is therefore no truthful source text to rewrite, even when entries
      // exist. Employment descriptions are captured and remain rewritable.
      return 'fill';
    case 'employment':
      return facts.counts.employment > 0 ? 'rewrite' : 'fill';
    default:
      return assertNever(field);
  }
}

export function resolveSuggestionTarget(
  section: ProfileSectionId,
  facts: Pick<ProfileFacts, 'counts'>,
): ProfileSuggestionTarget {
  const field = SECTION_TARGET_FIELDS[section];
  const kind = suggestionKindForField(field, facts);
  const isStructuredRewrite = kind === 'rewrite' && field === 'employment';

  return {
    field,
    kind,
    itemIndex: isStructuredRewrite ? 0 : null,
  };
}

export function suggestionTargetKey(target: ProfileSuggestionTarget): string {
  return `${target.field}:${target.itemIndex ?? 'none'}`;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled profile suggestion field: ${String(value)}`);
}
