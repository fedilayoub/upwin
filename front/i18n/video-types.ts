export interface VideoDictionary {
  video: {
    status: {
      uploading: string;
      processing: string;
      ready: string;
      failed: string;
    };
    failure: {
      upload_abandoned: string;
      invalid_media: string;
      too_long: string;
      processing_error: string;
    };
    duration: string;
    title: string;
  };
  videos: {
    title: string;
    description: string;
    extension: string;
    setup: {
      title: string;
      description: string;
      steps: { title: string; body: string }[];
      guide: string;
      check: string;
    };
    empty: string;
    copy: string;
    copied: string;
    play: string;
    more: string;
    open: string;
    rename: string;
    save: string;
    cancel: string;
    delete: string;
    deleteTitle: string;
    deleteDescription: string;
    loadMore: string;
    loadError: string;
    views: string;
    lastViewed: string;
    noViews: string;
    avgWatched: string;
    finishedBy: string;
    approx: string;
    messages: {
      copied: string;
      copyError: string;
      renamed: string;
      deleted: string;
    };
    errors: {
      invalid: string;
      notFound: string;
      notConfigured: string;
      storage: string;
      unauthenticated: string;
      forbidden: string;
      generic: string;
    };
    allowance: VideoAllowanceCopy;
  };
  share: {
    video: string;
    description: string;
    unavailable: string;
    processing: string;
    stillProcessing: string;
    recorded: string;
    recordedWith: string;
    speed: string;
    ownerNote: string;
    eyebrow: string;
    player: string;
    play: string;
    pause: string;
    replay: string;
    mute: string;
    unmute: string;
    volume: string;
    seek: string;
    timeOf: string;
    fullscreen: string;
    exitFullscreen: string;
    pip: string;
  };
}

/** The storage this install uses: no plans, no caps, no expiry. */
export type VideoAllowanceCopy = {
  title: string;
  storage: string;
  retentionForever: string;
};
