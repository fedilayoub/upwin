import { Cormorant_Garamond, Manrope } from 'next/font/google';

/**
 * Only the footer wordmark uses this, at the bottom of the page, so it is not
 * preloaded: a preload would compete with the stylesheet and the body font for
 * the first paint on every page.
 */
export const displayFont = Cormorant_Garamond({
  display: 'swap',
  preload: false,
  subsets: ['latin'],
  variable: '--font-cormorant',
});

export const bodyFont = Manrope({
  display: 'swap',
  subsets: ['latin'],
  variable: '--font-manrope',
});
