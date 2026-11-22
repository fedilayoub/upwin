import type { ProbeResult } from './probe-schema';
export const MEDIA_TOOLS = Symbol('MEDIA_TOOLS');
export interface MediaTools {
  probe(path: string): Promise<ProbeResult>;
  remux(
    input: string,
    output: string,
    opts: { transcodeAudioToAac: boolean },
  ): Promise<void>;
  poster(input: string, output: string, atSeconds: number): Promise<void>;
  assertAvailable(): Promise<void>;
}
export class InvalidMediaError extends Error {
  constructor() {
    super('Media probe output is invalid.');
  }
}
