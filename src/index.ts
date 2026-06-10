import type { BugJarConfig, BugReport } from "./types";
import { NetworkCollector } from "./collectors/network";
import { ConsoleCollector } from "./collectors/console";
import { ErrorCollector } from "./collectors/errors";
import { UserActionCollector } from "./collectors/user-actions";
import { EnvironmentCollector } from "./collectors/environment";
import { PerformanceCollector } from "./collectors/performance";
import { StorageCollector } from "./collectors/storage";
import { ScreenshotCollector } from "./collectors/screenshot";
import { FeatureFlagCollector } from "./collectors/feature-flags";
import { ScreenRecorder } from "./collectors/screen-recorder";
import { DebugBanner } from "./debug-banner";
import {
  readDebugTokenFromUrl,
  fetchDebugSession,
  uploadEncryptedReport,
  type DebugSessionPayload,
} from "./debug-session";
import { generateId } from "./utils";
import { generateSummary } from "./summary";
import { exportAsZip } from "./export";

export type { BugJarConfig, BugReport } from "./types";
export { generateSummary } from "./summary";
export { exportAsZip } from "./export";
export type { DebugSessionPayload } from "./debug-session";

const VERSION = "0.4.0";

const DEFAULT_CONFIG: BugJarConfig = {
  maxNetworkEntries: 100,
  maxConsoleEntries: 200,
  maxUserActions: 150,
  maxErrors: 50,
  captureScreenshot: true,
  captureHtmlSnapshot: true,
  captureCookies: true,
  captureLocalStorage: true,
  captureSessionStorage: true,
  capturePerformance: true,
  captureWebVitals: true,
  captureMemory: true,
  captureConnectivity: true,
  sensitiveFields: [
    "password",
    "token",
    "secret",
    "authorization",
    "cookie",
    "session",
    "credit_card",
    "cvv",
    "ssn",
    "cpf",
  ],
  endpoint: undefined,
  onCapture: undefined,
  debugToken: undefined,
  debugSessionEndpoint: undefined,
};

export class BugJar {
  private config: BugJarConfig;
  private network: NetworkCollector;
  private console: ConsoleCollector;
  private errors: ErrorCollector;
  private userActions: UserActionCollector;
  private environment: EnvironmentCollector;
  private performance: PerformanceCollector;
  private storage: StorageCollector;
  private screenshot: ScreenshotCollector;
  private featureFlags: FeatureFlagCollector;
  private screenRecorder: ScreenRecorder;
  private debugBanner: DebugBanner | null = null;
  private debugSession: DebugSessionPayload | null = null;
  private started = false;

  constructor(config: Partial<BugJarConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.network = new NetworkCollector(this.config);
    this.console = new ConsoleCollector(this.config);
    this.errors = new ErrorCollector(this.config);
    this.userActions = new UserActionCollector(this.config);
    this.environment = new EnvironmentCollector();
    this.performance = new PerformanceCollector();
    this.storage = new StorageCollector(this.config);
    this.screenshot = new ScreenshotCollector();
    this.featureFlags = new FeatureFlagCollector();
    this.screenRecorder = new ScreenRecorder();
  }

  start(): void {
    if (this.started) return;
    this.started = true;

    this.network.start();
    this.console.start();
    this.errors.start();
    this.userActions.start();

    if (this.config.captureWebVitals) {
      this.performance.start();
    }

    const debugToken = this.config.debugToken ?? readDebugTokenFromUrl();
    if (debugToken) {
      void this.startDebugSession(debugToken);
    }
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;

    this.network.stop();
    this.console.stop();
    this.errors.stop();
    this.userActions.stop();
    this.performance.stop();
    this.debugBanner?.unmount();
  }

  async startRecording(): Promise<void> {
    await this.screenRecorder.start();
  }

  get isRecording(): boolean {
    return this.screenRecorder.isRecording;
  }

  async capture(userDescription = ""): Promise<BugReport> {
    const report: BugReport = {
      id: generateId(),
      timestamp: Date.now(),
      url: window.location.href,
      title: document.title,
      userDescription,
      environment: this.environment.collect(),
      network: this.network.getEntries(),
      console: this.console.getEntries(),
      errors: this.errors.getEntries(),
      userActions: this.userActions.getEntries(),
      performance: this.config.capturePerformance
        ? this.performance.collect()
        : null,
      storage: this.storage.collect(),
      screenshot: this.config.captureScreenshot
        ? await this.screenshot.capture()
        : null,
      htmlSnapshot: this.config.captureHtmlSnapshot
        ? this.screenshot.captureHtml()
        : null,
      featureFlags: this.featureFlags.collect(),
      metadata: {},
      version: VERSION,
    };

    if (this.config.onCapture) {
      this.config.onCapture(report);
    }

    return report;
  }

  async captureAndExport(userDescription = ""): Promise<BugReport> {
    const videoBlob = await this.screenRecorder.stop();
    const report = await this.capture(userDescription);

    if (this.config.endpoint) {
      if (videoBlob) {
        const formData = new FormData();
        formData.append("report", JSON.stringify(report));
        formData.append("video", videoBlob, "recording.webm");
        await fetch(this.config.endpoint, { method: "POST", body: formData });
      } else {
        await fetch(this.config.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(report),
        });
      }
    } else {
      const zip = await exportAsZip(report, videoBlob);
      const url = URL.createObjectURL(zip);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bug-report-${report.id}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    }

    return report;
  }

  getReport(): Promise<BugReport> {
    return this.capture();
  }

  private async startDebugSession(token: string): Promise<void> {
    if (!this.config.debugSessionEndpoint) {
      return;
    }

    const mountBanner = () => {
      this.debugBanner = new DebugBanner(() => this.finishDebugSession());
      this.debugBanner.mount();
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", mountBanner);
    } else {
      mountBanner();
    }

    try {
      this.debugSession = await fetchDebugSession(
        this.config.debugSessionEndpoint,
        token,
      );
      await this.screenRecorder.start();
    } catch (err) {
      this.debugBanner?.setState(
        "error",
        err instanceof Error ? err.message : "Falha ao iniciar a sessão.",
      );
    }
  }

  private async finishDebugSession(): Promise<void> {
    if (!this.debugSession) return;

    try {
      const videoBlob = await this.screenRecorder.stop();
      this.debugBanner?.setState("encrypting");
      const report = await this.capture("Debug session capture");
      this.debugBanner?.setState("uploading");
      await uploadEncryptedReport(this.debugSession, report, videoBlob);
      this.debugBanner?.setState("done");
    } catch (err) {
      this.debugBanner?.setState(
        "error",
        err instanceof Error ? err.message : "Falha ao enviar o relatório.",
      );
    }
  }
}

export function init(config: Partial<BugJarConfig> = {}): BugJar {
  const instance = new BugJar(config);
  instance.start();
  return instance;
}

if (typeof window !== "undefined") {
  (window as any).BugJar = { BugJar, init };
}

export default BugJar;
