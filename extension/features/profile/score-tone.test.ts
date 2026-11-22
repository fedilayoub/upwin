import { describe, expect, it } from 'vitest';
import { scoreTone } from './score-tone';

describe('scoreTone', () => {
  it.each([
    { score: 0, tone: 'weak' },
    { score: 40, tone: 'weak' },
    { score: 49, tone: 'weak' },
    { score: 50, tone: 'moderate' },
    { score: 58, tone: 'moderate' },
    { score: 74, tone: 'moderate' },
    { score: 75, tone: 'strong' },
    { score: 91, tone: 'strong' },
    { score: 100, tone: 'strong' },
  ])('maps $score to $tone', ({ score, tone }) => {
    expect(scoreTone(score)).toBe(tone);
  });
});
