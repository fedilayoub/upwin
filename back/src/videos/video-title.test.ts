import { describe, expect, it } from 'vitest';
import { defaultVideoTitle, publicName } from './video-title';

describe('publicName', () => {
  it.each([
    ['Sam Rivera', 'Sam R.'],
    ['Sam R.', 'Sam R.'],
    ['  sam   de la rivera ', 'sam R.'],
    ['Sam', 'Sam'],
    ['Élodie Ünal', 'Élodie Ü.'],
    ['Sam (PhD)', 'Sam'],
  ])('shortens %j to %j', (name, expected) => {
    expect(publicName(name)).toBe(expected);
  });
  it.each([null, undefined, '', '   '])('has no name for %j', (name) => {
    expect(publicName(name)).toBeNull();
  });
  it('caps a very long first name', () => {
    expect(publicName('x'.repeat(200))).toHaveLength(40);
  });
});

describe('defaultVideoTitle', () => {
  it('names the sender', () => {
    expect(defaultVideoTitle('Sam Rivera', false)).toBe(
      'Sam R. has something to show you',
    );
  });
  it('points at the project for a job recording', () => {
    expect(defaultVideoTitle('Sam Rivera', true)).toBe(
      'Sam R. has something to show you about your project',
    );
  });
  it('speaks in the first person without a captured profile', () => {
    expect(defaultVideoTitle(null, false)).toBe('I have something to show you');
    expect(defaultVideoTitle(null, true)).toBe(
      'I have something to show you about your project',
    );
  });
  it('always fits the 120-character title limit', () => {
    expect(defaultVideoTitle('x'.repeat(200), true).length).toBeLessThanOrEqual(
      120,
    );
  });
});
