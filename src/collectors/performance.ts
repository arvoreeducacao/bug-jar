import type { PerformanceData } from "../types";

export class PerformanceCollector {
  private lcp: number | null = null;
  private fid: number | null = null;
  private cls: number | null = null;
  private observers: PerformanceObserver[] = [];

  start(): void {
    this.observeLCP();
    this.observeFID();
    this.observeCLS();
  }

  stop(): void {
    for (const observer of this.observers) {
      observer.disconnect();
    }
    this.observers = [];
  }

  collect(): PerformanceData {
    const nav = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    const paint = performance.getEntriesByType("paint");
    const resources = performance.getEntriesByType(
      "resource",
    ) as PerformanceResourceTiming[];

    const fp = paint.find((p) => p.name === "first-paint");
    const fcp = paint.find((p) => p.name === "first-contentful-paint");

    return {
      navigationTiming: nav
        ? {
            redirectTime: nav.redirectEnd - nav.redirectStart,
            dnsTime: nav.domainLookupEnd - nav.domainLookupStart,
            tcpTime: nav.connectEnd - nav.connectStart,
            tlsTime:
              nav.secureConnectionStart > 0
                ? nav.connectEnd - nav.secureConnectionStart
                : 0,
            ttfb: nav.responseStart - nav.requestStart,
            downloadTime: nav.responseEnd - nav.responseStart,
            domParsing: nav.domInteractive - nav.responseEnd,
            domContentLoaded:
              nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart,
            loadEvent: nav.loadEventEnd - nav.loadEventStart,
            totalTime: nav.loadEventEnd - nav.startTime,
          }
        : {},
      resourceCount: resources.length,
      totalTransferSize: resources.reduce(
        (sum, r) => sum + (r.transferSize || 0),
        0,
      ),
      domContentLoaded: nav
        ? nav.domContentLoadedEventEnd - nav.startTime
        : null,
      loadComplete: nav ? nav.loadEventEnd - nav.startTime : null,
      firstPaint: fp ? fp.startTime : null,
      firstContentfulPaint: fcp ? fcp.startTime : null,
      largestContentfulPaint: this.lcp,
      firstInputDelay: this.fid,
      cumulativeLayoutShift: this.cls,
      timeToInteractive: null,
    };
  }

  private observeLCP(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length > 0) {
          this.lcp = entries[entries.length - 1].startTime;
        }
      });
      observer.observe({ type: "largest-contentful-paint", buffered: true });
      this.observers.push(observer);
    } catch {
      /* not supported */
    }
  }

  private observeFID(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries() as PerformanceEventTiming[];
        if (entries.length > 0) {
          this.fid = entries[0].processingStart - entries[0].startTime;
        }
      });
      observer.observe({ type: "first-input", buffered: true });
      this.observers.push(observer);
    } catch {
      /* not supported */
    }
  }

  private observeCLS(): void {
    try {
      let clsValue = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
        this.cls = clsValue;
      });
      observer.observe({ type: "layout-shift", buffered: true });
      this.observers.push(observer);
    } catch {
      /* not supported */
    }
  }
}
