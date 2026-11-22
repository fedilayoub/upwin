import { cookies } from 'next/headers';
import { recordPublicVideoView } from '@/lib/api/server';
import { NOT_COUNTED, VIDEO_SLUG } from '@/lib/api/public-videos';
import { APP_SESSION_COOKIE, configuredAppPassword, isUnlocked } from '@/lib/app-session';

/**
 * A first play on the share page. A visitor who unlocked this app is the
 * freelancer: the API token goes with their ping, so their own plays are not
 * counted. Answers what happened so the page can report this view's progress.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (VIDEO_SLUG.test(slug)) {
    try {
      const password = configuredAppPassword();
      const owner =
        password !== null &&
        (await isUnlocked((await cookies()).get(APP_SESSION_COOKIE)?.value, password));
      const token = owner ? process.env.API_TOKEN?.trim() || null : null;
      return Response.json(await recordPublicVideoView(slug, token), {
        headers: { 'Cache-Control': 'no-store' },
      });
    } catch {
      // A view ping never affects playback, even during an API outage.
    }
  }
  return Response.json(NOT_COUNTED, { headers: { 'Cache-Control': 'no-store' } });
}
