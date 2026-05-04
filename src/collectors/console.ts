import type { ConsoleEntry, BugJarConfig } from "../types";
import { RingBuffer, safeStringify } from "../utils";

export class ConsoleCollector {
  private buffer: RingBuffer<ConsoleEntry>;
  private originals: Record<string, (...args: unknown[]) => void> = {};
  private levels: Array<ConsoleEntry["level"]> = [
    "log",
    "warn",
    "error",
    "info",
    "debug",
  ];

  constructor(config: BugJarConfig) {
    this.buffer = new RingBuffer(config.maxConsoleEntries);
  }

  start(): void {
    for (const level of this.levels) {
      this.originals[level] = (console as any)[level].bind(console);
      const self = this;
      (console as any)[level] = (...args: unknown[]) => {
        self.capture(level, args);
        self.originals[level](...args);
      };
    }
  }

  stop(): void {
    for (const level of this.levels) {
      if (this.originals[level]) {
        (console as any)[level] = this.originals[level];
      }
    }
    this.originals = {};
  }

  getEntries(): ConsoleEntry[] {
    return this.buffer.getAll();
  }

  clear(): void {
    this.buffer.clear();
  }

  private capture(level: ConsoleEntry["level"], args: unknown[]): void {
    const entry: ConsoleEntry = {
      timestamp: Date.now(),
      level,
      args: args.map((arg) => {
        if (typeof arg === "string") return arg;
        if (typeof arg === "number" || typeof arg === "boolean") return arg;
        return JSON.parse(safeStringify(arg));
      }),
      stack: level === "error" || level === "warn" ? this.getStack() : null,
    };
    this.buffer.push(entry);
  }

  private getStack(): string | null {
    try {
      const err = new Error();
      return err.stack?.split("\n").slice(4).join("\n") || null;
    } catch {
      return null;
    }
  }
}
