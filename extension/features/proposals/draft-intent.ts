import { storage } from '#imports';

export interface ProposalDraftIntent {
  requestedAt: number;
  ciphertext: string;
}

export const proposalDraftIntentItem =
  storage.defineItem<ProposalDraftIntent | null>(
    'session:proposal-draft-intent',
    { fallback: null },
  );

export const PROPOSAL_DRAFT_INTENT_TTL_MS = 60_000;

export function isActionableDraftIntent(
  intent: unknown,
  now: number,
): intent is ProposalDraftIntent {
  if (!isRecord(intent)) return false;
  const requestedAt = intent.requestedAt;
  if (typeof requestedAt !== 'number' || !Number.isFinite(requestedAt)) {
    return false;
  }
  if (
    typeof intent.ciphertext !== 'string' ||
    !/^~0[0-9a-f]+$/iu.test(intent.ciphertext)
  ) {
    return false;
  }

  return now - requestedAt <= PROPOSAL_DRAFT_INTENT_TTL_MS;
}

export async function consumeDraftIntent(
  intent: unknown,
  now: number,
  dependencies: {
    act: (actionable: ProposalDraftIntent) => void | Promise<void>;
    remove: () => Promise<void>;
  },
): Promise<boolean> {
  if (!isActionableDraftIntent(intent, now)) return false;

  // Delete before acting: a later panel open must never replay this capture.
  await dependencies.remove();
  await dependencies.act(intent);
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
