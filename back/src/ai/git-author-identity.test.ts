import { describe, expect, it, vi } from 'vitest';
import {
  readGitAuthorSensitiveTerms,
  type GitConfigReader,
} from './git-author-identity';

describe('readGitAuthorSensitiveTerms', () => {
  it('derives the author name, reversed name, email, and email local-part', () => {
    const reader = vi.fn<GitConfigReader>((key) =>
      key === 'user.name' ? ' Jane Developer ' : 'jane.dev@example.test',
    );

    expect(readGitAuthorSensitiveTerms(reader)).toEqual([
      'Jane Developer',
      'Developer Jane',
      'jane.dev@example.test',
      'jane.dev',
    ]);
    expect(reader).toHaveBeenNthCalledWith(1, 'user.name');
    expect(reader).toHaveBeenNthCalledWith(2, 'user.email');
  });

  it('returns no terms when git identity reads fail', () => {
    const reader = vi.fn<GitConfigReader>(() => {
      throw new Error('git config is unavailable');
    });

    expect(readGitAuthorSensitiveTerms(reader)).toEqual([]);
  });

  it('drops one- and two-character identity terms', () => {
    const reader = vi.fn<GitConfigReader>((key) =>
      key === 'user.name' ? 'Jo' : 'xy@example.test',
    );

    expect(readGitAuthorSensitiveTerms(reader)).toEqual(['xy@example.test']);
  });
});
