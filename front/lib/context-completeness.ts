import type { FreelancerContextFields } from '@/lib/api';

/**
 * The context slots the review and summary UI reports on. `canConfirmFreelancerContext`
 * only asks whether *one* slot is filled; completeness answers the more useful
 * question a freelancer actually has — which parts are still missing.
 */
export const CONTEXT_SLOTS = [
  'experienceYears',
  'roles',
  'skills',
  'portfolio',
  'targetRole',
  'targetClients',
  'targetIndustries',
  'targetRate',
  'tone',
  'services',
] as const;

export type ContextSlot = (typeof CONTEXT_SLOTS)[number];

export interface ContextCompleteness {
  /** Filled slot count. */
  filled: number;
  /** Slots this context still has nothing for, in `CONTEXT_SLOTS` order. */
  missing: ContextSlot[];
  /** 0–100, rounded. */
  percent: number;
  /** Total slot count, so callers render "4 / 10" without re-deriving it. */
  total: number;
}

export function contextSlotFilled(
  fields: FreelancerContextFields,
  slot: ContextSlot,
): boolean {
  switch (slot) {
    case 'experienceYears':
      return fields.experience.years !== undefined;
    case 'roles':
      return fields.experience.roles.length > 0;
    case 'skills':
      return fields.skills.length > 0;
    case 'portfolio':
      return fields.portfolio.length > 0;
    case 'targetRole':
      return Boolean(fields.positioning.targetRole);
    case 'targetClients':
      return (fields.positioning.targetClients?.length ?? 0) > 0;
    case 'targetIndustries':
      return (fields.positioning.targetIndustries?.length ?? 0) > 0;
    case 'targetRate':
      return fields.positioning.targetRate !== undefined;
    case 'tone':
      return Boolean(fields.preferences.tone);
    case 'services':
      return (fields.preferences.services?.length ?? 0) > 0;
  }
}

export function freelancerContextCompleteness(
  fields: FreelancerContextFields,
): ContextCompleteness {
  const missing = CONTEXT_SLOTS.filter(
    (slot) => !contextSlotFilled(fields, slot),
  );
  const filled = CONTEXT_SLOTS.length - missing.length;

  return {
    filled,
    missing,
    percent: Math.round((filled / CONTEXT_SLOTS.length) * 100),
    total: CONTEXT_SLOTS.length,
  };
}
