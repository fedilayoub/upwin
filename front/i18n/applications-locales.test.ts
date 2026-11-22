import { describe, expect, it } from 'vitest';
import en from '@/i18n/dictionaries/en';
import fr from '@/i18n/dictionaries/fr';
import { PROPOSAL_OUTCOME_STATUSES } from '@/lib/api';

describe('applications locales', () => {
  it('resolves every applications key in both locales', () => {
    expect(leafPaths(fr.applications)).toEqual(leafPaths(en.applications));
    expect(leafValues(en.applications).every(Boolean)).toBe(true);
    expect(leafValues(fr.applications).every(Boolean)).toBe(true);
    expect(en.navigation.applications).toBeTruthy();
    expect(fr.navigation.applications).toBeTruthy();
  });

  it('labels every status in both locales', () => {
    for (const status of PROPOSAL_OUTCOME_STATUSES) {
      expect(en.dashboard.outcomeStatuses[status]).toBeTruthy();
      expect(fr.dashboard.outcomeStatuses[status]).toBeTruthy();
    }
  });

  it('renders sent as "Proposal sent", keeping the wire value out of the UI', () => {
    expect(en.dashboard.outcomeStatuses.sent).toBe('Proposal sent');
    expect(en.dashboard.outcomeStatuses.sent).not.toBe('Sent');
  });
});

function leafPaths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value)
    .flatMap(([key, child]) =>
      leafPaths(child, prefix ? `${prefix}.${key}` : key),
    )
    .sort();
}

function leafValues(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value !== 'object' || value === null) return [];
  return Object.values(value).flatMap(leafValues);
}
