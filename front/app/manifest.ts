import type { MetadataRoute } from 'next';
import en from '@/i18n/dictionaries/en';

/**
 * Name and icons for "Add to Home Screen". Not an installable app: no service
 * worker, so `display` stays `browser`. The icons are drawn from the same glyph
 * as `app/icon.svg` and `app/apple-icon.png`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'upwin',
    short_name: 'upwin',
    description: en.metadata.description,
    start_url: '/',
    display: 'browser',
    background_color: '#ffffff',
    theme_color: '#0c3730',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
