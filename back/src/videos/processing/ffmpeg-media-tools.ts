import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import type { MediaTools } from './media-tools';
import { InvalidMediaError } from './media-tools';
import { probeSchema } from './probe-schema';

export class FfmpegMediaTools implements MediaTools {
  constructor(
    private readonly ffmpeg = 'ffmpeg',
    private readonly ffprobe = 'ffprobe',
    private readonly nice = existsSync('/usr/bin/nice')
      ? '/usr/bin/nice'
      : null,
  ) {}
  private run(
    binary: string,
    args: string[],
    timeoutMs: number,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = this.nice
        ? spawn(this.nice, ['-n', '10', binary, ...args], {
            shell: false,
            stdio: ['ignore', 'pipe', 'pipe'],
          })
        : spawn(binary, args, {
            shell: false,
            stdio: ['ignore', 'pipe', 'pipe'],
          });
      let stdout = '';
      let stderrBytes = 0;
      const stderr: Buffer[] = [];
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('Media command timed out.'));
      }, timeoutMs);
      child.stdout.on('data', (chunk: Buffer) => {
        if (stdout.length + chunk.length > 1024 * 1024) {
          child.kill('SIGKILL');
          reject(new Error('Media output exceeds limit.'));
        } else stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk: Buffer) => {
        const remaining = 65536 - stderrBytes;
        if (remaining > 0) {
          const captured = chunk.subarray(0, remaining);
          stderr.push(captured);
          stderrBytes += captured.length;
        }
      });
      child.on('error', () => {
        clearTimeout(timer);
        reject(new Error('Media binary could not start.'));
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        // Captured stderr is deliberately never included in logs or thrown errors.
        if (code !== 0) reject(new Error('Media command failed.'));
        else resolve(stdout);
      });
    });
  }
  async probe(path: string) {
    const json = await this.run(
      this.ffprobe,
      [
        '-v',
        'error',
        '-protocol_whitelist',
        'file',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        path,
      ],
      30000,
    );
    try {
      return probeSchema.parse(JSON.parse(json) as unknown);
    } catch {
      throw new InvalidMediaError();
    }
  }
  async remux(
    input: string,
    output: string,
    opts: { transcodeAudioToAac: boolean },
  ) {
    await this.run(
      this.ffmpeg,
      [
        '-hide_banner',
        '-nostdin',
        '-v',
        'error',
        '-protocol_whitelist',
        'file',
        '-i',
        input,
        '-map',
        '0:v:0',
        '-map',
        '0:a:0?',
        '-c:v',
        'copy',
        '-c:a',
        opts.transcodeAudioToAac ? 'aac' : 'copy',
        ...(opts.transcodeAudioToAac ? ['-b:a', '128k'] : []),
        '-movflags',
        '+faststart',
        '-f',
        'mp4',
        '-y',
        output,
      ],
      300000,
    );
  }
  async poster(input: string, output: string, atSeconds: number) {
    await this.run(
      this.ffmpeg,
      [
        '-hide_banner',
        '-nostdin',
        '-v',
        'error',
        '-protocol_whitelist',
        'file',
        '-ss',
        String(atSeconds),
        '-i',
        input,
        '-frames:v',
        '1',
        '-vf',
        "scale='min(1280,iw)':-2",
        '-q:v',
        '3',
        '-y',
        output,
      ],
      60000,
    );
  }
  async assertAvailable() {
    try {
      await this.run(
        this.ffmpeg,
        ['-protocol_whitelist', 'file', '-version'],
        30000,
      );
      await this.run(
        this.ffprobe,
        ['-protocol_whitelist', 'file', '-version'],
        30000,
      );
    } catch {
      throw new Error(
        'Video recording requires working ffmpeg and ffprobe binaries on PATH. The Docker image ships both.',
      );
    }
  }
}
