import { describe, expect, it } from 'vitest';
import { isActiveTabNavigation } from './use-profile-page-status';

describe('isActiveTabNavigation', () => {
  it('follows an in-app URL change on the active tab', () => {
    expect(
      isActiveTabNavigation(
        { url: 'https://www.upwork.com/freelancers/~01abc' },
        { active: true },
      ),
    ).toBe(true);
  });

  it('follows a finished load on the active tab', () => {
    expect(isActiveTabNavigation({ status: 'complete' }, { active: true })).toBe(
      true,
    );
  });

  it('ignores background tabs and non-navigation updates', () => {
    expect(isActiveTabNavigation({ status: 'complete' }, { active: false })).toBe(
      false,
    );
    expect(isActiveTabNavigation({ status: 'loading' }, { active: true })).toBe(
      false,
    );
    expect(isActiveTabNavigation({}, { active: true })).toBe(false);
  });
});
