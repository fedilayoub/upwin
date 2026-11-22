import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VideoSetup, VIDEO_SETUP_GUIDE_PATH } from '@/components/videos/video-setup';
import en from '@/i18n/dictionaries/en';
import fr from '@/i18n/dictionaries/fr';

describe('VideoSetup', () => {
  it('lays out three numbered steps, the env lines, the guide and a connection check', () => {
    const markup = renderToStaticMarkup(<VideoSetup copy={en.videos.setup} locale="en" />);
    expect(markup).toContain('Turn on video proposals');
    expect(markup.match(/<li /g)).toHaveLength(3);
    expect(markup).toContain('VIDEO_STORAGE_ENDPOINT=');
    expect(markup).not.toContain('VIDEO_RECORDING');
    expect(markup).toContain('VIDEO_STORAGE_SECRET_ACCESS_KEY=&lt;secret&gt;');
    expect(markup).toContain(VIDEO_SETUP_GUIDE_PATH);
    expect(markup).toContain('href="/en/settings/connection"');
  });

  it('has the same steps in French', () => {
    expect(fr.videos.setup.steps).toHaveLength(en.videos.setup.steps.length);
    const markup = renderToStaticMarkup(<VideoSetup copy={fr.videos.setup} locale="fr" />);
    expect(markup).toContain('Activer les propositions vidéo');
    expect(markup).toContain('href="/fr/settings/connection"');
  });
});
