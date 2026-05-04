export class ScreenRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private recording = false;

  get isRecording(): boolean {
    return this.recording;
  }

  async start(): Promise<void> {
    if (this.recording) return;

    try {
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 15 },
        audio: false,
        preferCurrentTab: true,
      } as any);

      this.chunks = [];
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: this.getSupportedMimeType(),
        videoBitsPerSecond: 1_000_000,
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.recording = false;
        this.stopTracks();
      };

      this.stream.getVideoTracks()[0].onended = () => {
        this.stop();
      };

      this.mediaRecorder.start(1000);
      this.recording = true;
    } catch {
      this.recording = false;
      this.stream = null;
      this.mediaRecorder = null;
    }
  }

  stop(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || !this.recording) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        this.recording = false;
        this.stopTracks();
        const blob = new Blob(this.chunks, {
          type: this.getSupportedMimeType(),
        });
        this.chunks = [];
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  private stopTracks(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }

  private getSupportedMimeType(): string {
    const types = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
      "video/mp4",
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return "video/webm";
  }
}
