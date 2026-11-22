import type {
  ExperienceRole,
  FreelancerContextFields,
  PortfolioProject,
} from '@/lib/api';
import { normalizeList } from '@/lib/goal-validation';

export type ContextField =
  | 'experienceYears'
  | 'roles'
  | 'skills'
  | 'portfolio'
  | 'targetRole'
  | 'targetClients'
  | 'targetIndustries'
  | 'targetRate'
  | 'tone'
  | 'services'
  | 'form';

export type ContextValidationCode =
  | 'invalidNumber'
  | 'invalidUrl'
  | 'required'
  | 'tooLong'
  | 'tooManyItems';

export interface RawRoleInput {
  title: string;
  company: string;
  period: string;
  description: string;
}

export interface RawProjectInput {
  title: string;
  description: string;
  url: string;
  skills: string[];
}

export interface RawFreelancerContextInput {
  experienceYears: string;
  roles: RawRoleInput[];
  skills: string[];
  portfolio: RawProjectInput[];
  targetRole: string;
  targetClients: string[];
  targetIndustries: string[];
  targetRate: string;
  tone: string;
  services: string[];
}

export type ContextValidationResult =
  | { success: true; data: FreelancerContextFields }
  | {
      success: false;
      errors: Partial<Record<ContextField, ContextValidationCode>>;
    };

const MAX_TEXT = 5_000;
const MAX_ITEMS = 100;
const MAX_RATE = 1_000_000;

export function validateFreelancerContextInput(
  input: RawFreelancerContextInput,
): ContextValidationResult {
  const errors: Partial<Record<ContextField, ContextValidationCode>> = {};
  const years = parseOptionalNumber(input.experienceYears, 100);
  const targetRate = parseOptionalNumber(input.targetRate, MAX_RATE);
  const roles = parseRoles(input.roles);
  const portfolio = parsePortfolio(input.portfolio);
  const skills = normalizeList(input.skills);
  const targetClients = normalizeList(input.targetClients);
  const targetIndustries = normalizeList(input.targetIndustries);
  const services = normalizeList(input.services);
  const targetRole = optionalText(input.targetRole);
  const tone = optionalText(input.tone);

  if (years === 'invalid') errors.experienceYears = 'invalidNumber';
  if (targetRate === 'invalid') errors.targetRate = 'invalidNumber';
  if (typeof roles === 'string') errors.roles = roles;
  if (typeof portfolio === 'string') errors.portfolio = portfolio;
  validateList(skills, 'skills', errors);
  validateList(targetClients, 'targetClients', errors);
  validateList(targetIndustries, 'targetIndustries', errors);
  validateList(services, 'services', errors);
  if (targetRole && targetRole.length > MAX_TEXT) errors.targetRole = 'tooLong';
  if (tone && tone.length > MAX_TEXT) errors.tone = 'tooLong';

  if (
    years === 'invalid' ||
    targetRate === 'invalid' ||
    typeof roles === 'string' ||
    typeof portfolio === 'string' ||
    Object.keys(errors).length > 0
  ) {
    return { success: false, errors };
  }

  const data: FreelancerContextFields = {
    experience: {
      ...(typeof years === 'number' ? { years } : {}),
      roles,
    },
    skills,
    portfolio,
    preferences: {
      ...(tone ? { tone } : {}),
      ...(services.length > 0 ? { services } : {}),
    },
    positioning: {
      ...(targetRole ? { targetRole } : {}),
      ...(targetClients.length > 0 ? { targetClients } : {}),
      ...(targetIndustries.length > 0 ? { targetIndustries } : {}),
      ...(typeof targetRate === 'number' ? { targetRate } : {}),
    },
  };

  if (!canConfirmFreelancerContext(data)) {
    return { success: false, errors: { form: 'required' } };
  }

  return { success: true, data };
}

/**
 * Roles and portfolio projects post one field per row, index-aligned across the
 * row's inputs, so no separator has to be reserved inside free text. A project's
 * chips are namespaced per row (`projectSkills.0`) because they are a list
 * inside a list.
 */
