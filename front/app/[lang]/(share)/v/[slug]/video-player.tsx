'use client';

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  LoaderCircle,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { PublicVideo } from '@/lib/api/types';
import type { Dictionary } from '@/i18n/types';
import { formatDuration } from '@/lib/videos';
import {
  playedMs,
  sendVideoProgress,
  startVideoView,
} from '@/lib/video-view';
import { cn } from '@/lib/utils';

const SPEEDS = [1, 1.25, 1.5, 2] as const;
const HIDE_AFTER_MS = 2500;

type VideoWithFullscreen = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
};

const noSubscription = () => () => undefined;
const clock = (seconds: number) =>
  formatDuration(Number.isFinite(seconds) ? seconds * 1000 : 0);

/**
 * The share page's player: native `<video>` playback (inline on iOS) under custom controls.
 * Keyboard: Space/K play, ←/→ 5 s, M mute, F full screen.
 */
export function VideoPlayer({
  video,
  copy,
  autoPlay = false,
  showOwnerNote = true,
  onSourceExpired,
}: {
  video: PublicVideo;
  copy: Dictionary['share'];
  /** Starts at once; only after a user gesture (the in-app popup). */
  autoPlay?: boolean;
  showOwnerNote?: boolean;
  /** Fetches fresh presigned URLs; the share page refreshes its server data instead. */
  onSourceExpired?: () => void;
}) {
  const router = useRouter();
  const frame = useRef<HTMLDivElement>(null);
  const element = useRef<HTMLVideoElement>(null);
  const mountedAt = useRef<number | null>(null);
  const recovery = useRef<{ time: number; src: string | null } | null>(null);
  const started = useRef(false);
  const viewId = useRef<string | null>(null);
  const sent = useRef({ watchedMs: 0, finished: false });
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const pointer = useRef<string>('mouse');
  const [speed, setSpeed] = useState(1);
  const [ownVideo, setOwnVideo] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(
    video.durationMs ? video.durationMs / 1000 : 0,
  );
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  // Static per browser; false on the server, so the button never mismatches on hydration.
  const pipSupported = useSyncExternalStore(
    noSubscription,
    () => document.pictureInPictureEnabled === true,
    () => false,
  );
  const [active, setActive] = useState(true);
  const [menu, setMenu] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);

  function countView() {
    if (started.current) return;
    started.current = true;
    void startVideoView(video.slug).then((ticket) => {
      viewId.current = ticket.viewId;
      setOwnVideo(ticket.owner);
      report();
    });
  }
  /** Sends how much was watched, only when it grew (or the end was reached). */
  function report(finished = false, closing = false) {
    const node = element.current;
    if (!node || !viewId.current) return;
    const next = {
      watchedMs: Math.max(sent.current.watchedMs, playedMs(node)),
      finished: sent.current.finished || finished,
    };
    if (
      next.watchedMs === sent.current.watchedMs &&
      next.finished === sent.current.finished
    )
      return;
    sent.current = next;
    sendVideoProgress(video.slug, viewId.current, next, closing);
  }

  useEffect(() => {
    const tick = setInterval(() => {
      if (element.current && !element.current.paused) report();
    }, 10_000);
    const closing = () => report(false, true);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') closing();
    };
    const onFullscreen = () =>
      setFullscreen(document.fullscreenElement === frame.current);
    window.addEventListener('pagehide', closing);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => {
      clearInterval(tick);
      clearTimeout(hideTimer.current);
      window.removeEventListener('pagehide', closing);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('fullscreenchange', onFullscreen);
    };
    // `report` reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function wake() {
    setActive(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setActive(false), HIDE_AFTER_MS);
  }
  function toggle() {
    const node = element.current;
    if (!node) return;
    if (node.paused || node.ended) void node.play().catch(() => undefined);
    else node.pause();
    wake();
  }
  function seek(seconds: number) {
    const node = element.current;
    if (!node) return;
    const end = Number.isFinite(node.duration) ? node.duration : duration;
    node.currentTime = Math.min(Math.max(0, seconds), end || 0);
    setCurrent(node.currentTime);
    wake();
  }
  function setLevel(next: number) {
    const node = element.current;
    if (!node) return;
    node.volume = next;
    node.muted = next === 0;
  }
  function toggleMute() {
    const node = element.current;
    if (!node) return;
    if (node.muted || node.volume === 0) {
      node.muted = false;
      if (node.volume === 0) node.volume = 0.6;
    } else node.muted = true;
  }
  function toggleFullscreen() {
    const box = frame.current;
    const node = element.current as VideoWithFullscreen | null;
    if (!box || !node) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
      return;
    }
    if (box.requestFullscreen)
      void box.requestFullscreen().catch(() => undefined);
    // iPhone has no element full screen, only the video's own.
    else node.webkitEnterFullscreen?.();
  }
  function togglePip() {
    const node = element.current;
    if (!node) return;
    if (document.pictureInPictureElement)
      void document.exitPictureInPicture().catch(() => undefined);
    else void node.requestPictureInPicture().catch(() => undefined);
  }
  function chooseSpeed(rate: number) {
    if (element.current) element.current.playbackRate = rate;
    setSpeed(rate);
    setMenu(false);
  }
  function onKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest('input, [role="slider"], [role="menu"]')) return;
    const key = event.key.toLowerCase();
    if (key === ' ' || key === 'k') {
      // A focused button already answers Space itself.
      if (key === ' ' && target.tagName === 'BUTTON') return;
      event.preventDefault();
      toggle();
    } else if (key === 'arrowleft' || key === 'arrowright') {
      event.preventDefault();
      seek(current + (key === 'arrowleft' ? -5 : 5));
    } else if (key === 'm') toggleMute();
    else if (key === 'f') toggleFullscreen();
    else if (key === 'escape') setMenu(false);
  }

  const ratio =
    video.width && video.height
      ? { w: video.width, h: video.height }
      : { w: 16, h: 9 };
  const showControls = !playing || active || menu || scrubbing;
  const level = muted ? 0 : volume;
  const VolumeIcon = level === 0 ? VolumeX : level < 0.5 ? Volume1 : Volume2;

  return (
    <div>
      <div
        ref={frame}
        role="region"
        aria-label={copy.player}
        tabIndex={-1}
        onKeyDown={onKey}
        onPointerDown={(event) => {
          pointer.current = event.pointerType;
        }}
        onPointerMove={(event) => {
          if (event.pointerType !== 'touch') wake();
        }}
        onPointerLeave={() => playing && setActive(false)}
        className={cn(
          'group/player relative isolate overflow-hidden bg-black text-white outline-none sm:rounded-2xl',
          'sm:shadow-[0_30px_80px_-20px_oklch(0_0_0/0.55),0_0_0_1px_oklch(1_0_0/0.08)]',
          fullscreen ? 'flex items-center justify-center rounded-none' : '',
          !showControls && 'cursor-none',
        )}
        style={
          fullscreen
            ? undefined
            : {
                aspectRatio: `${ratio.w}/${ratio.h}`,
                // Tall recordings shrink in width instead of overflowing the screen.
                width: `min(100%, calc(78vh * ${ratio.w} / ${ratio.h}))`,
                marginInline: 'auto',
              }
        }
      >
        <video
          ref={(node) => {
            element.current = node;
            if (node && mountedAt.current === null)
              mountedAt.current = Date.now();
          }}
          className="size-full object-contain"
          playsInline
          autoPlay={autoPlay}
          preload="metadata"
          poster={video.posterUrl ?? undefined}
          src={video.playbackUrl ?? undefined}
          onClick={() => {
            // On touch, a tap on a playing video first brings the controls back.
            if (pointer.current === 'touch' && playing && !showControls) wake();
            else toggle();
          }}
          onDoubleClick={toggleFullscreen}
          onPlay={() => {
            setPlaying(true);
            setEnded(false);
            setHasPlayed(true);
            countView();
            wake();
          }}
          onPause={() => {
            setPlaying(false);
            setActive(true);
            report();
          }}
          onEnded={() => {
            setPlaying(false);
            setEnded(true);
            setActive(true);
            report(true);
          }}
          onWaiting={() => setWaiting(true)}
          onPlaying={() => setWaiting(false)}
          onCanPlay={() => setWaiting(false)}
          onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
          onProgress={(event) => {
            const node = event.currentTarget;
            const ranges = node.buffered;
            if (ranges.length)
              setBuffered(ranges.end(ranges.length - 1));
          }}
          onDurationChange={(event) => {
            const value = event.currentTarget.duration;
            if (Number.isFinite(value) && value > 0) setDuration(value);
          }}
          onVolumeChange={(event) => {
            setVolume(event.currentTarget.volume);
            setMuted(event.currentTarget.muted);
          }}
          onError={() => {
            if (
              !element.current ||
              recovery.current ||
              mountedAt.current === null ||
              Date.now() - mountedAt.current < 2.5 * 60 * 60 * 1000
            )
              return;
            recovery.current = {
              time: element.current.currentTime,
              src: video.playbackUrl,
            };
            if (onSourceExpired) onSourceExpired();
            else router.refresh();
          }}
          onLoadedMetadata={() => {
            if (!element.current) return;
            element.current.playbackRate = speed;
            if (
              recovery.current &&
              recovery.current.src !== video.playbackUrl
            ) {
              element.current.currentTime = recovery.current.time;
            }
          }}
        />

        {/* Before the first play, and when paused or finished: one big, obvious button. */}
        {!playing && !waiting && (
          <button
            type="button"
            onClick={toggle}
            aria-label={ended ? copy.replay : copy.play}
            className={cn(
              'absolute inset-0 z-10 grid place-items-center transition-colors',
              hasPlayed ? 'bg-black/25' : 'bg-gradient-to-t from-black/45 via-black/5 to-black/10',
            )}
          >
            <span className="relative grid size-16 place-items-center rounded-full bg-white text-zinc-950 shadow-[0_10px_40px_-6px_oklch(0_0_0/0.6)] transition-transform duration-300 ease-out group-hover/player:scale-105 sm:size-20">
              <span
                aria-hidden="true"
                className="absolute inset-0 -z-10 rounded-full bg-[var(--hero-palette-core)] opacity-40 blur-xl"
              />
              {ended ? (
                <RotateCcw className="size-6 sm:size-7" aria-hidden="true" />
              ) : (
                <Play
                  className="size-6 translate-x-0.5 fill-current sm:size-8"
                  aria-hidden="true"
                />
              )}
            </span>
          </button>
        )}
        {waiting && playing && (
          <span
            role="status"
            className="pointer-events-none absolute inset-0 z-10 grid place-items-center"
          >
            <LoaderCircle
              className="size-10 animate-spin text-white/90"
              aria-hidden="true"
            />
          </span>
        )}

        <div
          className={cn(
            'absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-3 pt-12 pb-2 transition-opacity duration-300 sm:px-4 sm:pb-3',
            showControls && hasPlayed
              ? 'opacity-100'
              : 'pointer-events-none opacity-0',
          )}
        >
          <Scrubber
            label={copy.seek}
            valueText={copy.timeOf
              .replace('{current}', clock(current))
              .replace('{total}', clock(duration))}
            current={current}
            duration={duration}
            buffered={buffered}
            onSeek={seek}
            onScrub={setScrubbing}
          />
          <div className="mt-1.5 flex items-center gap-0.5 sm:gap-1">
            <ControlButton
              label={playing ? copy.pause : ended ? copy.replay : copy.play}
              onClick={toggle}
            >
              {playing ? (
                <Pause className="size-5 fill-current" aria-hidden="true" />
              ) : ended ? (
                <RotateCcw className="size-5" aria-hidden="true" />
              ) : (
                <Play className="size-5 fill-current" aria-hidden="true" />
              )}
            </ControlButton>
            <div className="group/volume flex items-center">
              <ControlButton
                label={level === 0 ? copy.unmute : copy.mute}
                onClick={toggleMute}
              >
                <VolumeIcon className="size-5" aria-hidden="true" />
              </ControlButton>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={level}
                aria-label={copy.volume}
                onChange={(event) => setLevel(Number(event.target.value))}
                className="hidden h-1 w-0 cursor-pointer appearance-none rounded-full bg-white/25 accent-white opacity-0 transition-all duration-200 group-hover/volume:w-20 group-hover/volume:opacity-100 focus-visible:w-20 focus-visible:opacity-100 sm:block [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                style={{
                  background: `linear-gradient(to right, white ${level * 100}%, oklch(1 0 0 / 0.25) ${level * 100}%)`,
                }}
              />
            </div>
            <span className="ml-1.5 text-xs font-medium tabular-nums text-white/90 sm:text-[13px]">
              {clock(current)}
              <span className="text-white/50"> / {clock(duration)}</span>
            </span>
            <span className="flex-1" />
            <div className="relative">
              <button
                type="button"
                aria-label={copy.speed}
                aria-haspopup="menu"
                aria-expanded={menu}
                onClick={() => setMenu((open) => !open)}
                className="h-8 min-w-11 rounded-full px-2.5 text-xs font-semibold tabular-nums text-white/90 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
              >
                {speed}×
              </button>
              {menu && (
                <div
                  role="menu"
                  aria-label={copy.speed}
                  onKeyDown={(event) => event.key === 'Escape' && setMenu(false)}
                  className="absolute right-0 bottom-full mb-2 min-w-28 rounded-xl bg-zinc-900/95 p-1 shadow-xl ring-1 ring-white/10 backdrop-blur"
                >
                  {SPEEDS.map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      role="menuitemradio"
                      aria-checked={speed === rate}
                      onClick={() => chooseSpeed(rate)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-sm tabular-nums transition-colors hover:bg-white/10',
                        speed === rate
                          ? 'font-semibold text-[var(--hero-palette-core)]'
                          : 'text-white/85',
                      )}
                    >
                      {rate}×
                    </button>
                  ))}
                </div>
              )}
            </div>
            {pipSupported && (
              <ControlButton label={copy.pip} onClick={togglePip}>
                <PictureInPicture2 className="size-5" aria-hidden="true" />
              </ControlButton>
            )}
            <ControlButton
              label={fullscreen ? copy.exitFullscreen : copy.fullscreen}
              onClick={toggleFullscreen}
            >
              {fullscreen ? (
                <Minimize className="size-5" aria-hidden="true" />
              ) : (
                <Maximize className="size-5" aria-hidden="true" />
              )}
            </ControlButton>
          </div>
        </div>
      </div>
      {ownVideo && showOwnerNote && (
        <p
          role="status"
          className="mt-3 px-4 text-sm text-[var(--marketing-text-muted)] sm:px-0"
        >
          {copy.ownerNote}
        </p>
      )}
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-9 shrink-0 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
    >
      {children}
    </button>
  );
}

