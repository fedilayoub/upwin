import { IBM_Plex_Mono } from 'next/font/google';

/**
 * The typeface the hardware skin prints its labels in. It lives here, apart
 * from `lib/fonts.ts`, so only a route that shows a hardware panel imports it
 * and gets its `@font-face` rules. Not preloaded: the panel is a few labels,
 * and they fall back to the system monospace until the file arrives.
 *
 * Put `hardwareFont.variable` on an ancestor of the `<Hardware>` root.
 */
export const hardwareFont = IBM_Plex_Mono({
  display: 'swap',
  preload: false,
  subsets: ['latin'],
  variable: '--font-plex-mono',
  weight: ['400', '500'],
});
