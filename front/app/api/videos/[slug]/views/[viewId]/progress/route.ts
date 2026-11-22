import { recordPublicVideoProgress } from '@/lib/api/server';
import { parseViewProgress, VIDEO_SLUG, VIEW_ID } from '@/lib/api/public-videos';

/**
 * How much of one view was watched, sent by the share page while playing and with `sendBeacon`
 * on page hide. Always 204: the page needs no answer and learns nothing from one.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; viewId: string }> },
) {
  const { slug, viewId } = await params;
  if (VIDEO_SLUG.test(slug) && VIEW_ID.test(viewId)) {
    try {
      const text = await request.text();
      const progress = text.length <= 256 ? parseViewProgress(JSON.parse(text)) : null;
      if (progress) await recordPublicVideoProgress(slug, viewId, progress);
    } catch {
      // Progress is best effort.
    }
  }
  return new Response(null, { status: 204 });
}
