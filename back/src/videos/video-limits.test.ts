import { describe, expect, it } from 'vitest';
import {
  VIDEO_MAX_BYTES,
  VIDEO_MAX_DURATION_MS,
  VIDEO_PART_SIZE_BYTES,
} from './video-limits';

describe('video limits', () => {
  it('caps a recording at 20 minutes and 76 upload parts', () => {
    expect(VIDEO_MAX_DURATION_MS).toBe(1_200_000);
    expect(VIDEO_MAX_BYTES).toBe(76 * VIDEO_PART_SIZE_BYTES);
  });
});
