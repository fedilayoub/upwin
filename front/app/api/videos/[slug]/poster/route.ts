import { getPublicVideo } from '@/lib/api/server';
import { VIDEO_SLUG } from '@/lib/api/public-videos';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!VIDEO_SLUG.test(slug)) return new Response(null, { status: 404 });
  const result = await getPublicVideo(slug);
  if (
    result.kind !== 'ok' ||
    result.video.status !== 'ready' ||
    !result.video.posterUrl
  )
    return new Response(null, { status: 404 });
  return new Response(null, {
    status: 302,
    headers: {
      Location: result.video.posterUrl,
      'Cache-Control': 'public, max-age=300',
    },
  });
}
