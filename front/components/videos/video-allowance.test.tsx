import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VideoAllowance } from '@/components/videos/video-allowance';
import en from '@/i18n/dictionaries/en';
import type { VideoLimits } from '@/lib/api/types';

const base: VideoLimits = {
  available: true,
  storage: { usedBytes: 512 * 1024 ** 2 },
  maxDurationMs: 1_200_000,
  maxBytes: 76 * 8 * 1024 ** 2,
};
const render = (limits: VideoLimits) =>
  renderToStaticMarkup(
    <VideoAllowance limits={limits} copy={en.videos.allowance} locale="en" />,
  );

describe('VideoAllowance', () => {
  it('shows usage with no cap and no expiry, and no upgrade', () => {
    const markup = render(base);
    expect(markup).toContain('· no limit</p>');
    expect(markup).toContain('Kept until you delete');
    expect(markup).not.toContain('role="meter"');
    expect(markup).not.toMatch(/upgrade|\bPro\b|\bplan\b/i);
  });
  it('renders nothing when video is off', () => {
    expect(render({ ...base, available: false })).toBe('');
  });
});
