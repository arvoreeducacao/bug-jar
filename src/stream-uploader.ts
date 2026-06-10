import { StreamEncryptor } from "./collectors/stream-encryptor";

export interface ChunkUrlResponse {
  uploadUrl: string;
}

export type ChunkUrlFetcher = (params: {
  token: string;
  pageId: string;
  stream: "data" | "video";
  seq: number;
}) => Promise<ChunkUrlResponse>;

type FetchLike = typeof fetch;

export class StreamUploader {
  private encryptor = new StreamEncryptor();
  private seq = 0;
  private initialized = false;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly token: string,
    private readonly pageId: string,
    private readonly stream: "data" | "video",
    private readonly publicKey: string,
    private readonly fetchChunkUrl: ChunkUrlFetcher,
    private readonly rawFetch: FetchLike = fetch,
  ) {}

  private async ensureInit(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    const header = await this.encryptor.init(this.publicKey);
    await this.putChunk(header);
  }

  pushChunk(data: Uint8Array, final = false): void {
    this.queue = this.queue.then(async () => {
      await this.ensureInit();
      const encrypted = this.encryptor.encryptChunk(data, final);
      await this.putChunk(encrypted);
    });
  }

  async flush(): Promise<void> {
    await this.queue;
  }

  private async putChunk(bytes: Uint8Array): Promise<void> {
    const { uploadUrl } = await this.fetchChunkUrl({
      token: this.token,
      pageId: this.pageId,
      stream: this.stream,
      seq: this.seq,
    });
    this.seq += 1;
    await this.rawFetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: bytes as unknown as BodyInit,
    });
  }
}
