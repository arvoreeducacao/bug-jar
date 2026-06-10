export interface SpeedtestResult {
  ranAt: number;
  latencyMs: number | null;
  jitterMs: number | null;
  downloadMbps: number | null;
  uploadMbps: number | null;
  durationMs: number;
}

type FetchLike = typeof fetch;

const LATENCY_SAMPLES = 5;
const DOWNLOAD_BYTES = 8 * 1024 * 1024;
const UPLOAD_BYTES = 4 * 1024 * 1024;
const DOWNLOAD_STREAMS = 4;

export class SpeedtestCollector {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly rawFetch: FetchLike = fetch,
  ) {}

  async run(): Promise<SpeedtestResult> {
    const start = performance.now();
    const result: SpeedtestResult = {
      ranAt: Date.now(),
      latencyMs: null,
      jitterMs: null,
      downloadMbps: null,
      uploadMbps: null,
      durationMs: 0,
    };

    try {
      const latency = await this.measureLatency();
      result.latencyMs = latency.min;
      result.jitterMs = latency.jitter;
    } catch {
      /* keep null */
    }

    try {
      result.downloadMbps = await this.measureDownload();
    } catch {
      /* keep null */
    }

    try {
      result.uploadMbps = await this.measureUpload();
    } catch {
      /* keep null */
    }

    result.durationMs = Math.round(performance.now() - start);
    return result;
  }

  private url(path: string): string {
    return `${this.baseUrl.replace(/\/$/, "")}/${encodeURIComponent(this.token)}/${path}`;
  }

  private async measureLatency(): Promise<{ min: number; jitter: number }> {
    const samples: number[] = [];
    for (let i = 0; i < LATENCY_SAMPLES; i++) {
      const t0 = performance.now();
      await this.rawFetch(this.url(`speedtest/ping?n=${i}`), { cache: "no-store" });
      samples.push(performance.now() - t0);
    }
    const min = Math.min(...samples);
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    const jitter =
      samples.reduce((a, b) => a + Math.abs(b - avg), 0) / samples.length;
    return { min: Math.round(min), jitter: Math.round(jitter) };
  }

  private async measureDownload(): Promise<number> {
    const perStream = Math.floor(DOWNLOAD_BYTES / DOWNLOAD_STREAMS);
    const t0 = performance.now();
    const streams = Array.from({ length: DOWNLOAD_STREAMS }, (_, i) =>
      this.rawFetch(this.url(`speedtest/download?bytes=${perStream}&s=${i}`), {
        cache: "no-store",
      }).then((r) => r.arrayBuffer()),
    );
    const buffers = await Promise.all(streams);
    const elapsed = (performance.now() - t0) / 1000;
    const totalBytes = buffers.reduce((sum, b) => sum + b.byteLength, 0);
    return this.toMbps(totalBytes, elapsed);
  }

  private async measureUpload(): Promise<number> {
    const payload = new Uint8Array(UPLOAD_BYTES);
    crypto.getRandomValues(payload.subarray(0, Math.min(65536, UPLOAD_BYTES)));
    const t0 = performance.now();
    await this.rawFetch(this.url("speedtest/upload"), {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: payload as unknown as BodyInit,
    });
    const elapsed = (performance.now() - t0) / 1000;
    return this.toMbps(UPLOAD_BYTES, elapsed);
  }

  private toMbps(bytes: number, seconds: number): number {
    if (seconds <= 0) return 0;
    return Math.round(((bytes * 8) / seconds / 1_000_000) * 100) / 100;
  }
}
