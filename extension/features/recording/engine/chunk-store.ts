import type { SessionPhase } from "../protocol";
export interface StoredSession {
  sessionId: string;
  videoId: string;
  shareUrl: string;
  partSize: number;
  nextPartNumber: number;
  uploaded: { partNumber: number; etag: string; sizeBytes: number }[];
  phase: SessionPhase;
  createdAt: number;
  elapsedMs: number;
  bytesRecorded: number;
  nextSeq: number;
  committedBytes: number;
}
export interface StoredChunk {
  sessionId: string;
  seq: number;
  offset: number;
  blob: Blob;
}
export interface ChunkStore {
  saveSession(session: StoredSession): Promise<void>;
  updateSession(
    sessionId: string,
    update: Partial<Pick<StoredSession, "phase" | "elapsedMs">>,
  ): Promise<void>;
  putChunk(sessionId: string, chunk: Blob): Promise<void>;
  readFrom(sessionId: string, seq?: number): Promise<StoredChunk[]>;
  markUploaded(
    sessionId: string,
    partNumber: number,
    etag: string,
    sizeBytes: number,
  ): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  listUnfinished(): Promise<StoredSession[]>;
}
const result = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
const finished = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(tx.error ?? new Error("IndexedDB transaction aborted"));
    tx.onerror = () => reject(tx.error);
  });
export class IndexedChunkStore implements ChunkStore {
  private db?: Promise<IDBDatabase>;
  private open() {
    return (this.db ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("upwin-recordings", 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore("sessions", { keyPath: "sessionId" });
        req.result.createObjectStore("chunks", {
          keyPath: ["sessionId", "seq"],
        });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
  }
  async saveSession(session: StoredSession) {
    const db = await this.open(),
      tx = db.transaction("sessions", "readwrite"),
      done = finished(tx);
    tx.objectStore("sessions").put(session);
    await done;
  }
  async updateSession(
    id: string,
    update: Partial<Pick<StoredSession, "phase" | "elapsedMs">>,
  ) {
    const db = await this.open(),
      tx = db.transaction("sessions", "readwrite"),
      done = finished(tx),
      store = tx.objectStore("sessions");
    const session = (await result(store.get(id))) as StoredSession | undefined;
    if (session) store.put({ ...session, ...update });
    await done;
  }
  async putChunk(id: string, blob: Blob) {
    if (!blob.size) return;
    const db = await this.open(),
      tx = db.transaction(["sessions", "chunks"], "readwrite"),
      done = finished(tx),
      sessions = tx.objectStore("sessions");
    const session = (await result(sessions.get(id))) as
      StoredSession | undefined;
    if (!session) {
      tx.abort();
      await done;
      return;
    }
    tx.objectStore("chunks").put({
      sessionId: id,
      seq: session.nextSeq,
      offset: session.bytesRecorded,
      blob,
    } satisfies StoredChunk);
    sessions.put({
      ...session,
      nextSeq: session.nextSeq + 1,
      bytesRecorded: session.bytesRecorded + blob.size,
    });
    await done;
  }
  async readFrom(id: string, seq = 0): Promise<StoredChunk[]> {
    const db = await this.open(),
      tx = db.transaction("chunks"),
      done = finished(tx);
    const rows = (await result(
      tx
        .objectStore("chunks")
        .getAll(IDBKeyRange.bound([id, seq], [id, Number.MAX_SAFE_INTEGER])),
    )) as StoredChunk[];
    await done;
    return rows;
  }
  async markUploaded(
    id: string,
    partNumber: number,
    etag: string,
    sizeBytes: number,
  ) {
    const db = await this.open(),
      tx = db.transaction(["sessions", "chunks"], "readwrite"),
      done = finished(tx),
      sessions = tx.objectStore("sessions"),
      chunks = tx.objectStore("chunks");
    const session = (await result(sessions.get(id))) as
      StoredSession | undefined;
    if (!session) {
      await done;
      return;
    }
    const uploaded = [
      ...session.uploaded.filter((p) => p.partNumber !== partNumber),
      { partNumber, etag, sizeBytes },
    ].sort((a, b) => a.partNumber - b.partNumber);
    let committedBytes = 0,
      expected = 1;
    for (const part of uploaded) {
      if (part.partNumber !== expected) break;
      expected++;
      committedBytes += part.sizeBytes;
    }
    sessions.put({
      ...session,
      uploaded,
      committedBytes,
      nextPartNumber: expected,
    });
    const req = chunks.openCursor(
      IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]),
    );
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      const chunk = cursor.value as StoredChunk;
      if (chunk.offset + chunk.blob.size <= committedBytes) cursor.delete();
      cursor.continue();
    };
    await done;
  }
  async deleteSession(id: string) {
    const db = await this.open(),
      tx = db.transaction(["sessions", "chunks"], "readwrite"),
      done = finished(tx);
    tx.objectStore("sessions").delete(id);
    tx.objectStore("chunks").delete(
      IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]),
    );
    await done;
  }
  async listUnfinished(): Promise<StoredSession[]> {
    const db = await this.open(),
      tx = db.transaction("sessions"),
      done = finished(tx);
    const rows = (await result(
      tx.objectStore("sessions").getAll(),
    )) as StoredSession[];
    await done;
    return rows;
  }
}
