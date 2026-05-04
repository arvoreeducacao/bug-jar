import type { StorageSnapshot, BugJarConfig } from "../types";

export class StorageCollector {
  private config: BugJarConfig;

  constructor(config: BugJarConfig) {
    this.config = config;
  }

  collect(): StorageSnapshot | null {
    return {
      localStorage: this.config.captureLocalStorage
        ? this.collectStorage(localStorage)
        : {},
      sessionStorage: this.config.captureSessionStorage
        ? this.collectStorage(sessionStorage)
        : {},
      cookies: this.config.captureCookies ? this.collectCookies() : [],
    };
  }

  private collectStorage(storage: Storage): Record<string, string> {
    const result: Record<string, string> = {};
    try {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key) continue;
        const isSensitive = this.config.sensitiveFields.some((field) =>
          key.toLowerCase().includes(field.toLowerCase()),
        );
        if (isSensitive) {
          result[key] = "[REDACTED]";
        } else {
          const value = storage.getItem(key) || "";
          result[key] =
            value.length > 500 ? value.slice(0, 500) + "...[truncated]" : value;
        }
      }
    } catch {
      /* storage access denied */
    }
    return result;
  }

  private collectCookies(): string[] {
    try {
      return document.cookie
        .split(";")
        .map((c) => c.trim().split("=")[0])
        .filter(Boolean);
    } catch {
      return [];
    }
  }
}
