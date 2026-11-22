import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LAUNCHER_FRACTION,
  LAUNCHER_EDGE_MARGIN,
  clampLauncherFraction,
  launcherFractionFromTop,
  launcherTopFromFraction,
  launcherTrackHeight,
} from './position';

const VIEWPORT = 800;
const BAR = 48;
const TRACK = VIEWPORT - BAR - LAUNCHER_EDGE_MARGIN * 2;

describe('launcher track', () => {
  it('is the run of pixels left once both margins and the bar are taken', () => {
    expect(launcherTrackHeight(VIEWPORT, BAR)).toBe(TRACK);
  });

  it('collapses rather than going negative on a viewport shorter than the bar', () => {
    expect(launcherTrackHeight(40, BAR)).toBe(0);
  });
});

describe('clampLauncherFraction', () => {
  it('keeps the bar inside the track', () => {
    expect(clampLauncherFraction(-2)).toBe(0);
    expect(clampLauncherFraction(1.4)).toBe(1);
    expect(clampLauncherFraction(0.25)).toBe(0.25);
  });

  it('falls back to centred for values that are not real numbers', () => {
    expect(clampLauncherFraction(Number.NaN)).toBe(DEFAULT_LAUNCHER_FRACTION);
    expect(clampLauncherFraction(Number.POSITIVE_INFINITY)).toBe(
      DEFAULT_LAUNCHER_FRACTION,
    );
  });
});

describe('launcherTopFromFraction', () => {
  it('puts the default fraction where the bar used to sit — centred', () => {
    expect(launcherTopFromFraction(DEFAULT_LAUNCHER_FRACTION, VIEWPORT, BAR)).toBe(
      (VIEWPORT - BAR) / 2,
    );
  });

  it('parks the extremes one margin from each edge', () => {
    expect(launcherTopFromFraction(0, VIEWPORT, BAR)).toBe(LAUNCHER_EDGE_MARGIN);
    expect(launcherTopFromFraction(1, VIEWPORT, BAR)).toBe(
      VIEWPORT - BAR - LAUNCHER_EDGE_MARGIN,
    );
  });

  it('keeps the toggle reachable when the track has collapsed', () => {
    expect(launcherTopFromFraction(1, 40, BAR)).toBe(LAUNCHER_EDGE_MARGIN);
  });

  it('holds the same fraction proportionally across a resize', () => {
    const fraction = 0.75;
    const tall = launcherTopFromFraction(fraction, 1000, BAR);
    const short = launcherTopFromFraction(fraction, 500, BAR);

    expect(short).toBeLessThan(tall);
    expect(short + BAR).toBeLessThanOrEqual(500 - LAUNCHER_EDGE_MARGIN);
  });
});

describe('launcherFractionFromTop', () => {
  it('round-trips a drag back to the fraction that produced it', () => {
    for (const fraction of [0, 0.3, DEFAULT_LAUNCHER_FRACTION, 0.82, 1]) {
      const top = launcherTopFromFraction(fraction, VIEWPORT, BAR);
      expect(launcherFractionFromTop(top, VIEWPORT, BAR)).toBeCloseTo(fraction);
    }
  });

  it('clamps a drag past either edge instead of storing it', () => {
    expect(launcherFractionFromTop(-500, VIEWPORT, BAR)).toBe(0);
    expect(launcherFractionFromTop(5000, VIEWPORT, BAR)).toBe(1);
  });

  it('reports the top of a collapsed track rather than dividing by zero', () => {
    expect(launcherFractionFromTop(120, 40, BAR)).toBe(0);
  });
});
