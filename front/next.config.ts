import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No AI-agent files in this repository: `next dev` otherwise writes and keeps
  // re-adding an AGENTS.md block. With `false` it removes that block instead.
  agentRules: false,
  experimental: {
    // Every page is dynamic, and by default the router refetches a dynamic
    // page on every visit. Thirty seconds makes going back and forth in the
    // sidebar instant. Every server action here calls `revalidatePath`, which
    // clears this cache, so a page never shows a change the user just made as
    // stale. A change made in the extension can take up to thirty seconds to
    // show on a page that was already visited.
    staleTimes: { dynamic: 30 },
  },
  async headers() {
    return [
      // No page of this app is meant to be shown inside another site's frame.
      // Without these, a hostile page could frame the context or prompt pages
      // and trick the user into clicking through them. `frame-ancestors` is
      // the current control; `X-Frame-Options` covers older browsers.
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      // A client's video link: never indexed, and no referrer leaks the slug.
      {
        source: '/:lang/v/:slug*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
    ];
  },
  async redirects() {
    // Routes of the hosted edition, renamed here. Older extension builds and
    // bookmarks still open them.
    return [
      { source: '/:lang(en|fr)/dashboard', destination: '/:lang', permanent: false },
      { source: '/:lang(en|fr)/onboarding/:rest*', destination: '/:lang/context/:rest*', permanent: false },
      { source: '/:lang(en|fr)/proposals', destination: '/:lang/proposal-style', permanent: false },
      { source: '/:lang(en|fr)/admin/:page(models|prompts)', destination: '/:lang/settings/:page', permanent: false },
    ];
  },
};

export default nextConfig;
