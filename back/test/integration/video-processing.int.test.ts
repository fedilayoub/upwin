import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assessPlayback,
  assessRaw,
} from '../../src/videos/processing/assess-media';
import { FfmpegMediaTools } from '../../src/videos/processing/ffmpeg-media-tools';
describe.skipIf(!process.env.RUN_MEDIA_INTEGRATION)(
  'real video processing',
  () => {
    it('validates fragmented MP4, remuxes faststart, and generates a JPEG', async () => {
      const dir = await mkdtemp(join(tmpdir(), 'upilot-media-int-'));
      try {
        const raw = join(dir, 'raw.mp4'),
          playback = join(dir, 'playback.mp4'),
          poster = join(dir, 'poster.jpg');
        await new Promise<void>((resolve, reject) => {
          const p = spawn(
            process.env.FFMPEG_PATH ?? 'ffmpeg',
            [
              '-v',
              'error',
              '-f',
              'lavfi',
              '-i',
              'testsrc=size=1280x720:rate=30',
              '-f',
              'lavfi',
              '-i',
              'sine=frequency=440',
              '-t',
              '6',
              '-c:v',
              'libx264',
              '-pix_fmt',
              'yuv420p',
              '-c:a',
              'aac',
              '-movflags',
              'frag_keyframe+empty_moov+default_base_moof',
              raw,
            ],
            { shell: false, stdio: 'ignore' },
          );
          const timer = setTimeout(() => {
            p.kill('SIGKILL');
            reject(new Error('Fixture generation timed out'));
          }, 60000);
          p.on('error', reject);
          p.on('close', (code) => {
            clearTimeout(timer);
            if (code === 0) resolve();
            else reject(new Error('Fixture generation failed'));
          });
        });
        const tools = new FfmpegMediaTools(
          process.env.FFMPEG_PATH,
          process.env.FFPROBE_PATH,
        );
        await tools.assertAvailable();
        const rawAssessment = assessRaw(await tools.probe(raw));
        expect(rawAssessment.ok).toBe(true);
        if (!rawAssessment.ok) throw new Error('Raw fixture rejected');
        await tools.remux(raw, playback, rawAssessment);
        const result = assessPlayback(await tools.probe(playback), {
          maxDurationMs: 300000,
        });
        expect(result).toMatchObject({ ok: true, width: 1280, height: 720 });
        if (!result.ok) throw new Error('Playback fixture rejected');
        expect(Math.abs(result.durationMs - 6000)).toBeLessThan(150);
        await tools.poster(playback, poster, 1);
        expect((await readFile(poster)).subarray(0, 3)).toEqual(
          Buffer.from([0xff, 0xd8, 0xff]),
        );
        expect((await stat(playback)).size).toBeGreaterThan(0);
        const bytes = await readFile(playback);
        const atoms: string[] = [];
        for (let offset = 0; offset + 8 <= bytes.length;) {
          const size = bytes.readUInt32BE(offset);
          atoms.push(bytes.toString('ascii', offset + 4, offset + 8));
          if (size < 8) break;
          offset += size;
        }
        expect(atoms).toContain('moov');
        expect(atoms).toContain('mdat');
        expect(atoms.indexOf('moov')).toBeLessThan(atoms.indexOf('mdat'));
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    }, 90000);
  },
);
