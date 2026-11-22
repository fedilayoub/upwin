import { Video } from 'lucide-react';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { VideoAllowance } from '@/components/videos/video-allowance';
import { VideoLibrary } from '@/components/videos/video-library';
import { VideoSetup } from '@/components/videos/video-setup';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { getBackendApiClient } from '@/lib/api/server';

export default async function VideosPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const [dictionary, api] = await Promise.all([
    getDictionary(lang),
    getBackendApiClient(),
  ]);
  // Both requests start together. The list is only read when the feature is
  // on, so its failure is ignored until then.
  const pageRequest = api.listVideos({ limit: 20 });
  pageRequest.catch(() => undefined);
  const limits = await api.getVideoLimits();
  const header = (
    <PageHeader
      title={dictionary.videos.title}
      description={dictionary.videos.description}
      icon={Video}
    />
  );
  if (!limits.available)
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10 pt-4">
        {header}
        <VideoSetup copy={dictionary.videos.setup} locale={lang} />
      </div>
    );
  const page = await pageRequest;
  // A single server request timestamp keeps every client card stable during hydration.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10 pt-4">
      {header}
      <VideoAllowance
        limits={limits}
        copy={dictionary.videos.allowance}
        locale={lang}
      />
      <VideoLibrary
        now={now}
        page={page}
        locale={lang}
        copy={dictionary.videos}
        videoCopy={dictionary.video}
        shareCopy={dictionary.share}
      />
    </div>
  );
}
