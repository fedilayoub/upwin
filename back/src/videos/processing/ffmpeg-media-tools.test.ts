import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
const { spawn } = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock('node:child_process', () => ({ spawn }));
import { FfmpegMediaTools } from './ffmpeg-media-tools';
function child() {
  return Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: vi.fn(),
  });
}
afterEach(() => {
  vi.useRealTimers();
});
describe('ffmpeg process isolation', () => {
  it('passes exact probe, remux, audio transcode and poster arguments without a shell', async () => {
    spawn.mockImplementation(() => {
      const p = child();
      queueMicrotask(() => {
        p.stdout.write('{"format":{},"streams":[]}');
        p.emit('close', 0);
      });
      return p;
    });
    const tools = new FfmpegMediaTools('ffmpeg', 'ffprobe', null);
    await tools.probe('/raw.mp4');
    await tools.remux('/raw.mp4', '/playback.mp4', {
      transcodeAudioToAac: false,
    });
    await tools.remux('/raw.mp4', '/playback.mp4', {
      transcodeAudioToAac: true,
    });
    await tools.poster('/playback.mp4', '/poster.jpg', 1);
    expect(spawn.mock.calls.map((c) => c[1] as unknown)).toEqual([
      [
        '-v',
        'error',
        '-protocol_whitelist',
        'file',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        '/raw.mp4',
      ],
      [
        '-hide_banner',
        '-nostdin',
        '-v',
        'error',
        '-protocol_whitelist',
        'file',
        '-i',
        '/raw.mp4',
        '-map',
        '0:v:0',
        '-map',
        '0:a:0?',
        '-c:v',
        'copy',
        '-c:a',
        'copy',
        '-movflags',
        '+faststart',
        '-f',
        'mp4',
        '-y',
        '/playback.mp4',
      ],
      [
        '-hide_banner',
        '-nostdin',
        '-v',
        'error',
        '-protocol_whitelist',
        'file',
        '-i',
        '/raw.mp4',
        '-map',
        '0:v:0',
        '-map',
        '0:a:0?',
        '-c:v',
        'copy',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
        '-f',
        'mp4',
        '-y',
        '/playback.mp4',
      ],
      [
        '-hide_banner',
        '-nostdin',
        '-v',
        'error',
        '-protocol_whitelist',
        'file',
        '-ss',
        '1',
        '-i',
        '/playback.mp4',
        '-frames:v',
        '1',
        '-vf',
        "scale='min(1280,iw)':-2",
        '-q:v',
        '3',
        '-y',
        '/poster.jpg',
      ],
    ]);
    for (const call of spawn.mock.calls)
      expect(call[2]).toMatchObject({ shell: false });
  });
  it('uses nice and kills a timed out child with SIGKILL', async () => {
    vi.useFakeTimers();
    const p = child();
    spawn.mockReturnValue(p);
    const promise = new FfmpegMediaTools(
      'ffmpeg',
      'ffprobe',
      '/usr/bin/nice',
    ).probe('/raw.mp4');
    const assertion = expect(promise).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(30000);
    await assertion;
    expect(p.kill).toHaveBeenCalledWith('SIGKILL');
    expect(spawn.mock.calls[0]?.slice(0, 2)).toEqual([
      '/usr/bin/nice',
      [
        '-n',
        '10',
        'ffprobe',
        '-v',
        'error',
        '-protocol_whitelist',
        'file',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        '/raw.mp4',
      ],
    ]);
    p.emit('close', null);
  });
  it('hides stderr and reports missing binaries clearly at boot', async () => {
    spawn.mockImplementation(() => {
      const p = child();
      queueMicrotask(() => {
        p.stderr.write(Buffer.alloc(100000, 'x'));
        p.emit('close', 1);
      });
      return p;
    });
    await expect(new FfmpegMediaTools().assertAvailable()).rejects.toThrow(
      'requires working ffmpeg and ffprobe',
    );
  });
});
