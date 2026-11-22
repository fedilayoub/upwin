// Test boundary for the engine; the production store uses IndexedDB.
import type { ChunkStore, StoredSession, StoredChunk } from "./chunk-store";
export class MemoryChunkStore implements ChunkStore {
  sessions = new Map<string, StoredSession>();
  chunks: StoredChunk[] = [];
  async saveSession(s: StoredSession) {
    this.sessions.set(s.sessionId, structuredClone(s));
  }
  async updateSession(
    id: string,
    update: Partial<Pick<StoredSession, "phase" | "elapsedMs">>,
  ) {
    const s = this.sessions.get(id);
    if (s) Object.assign(s, update);
  }
  async putChunk(id: string, blob: Blob) {
    const s = this.sessions.get(id)!;
    this.chunks.push({
      sessionId: id,
      seq: s.nextSeq++,
      offset: s.bytesRecorded,
      blob,
    });
    s.bytesRecorded += blob.size;
  }
  async readFrom(id: string, seq = 0) {
    return this.chunks.filter((c) => c.sessionId === id && c.seq >= seq);
  }
  async markUploaded(
    id: string,
    partNumber: number,
    etag: string,
    sizeBytes: number,
  ) {
    const s = this.sessions.get(id)!;
    s.uploaded = [
      ...s.uploaded.filter((p) => p.partNumber !== partNumber),
      { partNumber, etag, sizeBytes },
    ].sort((a, b) => a.partNumber - b.partNumber);
    let bytes = 0,
      n = 1;
    for (const part of s.uploaded) {
      if (part.partNumber !== n++) break;
      bytes += part.sizeBytes;
    }
    s.committedBytes = bytes;
    this.chunks = this.chunks.filter(
      (c) => c.sessionId !== id || c.offset + c.blob.size > bytes,
    );
  }
  async deleteSession(id: string) {
    this.sessions.delete(id);
    this.chunks = this.chunks.filter((c) => c.sessionId !== id);
  }
  async listUnfinished() {
    return [...this.sessions.values()].map((s) => structuredClone(s));
  }
}