export function rawFreelancerContextInput(
  formData: FormData,
): RawFreelancerContextInput {
  const roleTitles = formList(formData, 'roleTitle');
  const roleCompanies = formList(formData, 'roleCompany');
  const rolePeriods = formList(formData, 'rolePeriod');
  const roleDescriptions = formList(formData, 'roleDescription');
  const projectTitles = formList(formData, 'projectTitle');
  const projectDescriptions = formList(formData, 'projectDescription');
  const projectUrls = formList(formData, 'projectUrl');

  return {
    experienceYears: formText(formData, 'experienceYears'),
    roles: roleTitles.map((title, index) => ({
      title,
      company: roleCompanies[index] ?? '',
      period: rolePeriods[index] ?? '',
      description: roleDescriptions[index] ?? '',
    })),
    skills: formList(formData, 'skills'),
    portfolio: projectTitles.map((title, index) => ({
      title,
      description: projectDescriptions[index] ?? '',
      url: projectUrls[index] ?? '',
      skills: formList(formData, `projectSkills.${index}`),
    })),
    targetRole: formText(formData, 'targetRole'),
    targetClients: formList(formData, 'targetClients'),
    targetIndustries: formList(formData, 'targetIndustries'),
    targetRate: formText(formData, 'targetRate'),
    tone: formText(formData, 'tone'),
    services: formList(formData, 'services'),
  };
}

export function canConfirmFreelancerContext(fields: FreelancerContextFields): boolean {
  return (
    fields.experience.years !== undefined ||
    fields.experience.roles.length > 0 ||
    fields.skills.length > 0 ||
    fields.portfolio.length > 0 ||
    fields.preferences.tone !== undefined ||
    (fields.preferences.services?.length ?? 0) > 0 ||
    fields.positioning.targetRole !== undefined ||
    (fields.positioning.targetClients?.length ?? 0) > 0 ||
    (fields.positioning.targetIndustries?.length ?? 0) > 0 ||
    fields.positioning.targetRate !== undefined
  );
}

function parseRoles(
  rows: RawRoleInput[],
): ExperienceRole[] | 'tooLong' | 'tooManyItems' {
  const roles = rows
    .map((row) =>
      compactObject({
        title: optionalText(row.title),
        company: optionalText(row.company),
        period: optionalText(row.period),
        description: optionalText(row.description),
      }),
    )
    .filter((role) => Object.keys(role).length > 0);

  if (roles.length > MAX_ITEMS) return 'tooManyItems';

  return roles.some((role) =>
    Object.values(role).some((value) => value.length > MAX_TEXT),
  )
    ? 'tooLong'
    : roles;
}

function parsePortfolio(
  rows: RawProjectInput[],
): PortfolioProject[] | 'invalidUrl' | 'tooLong' | 'tooManyItems' {
  const projects: PortfolioProject[] = [];

  for (const row of rows) {
    const title = optionalText(row.title);
    const description = optionalText(row.description);
    const url = optionalText(row.url);
    const skills = normalizeList(row.skills);
    if (!title && !description && !url && skills.length === 0) continue;
    if (
      [title, description, url, ...skills].some(
        (value) => value !== undefined && value.length > MAX_TEXT,
      )
    ) {
      return 'tooLong';
    }
    if (url && !isHttpUrl(url)) return 'invalidUrl';
    projects.push({ ...compactObject({ title, description, url }), skills });
  }

  return projects.length > MAX_ITEMS ? 'tooManyItems' : projects;
}

function parseOptionalNumber(
  value: string,
  max: number,
): number | 'invalid' | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= max
    ? parsed
    : 'invalid';
}

function validateList(
  list: string[],
  field: Extract<
    ContextField,
    'skills' | 'targetClients' | 'targetIndustries' | 'services'
  >,
  errors: Partial<Record<ContextField, ContextValidationCode>>,
) {
  if (list.length > MAX_ITEMS) errors[field] = 'tooManyItems';
  else if (list.some((item) => item.length > MAX_TEXT)) errors[field] = 'tooLong';
}

function optionalText(value: string): string | undefined {
  return value.trim() || undefined;
}

function compactObject<T extends Record<string, string | undefined>>(
  value: T,
): { [K in keyof T]?: string } {
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => entry[1] !== undefined),
  ) as { [K in keyof T]?: string };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
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
