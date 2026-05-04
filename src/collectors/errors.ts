import type { ErrorEntry, BugJarConfig } from "../types";
import { RingBuffer } from "../utils";

export class ErrorCollector {
  private buffer: RingBuffer<ErrorEntry>;
  private errorHandler: ((event: ErrorEvent) => void) | null = null;
  private rejectionHandler: ((event: PromiseRejectionEvent) => void) | null =
    null;
  private resourceErrorHandler: ((event: Event) => void) | null = null;

  constructor(config: BugJarConfig) {
    this.buffer = new RingBuffer(config.maxErrors);
  }

  start(): void {
    this.errorHandler = (event: ErrorEvent) => {
      this.buffer.push({
        timestamp: Date.now(),
        message: event.message || "Unknown error",
        stack: event.error?.stack || null,
        filename: event.filename || null,
        lineno: event.lineno || null,
        colno: event.colno || null,
        type: "uncaught",
        context: this.getContext(event.error),
      });
    };

    this.rejectionHandler = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      this.buffer.push({
        timestamp: Date.now(),
        message: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack || null : null,
        filename: null,
        lineno: null,
        colno: null,
        type: "unhandledrejection",
        context: reason instanceof Error ? this.getContext(reason) : null,
      });
    };

    this.resourceErrorHandler = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target || !(target instanceof HTMLElement)) return;
      if (
        target.tagName === "SCRIPT" ||
        target.tagName === "LINK" ||
        target.tagName === "IMG"
      ) {
        this.buffer.push({
          timestamp: Date.now(),
          message: `Failed to load ${target.tagName.toLowerCase()}: ${(target as any).src || (target as any).href || "unknown"}`,
          stack: null,
          filename: (target as any).src || (target as any).href || null,
          lineno: null,
          colno: null,
          type: "resource",
          context: null,
        });
      }
    };

    window.addEventListener("error", this.errorHandler);
    window.addEventListener("unhandledrejection", this.rejectionHandler);
    window.addEventListener("error", this.resourceErrorHandler, true);
  }

  stop(): void {
    if (this.errorHandler) {
      window.removeEventListener("error", this.errorHandler);
      this.errorHandler = null;
    }
    if (this.rejectionHandler) {
      window.removeEventListener("unhandledrejection", this.rejectionHandler);
      this.rejectionHandler = null;
    }
    if (this.resourceErrorHandler) {
      window.removeEventListener("error", this.resourceErrorHandler, true);
      this.resourceErrorHandler = null;
    }
  }

  getEntries(): ErrorEntry[] {
    return this.buffer.getAll();
  }

  clear(): void {
    this.buffer.clear();
  }

  private getContext(error: Error | null): string | null {
    if (!error) return null;
    try {
      const stack = error.stack;
      if (!stack) return null;
      const match = stack.match(/at\s+(.+?)\s+\(/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }
}
