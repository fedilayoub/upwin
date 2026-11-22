const MAX_NAME_CHARS = 40;

/**
 * The owner's name as a share page may show it: "Sam Rivera" becomes "Sam R.", the way
 * Upwork shows a freelancer to clients. A share link is public, so the full surname stays
 * out of it.
 */
export function publicName(name: string | null | undefined): string | null {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return null;
  const initial =
    parts.length > 1 ? Array.from(parts[parts.length - 1] ?? '')[0] : undefined;
  const short =
    initial && /\p{L}/u.test(initial)
      ? `${first} ${initial.toUpperCase()}.`
      : first;
  return Array.from(short).slice(0, MAX_NAME_CHARS).join('');
}

/**
 * The title a recording gets when the client sends none. It is the headline of the share
 * page and of the link preview, so it names the sender and gives the viewer a reason to
 * press play. Without a captured profile it speaks in the first person.
 */
export function defaultVideoTitle(
  ownerName: string | null | undefined,
  forJob: boolean,
): string {
  const name = publicName(ownerName);
  const hook = name
    ? `${name} has something to show you`
    : 'I have something to show you';
  return forJob ? `${hook} about your project` : hook;
}
