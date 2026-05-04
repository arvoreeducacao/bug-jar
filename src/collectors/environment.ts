import type { EnvironmentInfo, ConnectionInfo, MemoryInfo } from "../types";

export class EnvironmentCollector {
  collect(): EnvironmentInfo {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      languages: [...navigator.languages],
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: new Date().getTimezoneOffset(),
      screenWidth: screen.width,
      screenHeight: screen.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      colorDepth: screen.colorDepth,
      cookiesEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack,
      online: navigator.onLine,
      hardwareConcurrency: navigator.hardwareConcurrency || 0,
      maxTouchPoints: navigator.maxTouchPoints || 0,
      vendor: navigator.vendor,
      connection: this.getConnection(),
      memory: this.getMemory(),
    };
  }

  private getConnection(): ConnectionInfo | null {
    const conn = (navigator as any).connection;
    if (!conn) return null;
    return {
      effectiveType: conn.effectiveType || "unknown",
      downlink: conn.downlink || 0,
      rtt: conn.rtt || 0,
      saveData: conn.saveData || false,
    };
  }

  private getMemory(): MemoryInfo | null {
    const mem = (performance as any).memory;
    if (!mem) return null;
    return {
      jsHeapSizeLimit: mem.jsHeapSizeLimit,
      totalJSHeapSize: mem.totalJSHeapSize,
      usedJSHeapSize: mem.usedJSHeapSize,
    };
  }
}
