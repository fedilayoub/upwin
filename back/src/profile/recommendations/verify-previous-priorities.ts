import type { ProfileFacts } from '../analysis/deterministic/profile-facts';
import type { ProfileSectionId } from '../profile-section';
import { scoreProfileCompleteness } from '../scoring/profile-completeness';
import type { CompletenessGuidanceId } from './completeness-recommendations';

export const PRIORITY_OUTCOME_STATUSES = [
  'implemented',
  'partial',
  'not-implemented',
] as const;
export type PriorityOutcomeStatus = (typeof PRIORITY_OUTCOME_STATUSES)[number];

export interface PriorityOutcome {
  status: PriorityOutcomeStatus;
  note: string;
}

export interface PreviousPriority {
  id: string;
  section: ProfileSectionId;
  signal: CompletenessGuidanceId | null;
  recommendation: string;
  reason: string;
}

export interface PreviousPriorityVerification {
  /** Priorities answered from the new snapshot alone. */
  decided: Map<string, PriorityOutcome>;
  /** Priorities whose answer depends on judging text quality. */
  undecided: PreviousPriority[];
}

/**
 * Answers "did the user do this?" for every priority code can check.
 *
 * A completeness priority was raised precisely because its check was missing,
 * so the check's status in the new snapshot is the whole answer — no comparison
 * with the previous snapshot is needed. Spec section 14: facts code can inspect
 * are not sent to the model.
 *
 * A priority whose anchor became unreadable in the new capture is left
 * undecided rather than reported as not implemented; an unreadable anchor is
 * not evidence of inaction.
 */
export function verifyPreviousPriorities(
  priorities: readonly PreviousPriority[],
  currentFacts: Pick<ProfileFacts, 'completeness'>,
): PreviousPriorityVerification {
  const checks = new Map(
    scoreProfileCompleteness(currentFacts).checks.map((check) => [
      check.id,
      check.status,
    ]),
  );
  const decided = new Map<string, PriorityOutcome>();
  const undecided: PreviousPriority[] = [];

  for (const priority of priorities) {
    const outcome = verifySignal(priority.signal, checks, currentFacts);
    if (outcome) {
      decided.set(priority.id, outcome);
      continue;
    }
    undecided.push(priority);
  }

  return { decided, undecided };
}

function verifySignal(
  signal: CompletenessGuidanceId | null,
  checks: ReadonlyMap<string, 'complete' | 'missing' | 'unreadable'>,
  currentFacts: Pick<ProfileFacts, 'completeness'>,
): PriorityOutcome | null {
  if (signal === null) return null;

  if (signal === 'avgResponseTime') {
    const isSlow = currentFacts.completeness.avgResponseTimeIsSlow;
    if (isSlow === null) return null;
    return isSlow
      ? {
          status: 'not-implemented',
          note: 'Your average response time is still slower than the target window.',
        }
      : {
          status: 'implemented',
          note: 'Your average response time is now within the target window.',
        };
  }

  const status = checks.get(signal);
  if (status === 'complete') {
    return { status: 'implemented', note: 'Confirmed on your updated profile.' };
  }
  if (status === 'missing') {
    return {
      status: 'not-implemented',
      note: 'Still not present on your updated profile.',
    };
  }

  return null;
}