function Scrubber({
  label,
  valueText,
  current,
  duration,
  buffered,
  onSeek,
  onScrub,
}: {
  label: string;
  valueText: string;
  current: number;
  duration: number;
  buffered: number;
  onSeek: (seconds: number) => void;
  onScrub: (scrubbing: boolean) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [hover, setHover] = useState<number | null>(null);
  const share = (value: number) =>
    duration > 0 ? Math.min(100, Math.max(0, (value / duration) * 100)) : 0;
  const at = (event: ReactPointerEvent) => {
    const box = track.current?.getBoundingClientRect();
    if (!box || box.width === 0) return 0;
    return Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
  };
  const played = share(current);
  return (
    <div
      ref={track}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(current)}
      aria-valuetext={valueText}
      onPointerDown={(event) => {
        dragging.current = true;
        onScrub(true);
        event.currentTarget.setPointerCapture(event.pointerId);
        onSeek(at(event) * duration);
      }}
      onPointerMove={(event) => {
        setHover(at(event));
        if (dragging.current) onSeek(at(event) * duration);
      }}
      onPointerUp={() => {
        dragging.current = false;
        onScrub(false);
      }}
      onPointerCancel={() => {
        dragging.current = false;
        onScrub(false);
      }}
      onPointerLeave={() => setHover(null)}
      onKeyDown={(event) => {
        const step =
          event.key === 'ArrowLeft' || event.key === 'ArrowDown'
            ? -5
            : event.key === 'ArrowRight' || event.key === 'ArrowUp'
              ? 5
              : 0;
        if (step) {
          event.preventDefault();
          onSeek(current + step);
        } else if (event.key === 'Home') {
          event.preventDefault();
          onSeek(0);
        } else if (event.key === 'End') {
          event.preventDefault();
          onSeek(duration);
        }
      }}
      className="group/scrub relative flex h-4 cursor-pointer touch-none items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/70"
    >
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/20 transition-[height] duration-150 group-hover/scrub:h-1.5">
        <div
          className="absolute inset-y-0 left-0 bg-white/35"
          style={{ width: `${share(buffered)}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[var(--hero-palette-core)]"
          style={{ width: `${played}%` }}
        />
      </div>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full bg-white shadow-[0_0_0_4px_oklch(1_0_0/0.18)] transition-transform duration-150 group-hover/scrub:scale-100 group-focus-visible/scrub:scale-100"
        style={{ left: `${played}%` }}
      />
      {hover !== null && duration > 0 && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-full mb-2 -translate-x-1/2 rounded-md bg-zinc-900/95 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white shadow ring-1 ring-white/10"
          style={{ left: `${hover * 100}%` }}
        >
          {clock(hover * duration)}
        </span>
      )}
    </div>
  );
}
