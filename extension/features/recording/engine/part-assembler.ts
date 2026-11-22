export interface Part {
  partNumber: number;
  blob: Blob;
}
export class PartAssembler {
  private blobs: Blob[] = [];
  private buffered = 0;
  private next: number;
  bytesTotal = 0;
  constructor(
    readonly partSize: number,
    firstPart = 1,
  ) {
    if (!Number.isInteger(partSize) || partSize <= 0)
      throw new Error("Invalid part size");
    this.next = firstPart;
  }
  push(chunk: Blob): Part[] {
    if (!chunk.size) return [];
    this.blobs.push(chunk);
    this.buffered += chunk.size;
    this.bytesTotal += chunk.size;
    const parts: Part[] = [];
    while (this.buffered >= this.partSize) parts.push(this.take(this.partSize));
    return parts;
  }
  flush(): Part | null {
    return this.buffered ? this.take(this.buffered) : null;
  }
  private take(size: number): Part {
    const joined = new Blob(this.blobs),
      part = { partNumber: this.next++, blob: joined.slice(0, size) };
    this.blobs = joined.size > size ? [joined.slice(size)] : [];
    this.buffered -= size;
    return part;
  }
}
