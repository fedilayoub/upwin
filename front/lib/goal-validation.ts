import {
  GOAL_OBJECTIVES,
  type CreateGoalInput,
  type GoalObjective,
} from '@/lib/api';

export type GoalField =
  | 'objective'
  | 'targetRole'
  | 'targetProjectTypes'
  | 'targetClients'
  | 'preferredSkills'
  | 'targetRateMin'
  | 'targetRateMax';

export type GoalValidationCode =
  | 'required'
  | 'invalidObjective'
  | 'invalidNumber'
  | 'rateOrder'
  | 'tooManyItems'
  | 'tooLong';

export interface RawGoalInput {
  objective: string;
  targetRole: string;
  targetProjectTypes: string[];
  targetClients: string[];
  preferredSkills: string[];
  targetRateMin: string;
  targetRateMax: string;
}

export type GoalValidationResult =
  | { success: true; data: CreateGoalInput }
  | {
      success: false;
      errors: Partial<Record<GoalField, GoalValidationCode>>;
    };

const MAX_RATE = 1_000_000;
const MAX_ITEMS = 50;
const MAX_TEXT = 500;

export function validateGoalInput(input: RawGoalInput): GoalValidationResult {
  const errors: Partial<Record<GoalField, GoalValidationCode>> = {};
  const targetRole = input.targetRole.trim();
  const targetProjectTypes = normalizeList(input.targetProjectTypes);
  const targetClients = normalizeList(input.targetClients);
  const preferredSkills = normalizeList(input.preferredSkills);
  const objective = isGoalObjective(input.objective) ? input.objective : null;
  const min = parseOptionalRate(input.targetRateMin);
  const max = parseOptionalRate(input.targetRateMax);

  if (!objective) errors.objective = 'invalidObjective';
  if (!targetRole) errors.targetRole = 'required';
  else if (targetRole.length > MAX_TEXT) errors.targetRole = 'tooLong';
  validateList(targetProjectTypes, 'targetProjectTypes', errors, true);
  validateList(targetClients, 'targetClients', errors);
  validateList(preferredSkills, 'preferredSkills', errors);
  if (min === 'invalid') errors.targetRateMin = 'invalidNumber';
  if (max === 'invalid') errors.targetRateMax = 'invalidNumber';
  if (typeof min === 'number' && typeof max === 'number' && min > max) {
    errors.targetRateMax = 'rateOrder';
  }

  if (!objective || Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  const targetRate =
    typeof min === 'number' || typeof max === 'number'
      ? {
          ...(typeof min === 'number' ? { min } : {}),
          ...(typeof max === 'number' ? { max } : {}),
        }
      : null;

  return {
    success: true,
    data: {
      objective,
      targetRole,
      targetProjectTypes,
      targetClients,
      preferredSkills,
      targetRate,
    },
  };
}

export function rawGoalInput(formData: FormData): RawGoalInput {
  return {
    objective: formText(formData, 'objective'),
    targetRole: formText(formData, 'targetRole'),
    targetProjectTypes: formList(formData, 'targetProjectTypes'),
    targetClients: formList(formData, 'targetClients'),
    preferredSkills: formList(formData, 'preferredSkills'),
    targetRateMin: formText(formData, 'targetRateMin'),
    targetRateMax: formText(formData, 'targetRateMax'),
  };
}

/**
 * The chip inputs post one field per selected value, so entries arrive already
 * separated and may legitimately contain a comma ("Series A, B2B SaaS"). Only a
 * single blob — a pasted list, or a client with JavaScript disabled — is split.
 */
export function normalizeList(values: string[]): string[] {
  const items = values.length === 1 ? splitList(values[0] ?? '') : values;
  const seen = new Set<string>();

  return items
    .map((item) => item.trim())
    .filter((item) => {
      if (!item || seen.has(item)) return false;
      seen.add(item);
      return true;
    });
}

export function splitList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isGoalObjective(value: string): value is GoalObjective {
  return GOAL_OBJECTIVES.some((objective) => objective === value);
}

function parseOptionalRate(value: string): number | 'invalid' | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= MAX_RATE
    ? parsed
    : 'invalid';
}

function validateList(
  list: string[],
  field: Extract<GoalField, 'targetProjectTypes' | 'targetClients' | 'preferredSkills'>,
  errors: Partial<Record<GoalField, GoalValidationCode>>,
  required = false,
) {
  if (required && list.length === 0) errors[field] = 'required';
  else if (list.length > MAX_ITEMS) errors[field] = 'tooManyItems';
  else if (list.some((item) => item.length > MAX_TEXT)) errors[field] = 'tooLong';
}

function formText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

function formList(formData: FormData, name: string): string[] {
  return formData
    .getAll(name)
    .filter((value): value is string => typeof value === 'string');
}
