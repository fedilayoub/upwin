/**
 * Paste into the DevTools console ON YOUR OWN Upwork profile page.
 *
 * Reports STRUCTURE ONLY — attribute names, tag names, and match counts. It
 * prints no profile text, so the output is safe to share. It reads the already
 * rendered DOM and changes nothing.
 */
(() => {
  const CURRENT = {
    ownProfileMarkers: [
      '[data-test="edit-profile-button"]',
      'button[aria-label*="Edit profile"]',
      '[data-test="profile-edit"]',
    ],
    name: ['[data-test="profile-name"]', '[data-test="user-name"]', 'h1[itemprop="name"]'],
    title: ['[data-test="profile-title"]', '[data-test="profile-overview-title"]', '[itemprop="jobTitle"]'],
    overview: ['[data-test="profile-overview"]', '[data-test="overview"]', '[itemprop="description"]'],
    hourlyRate: ['[data-test="profile-rate"]', '[data-test="hourly-rate"]', '[itemprop="price"]'],
    skills: ['[data-test="skill"]', '[data-test="profile-skill"]', '[itemprop="skills"] li'],
  };

  const URL_RE = /^\/freelancers\/(?:~[a-z0-9]+|settings\/profile)\/?$/i;

  console.log('%c1. URL check', 'font-weight:bold');
  console.table([{
    href: location.origin + location.pathname,
    hostOk: location.hostname === 'www.upwork.com' || location.hostname === 'upwork.com',
    pathOk: URL_RE.test(location.pathname),
  }]);

  console.log('%c2. Current selectors — do any match?', 'font-weight:bold');
  console.table(
    Object.entries(CURRENT).flatMap(([field, list]) =>
      list.map((sel) => ({ field, selector: sel, matches: document.querySelectorAll(sel).length })),
    ),
  );

  // Which attribute conventions does this page actually use?
  const attrCount = new Map();
  for (const el of document.querySelectorAll('*')) {
    for (const attr of el.attributes) {
      if (/^(data-|itemprop|aria-label$)/.test(attr.name)) {
        attrCount.set(attr.name, (attrCount.get(attr.name) ?? 0) + 1);
      }
    }
  }
  console.log('%c3. Attribute conventions on this page (top 25)', 'font-weight:bold');
  console.table(
    [...attrCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)
      .map(([attribute, count]) => ({ attribute, count })),
  );

  // Distinct values of the page's dominant test-id attribute, if any.
  const idAttr = ['data-test', 'data-qa', 'data-testid', 'data-cy', 'data-ev-label']
    .find((a) => document.querySelector(`[${a}]`));
  if (idAttr) {
    const values = [...new Set(
      [...document.querySelectorAll(`[${idAttr}]`)].map((el) => el.getAttribute(idAttr)),
    )].sort();
    console.log(`%c4. Distinct ${idAttr} values (${values.length}) — copy this list`, 'font-weight:bold');
    console.log(values.join('\n'));
  } else {
    console.log('%c4. No data-test/data-qa/data-testid attributes found — selectors must key off something else', 'font-weight:bold');
  }

  console.log('%c5. Landmark shape (tag + class count only, no text)', 'font-weight:bold');
  console.table(
    ['h1', 'h2', 'h3'].flatMap((tag) =>
      [...document.querySelectorAll(tag)].slice(0, 8).map((el, i) => ({
        tag, index: i, classes: el.className?.toString().slice(0, 60) || '(none)',
        chars: (el.textContent ?? '').trim().length,
      })),
    ),
  );
})();
