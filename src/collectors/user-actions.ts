import type { UserAction, BugJarConfig } from "../types";
import { describeElement, RingBuffer } from "../utils";

export class UserActionCollector {
  private buffer: RingBuffer<UserAction>;
  private listeners: Array<{
    event: string;
    handler: EventListener;
    options?: boolean;
  }> = [];

  constructor(config: BugJarConfig) {
    this.buffer = new RingBuffer(config.maxUserActions);
  }

  start(): void {
    this.addListener(
      "click",
      (e: Event) => {
        const target = e.target as Element;
        this.buffer.push({
          timestamp: Date.now(),
          type: "click",
          target: describeElement(target),
          metadata: {
            x: (e as MouseEvent).clientX,
            y: (e as MouseEvent).clientY,
            button: (e as MouseEvent).button,
          },
        });
      },
      true,
    );

    this.addListener(
      "input",
      (e: Event) => {
        const target = e.target as HTMLInputElement;
        const isSensitive =
          target.type === "password" ||
          target.type === "hidden" ||
          target.name?.toLowerCase().includes("password") ||
          target.name?.toLowerCase().includes("token") ||
          target.name?.toLowerCase().includes("secret");

        this.buffer.push({
          timestamp: Date.now(),
          type: "input",
          target: describeElement(target),
          value: isSensitive ? "[REDACTED]" : target.value?.slice(0, 50) || "",
          metadata: {
            inputType: target.type,
            name: target.name,
          },
        });
      },
      true,
    );

    this.addListener(
      "scroll",
      this.throttle(() => {
        this.buffer.push({
          timestamp: Date.now(),
          type: "scroll",
          target: "window",
          metadata: {
            scrollX: window.scrollX,
            scrollY: window.scrollY,
            scrollHeight: document.documentElement.scrollHeight,
          },
        });
      }, 500),
    );

    this.addListener(
      "resize",
      this.throttle(() => {
        this.buffer.push({
          timestamp: Date.now(),
          type: "resize",
          target: "window",
          metadata: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
        });
      }, 500),
    );

    this.addListener("visibilitychange", () => {
      this.buffer.push({
        timestamp: Date.now(),
        type: "visibility",
        target: "document",
        value: document.visibilityState,
      });
    });

    this.addListener("copy", (e: Event) => {
      this.buffer.push({
        timestamp: Date.now(),
        type: "copy",
        target: describeElement(e.target as Element),
      });
    });

    this.addListener("paste", (e: Event) => {
      this.buffer.push({
        timestamp: Date.now(),
        type: "paste",
        target: describeElement(e.target as Element),
      });
    });

    const originalPushState = history.pushState.bind(history);
    const originalReplaceState = history.replaceState.bind(history);
    const self = this;

    history.pushState = function (...args) {
      self.buffer.push({
        timestamp: Date.now(),
        type: "navigation",
        target: String(args[2] || window.location.href),
        metadata: { method: "pushState" },
      });
      return originalPushState(...args);
    };

    history.replaceState = function (...args) {
      self.buffer.push({
        timestamp: Date.now(),
        type: "navigation",
        target: String(args[2] || window.location.href),
        metadata: { method: "replaceState" },
      });
      return originalReplaceState(...args);
    };

    this.addListener("popstate", () => {
      this.buffer.push({
        timestamp: Date.now(),
        type: "navigation",
        target: window.location.href,
        metadata: { method: "popstate" },
      });
    });
  }

  stop(): void {
    for (const { event, handler, options } of this.listeners) {
      const target = event === "visibilitychange" ? document : window;
      target.removeEventListener(event, handler, options);
    }
    this.listeners = [];
  }

  getEntries(): UserAction[] {
    return this.buffer.getAll();
  }

  clear(): void {
    this.buffer.clear();
  }

  private addListener(
    event: string,
    handler: EventListener,
    options?: boolean,
  ): void {
    const target = event === "visibilitychange" ? document : window;
    target.addEventListener(event, handler, options);
    this.listeners.push({ event, handler, options });
  }

  private throttle(fn: () => void, ms: number): EventListener {
    let last = 0;
    return () => {
      const now = Date.now();
      if (now - last >= ms) {
        last = now;
        fn();
      }
    };
  }
}
