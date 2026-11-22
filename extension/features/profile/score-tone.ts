export type ScoreTone = 'strong' | 'moderate' | 'weak';

/**
 * Maps a 0-100 section score onto a visual tone.
 *
 * The thresholds are the rubric's own anchors, not round numbers:
 * 75 is "clearly explains client problems and value" and 50 is "mentions
 * outcomes but remains generic". Do not tidy them to 60/80 — that would
 * decouple the colour from the scale the backend actually scores against.
 */
export function scoreTone(score: number): ScoreTone {
  if (score >= 75) return 'strong';
  if (score >= 50) return 'moderate';
  return 'weak';
}
