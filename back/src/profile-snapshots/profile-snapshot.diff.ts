import type { PortfolioItem, ProfileSnapshot } from './profile-snapshot.schema';

type ChangeStatus = 'changed' | 'unchanged';

export interface ProfileSnapshotChanges {
  title: { status: ChangeStatus };
  overview: { status: 'updated' | 'unchanged' };
  portfolio: {
    status: ChangeStatus;
    added: number;
    removed: number;
  };
  skills: {
    status: ChangeStatus;
    added: string[];
    removed: string[];
  };
}

export function diffProfileSnapshots(
  previous: ProfileSnapshot,
  current: ProfileSnapshot,
): ProfileSnapshotChanges {
  const portfolio = diffMultiset(
    previous.profile.portfolio.map(portfolioItemKey),
    current.profile.portfolio.map(portfolioItemKey),
  );
  const skills = diffStringSet(previous.profile.skills, current.profile.skills);

  return {
    title: {
      status:
        previous.profile.title === current.profile.title
          ? 'unchanged'
          : 'changed',
    },
    overview: {
      status:
        previous.profile.overview === current.profile.overview
          ? 'unchanged'
          : 'updated',
    },
    portfolio: {
      status:
        portfolio.added === 0 && portfolio.removed === 0
          ? 'unchanged'
          : 'changed',
      ...portfolio,
    },
    skills: {
      status:
        skills.added.length === 0 && skills.removed.length === 0
          ? 'unchanged'
          : 'changed',
      ...skills,
    },
  };
}

function portfolioItemKey(item: PortfolioItem): string {
  if (item.url !== undefined) return `url:${item.url}`;
  if (item.title !== undefined) return `title:${item.title}`;

  return JSON.stringify([
    item.description ?? null,
    [...item.skills].sort(),
  ]);
}

function diffMultiset(
  previous: string[],
  current: string[],
): { added: number; removed: number } {
  const previousCounts = counts(previous);
  const currentCounts = counts(current);
  const keys = new Set([...previousCounts.keys(), ...currentCounts.keys()]);
  let added = 0;
  let removed = 0;

  for (const key of keys) {
    const before = previousCounts.get(key) ?? 0;
    const after = currentCounts.get(key) ?? 0;
    added += Math.max(after - before, 0);
    removed += Math.max(before - after, 0);
  }

  return { added, removed };
}

function counts(values: string[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const value of values) {
    result.set(value, (result.get(value) ?? 0) + 1);
  }
  return result;
}

function diffStringSet(
  previous: string[],
  current: string[],
): { added: string[]; removed: string[] } {
  const previousSet = new Set(previous);
  const currentSet = new Set(current);

  return {
    added: [...currentSet].filter((value) => !previousSet.has(value)).sort(),
    removed: [...previousSet].filter((value) => !currentSet.has(value)).sort(),
  };
}
