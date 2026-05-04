export interface BugJarConfig {
  maxNetworkEntries: number;
  maxConsoleEntries: number;
  maxUserActions: number;
  maxErrors: number;
  captureScreenshot: boolean;
  captureHtmlSnapshot: boolean;
  captureCookies: boolean;
  captureLocalStorage: boolean;
  captureSessionStorage: boolean;
  capturePerformance: boolean;
  captureWebVitals: boolean;
  captureMemory: boolean;
  captureConnectivity: boolean;
  sensitiveFields: string[];
  endpoint?: string;
  onCapture?: (report: BugReport) => void;
  ui: boolean;
  uiPosition: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  uiLabel: string;
}

export interface NetworkEntry {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody: unknown;
  status: number | null;
  statusText: string;
  responseHeaders: Record<string, string>;
  responseBody: unknown;
  responseSize: number | null;
  duration: number | null;
  type: "fetch" | "xhr" | "beacon";
  error: string | null;
  initiator: string | null;
}

export interface ConsoleEntry {
  timestamp: number;
  level: "log" | "warn" | "error" | "info" | "debug";
  args: unknown[];
  stack: string | null;
}

export interface ErrorEntry {
  timestamp: number;
  message: string;
  stack: string | null;
  filename: string | null;
  lineno: number | null;
  colno: number | null;
  type: "uncaught" | "unhandledrejection" | "resource";
  context: string | null;
}

export interface UserAction {
  timestamp: number;
  type:
    | "click"
    | "input"
    | "navigation"
    | "scroll"
    | "resize"
    | "visibility"
    | "copy"
    | "paste";
  target: string;
  value?: string;
  metadata?: Record<string, unknown>;
}

export interface EnvironmentInfo {
  userAgent: string;
  platform: string;
  language: string;
  languages: string[];
  timezone: string;
  timezoneOffset: number;
  screenWidth: number;
  screenHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
  colorDepth: number;
  cookiesEnabled: boolean;
  doNotTrack: string | null;
  online: boolean;
  hardwareConcurrency: number;
  maxTouchPoints: number;
  vendor: string;
  connection: ConnectionInfo | null;
  memory: MemoryInfo | null;
}

export interface ConnectionInfo {
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
}

export interface MemoryInfo {
  jsHeapSizeLimit: number;
  totalJSHeapSize: number;
  usedJSHeapSize: number;
}

export interface PerformanceData {
  navigationTiming: Record<string, number>;
  resourceCount: number;
  totalTransferSize: number;
  domContentLoaded: number | null;
  loadComplete: number | null;
  firstPaint: number | null;
  firstContentfulPaint: number | null;
  largestContentfulPaint: number | null;
  firstInputDelay: number | null;
  cumulativeLayoutShift: number | null;
  timeToInteractive: number | null;
}

export interface StorageSnapshot {
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  cookies: string[];
}

export interface BugReport {
  id: string;
  timestamp: number;
  url: string;
  title: string;
  userDescription: string;
  environment: EnvironmentInfo;
  network: NetworkEntry[];
  console: ConsoleEntry[];
  errors: ErrorEntry[];
  userActions: UserAction[];
  performance: PerformanceData | null;
  storage: StorageSnapshot | null;
  screenshot: string | null;
  htmlSnapshot: string | null;
  featureFlags: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  version: string;
}
