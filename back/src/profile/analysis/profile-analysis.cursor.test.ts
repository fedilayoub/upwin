import { describe, expect, it } from 'vitest';
import {
  decodeProfileAnalysisCursor,
  encodeProfileAnalysisCursor,
  isProfileAnalysisCursor,
} from './profile-analysis.cursor';

describe('profile analysis cursor', () => {
  it('round-trips the createdAt and id tie-breaker', () => {
    const cursor = {
      createdAt: '2026-08-21T12:00:00.123456Z',
      id: '018f6a77-4e90-7ab5-a3bf-15c8f850fa1a',
    };

    expect(
      decodeProfileAnalysisCursor(encodeProfileAnalysisCursor(cursor)),
    ).toEqual(cursor);
  });

  it.each(['not-base64', Buffer.from('{}').toString('base64url')])(
    'rejects invalid cursor %s',
    (cursor) => {
      expect(isProfileAnalysisCursor(cursor)).toBe(false);
    },
  );
});
