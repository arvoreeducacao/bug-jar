import type { NetworkEntry, BugJarConfig } from "../types";
import { generateId, maskSensitiveData, RingBuffer } from "../utils";

export class NetworkCollector {
  private buffer: RingBuffer<NetworkEntry>;
  private config: BugJarConfig;
  private originalFetch: typeof fetch | null = null;
  private originalXhrOpen: typeof XMLHttpRequest.prototype.open | null = null;
  private originalXhrSend: typeof XMLHttpRequest.prototype.send | null = null;
  private originalXhrSetRequestHeader:
    | typeof XMLHttpRequest.prototype.setRequestHeader
    | null = null;
  private originalSendBeacon: typeof Navigator.prototype.sendBeacon | null =
    null;

  constructor(config: BugJarConfig) {
    this.config = config;
    this.buffer = new RingBuffer(config.maxNetworkEntries);
  }

  start(): void {
    this.interceptFetch();
    this.interceptXHR();
    this.interceptBeacon();
  }

  stop(): void {
    if (this.originalFetch) {
      window.fetch = this.originalFetch;
      this.originalFetch = null;
    }
    if (this.originalXhrOpen && this.originalXhrSend) {
      XMLHttpRequest.prototype.open = this.originalXhrOpen;
      XMLHttpRequest.prototype.send = this.originalXhrSend;
      this.originalXhrOpen = null;
      this.originalXhrSend = null;
    }
    if (this.originalXhrSetRequestHeader) {
      XMLHttpRequest.prototype.setRequestHeader =
        this.originalXhrSetRequestHeader;
      this.originalXhrSetRequestHeader = null;
    }
    if (this.originalSendBeacon) {
      Navigator.prototype.sendBeacon = this.originalSendBeacon;
      this.originalSendBeacon = null;
    }
  }

  getEntries(): NetworkEntry[] {
    return this.buffer.getAll();
  }

  clear(): void {
    this.buffer.clear();
  }

  private interceptFetch(): void {
    this.originalFetch = window.fetch.bind(window);
    const self = this;

    window.fetch = async function (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> {
      const startTime = performance.now();
      const entry: NetworkEntry = {
        id: generateId(),
        timestamp: Date.now(),
        method: (init?.method || "GET").toUpperCase(),
        url:
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : (input as Request).url,
        requestHeaders: self.extractHeaders(init?.headers),
        requestBody: self.safeParseBody(init?.body),
        status: null,
        statusText: "",
        responseHeaders: {},
        responseBody: null,
        responseSize: null,
        duration: null,
        type: "fetch",
        error: null,
        initiator: self.getInitiator(),
      };

      try {
        const response = await self.originalFetch!(input, init);
        entry.status = response.status;
        entry.statusText = response.statusText;
        entry.responseHeaders = self.extractResponseHeaders(response.headers);
        entry.duration = performance.now() - startTime;

        const cloned = response.clone();
        try {
          const text = await cloned.text();
          entry.responseSize = text.length;
          entry.responseBody = self.safeParseJson(text);
        } catch {
          entry.responseBody = "[Unable to read response]";
        }

        entry.requestBody = maskSensitiveData(
          entry.requestBody,
          self.config.sensitiveFields,
        );
        entry.responseBody = maskSensitiveData(
          entry.responseBody,
          self.config.sensitiveFields,
        );
        self.buffer.push(entry);
        return response;
      } catch (err) {
        entry.duration = performance.now() - startTime;
        entry.error = err instanceof Error ? err.message : String(err);
        self.buffer.push(entry);
        throw err;
      }
    };
  }

  private interceptXHR(): void {
    this.originalXhrOpen = XMLHttpRequest.prototype.open;
    this.originalXhrSend = XMLHttpRequest.prototype.send;
    this.originalXhrSetRequestHeader =
      XMLHttpRequest.prototype.setRequestHeader;
    const self = this;

    XMLHttpRequest.prototype.open = function (
      method: string,
      url: string | URL,
    ) {
      (this as any).__bugjar_method = method;
      (this as any).__bugjar_url = typeof url === "string" ? url : url.href;
      (this as any).__bugjar_headers = {} as Record<string, string>;
      return self.originalXhrOpen!.apply(this, arguments as any);
    };

    XMLHttpRequest.prototype.setRequestHeader = function (
      name: string,
      value: string,
    ) {
      if ((this as any).__bugjar_headers) {
        (this as any).__bugjar_headers[name] = value;
      }
      return self.originalXhrSetRequestHeader!.apply(this, arguments as any);
    };

    XMLHttpRequest.prototype.send = function (
      body?: Document | XMLHttpRequestBodyInit | null,
    ) {
      const startTime = performance.now();
      const entry: NetworkEntry = {
        id: generateId(),
        timestamp: Date.now(),
        method: ((this as any).__bugjar_method || "GET").toUpperCase(),
        url: (this as any).__bugjar_url || "",
        requestHeaders: (this as any).__bugjar_headers || {},
        requestBody: self.safeParseBody(body),
        status: null,
        statusText: "",
        responseHeaders: {},
        responseBody: null,
        responseSize: null,
        duration: null,
        type: "xhr",
        error: null,
        initiator: self.getInitiator(),
      };

      this.addEventListener("load", function () {
        entry.status = this.status;
        entry.statusText = this.statusText;
        entry.responseHeaders = self.parseXhrHeaders(
          this.getAllResponseHeaders(),
        );
        entry.duration = performance.now() - startTime;
        entry.responseSize = this.responseText?.length || null;
        entry.responseBody = self.safeParseJson(this.responseText);
        entry.requestBody = maskSensitiveData(
          entry.requestBody,
          self.config.sensitiveFields,
        );
        entry.responseBody = maskSensitiveData(
          entry.responseBody,
          self.config.sensitiveFields,
        );
        self.buffer.push(entry);
      });

      this.addEventListener("error", function () {
        entry.duration = performance.now() - startTime;
        entry.error = "Network error";
        self.buffer.push(entry);
      });

      this.addEventListener("timeout", function () {
        entry.duration = performance.now() - startTime;
        entry.error = "Request timeout";
        self.buffer.push(entry);
      });

      return self.originalXhrSend!.apply(this, arguments as any);
    };
  }

  private interceptBeacon(): void {
    if (!navigator.sendBeacon) return;
    this.originalSendBeacon = navigator.sendBeacon.bind(navigator);
    const self = this;

    Navigator.prototype.sendBeacon = function (
      url: string | URL,
      data?: BodyInit | null,
    ): boolean {
      const entry: NetworkEntry = {
        id: generateId(),
        timestamp: Date.now(),
        method: "POST",
        url: typeof url === "string" ? url : url.href,
        requestHeaders: {},
        requestBody: self.safeParseBody(data),
        status: null,
        statusText: "",
        responseHeaders: {},
        responseBody: null,
        responseSize: null,
        duration: null,
        type: "beacon",
        error: null,
        initiator: "sendBeacon",
      };
      entry.requestBody = maskSensitiveData(
        entry.requestBody,
        self.config.sensitiveFields,
      );
      self.buffer.push(entry);
      return self.originalSendBeacon!(url, data);
    };
  }

  private extractHeaders(headers?: HeadersInit): Record<string, string> {
    const result: Record<string, string> = {};
    if (!headers) return result;
    if (headers instanceof Headers) {
      headers.forEach((value, key) => {
        result[key] = value;
      });
    } else if (Array.isArray(headers)) {
      headers.forEach(([key, value]) => {
        result[key] = value;
      });
    } else {
      Object.assign(result, headers);
    }
    return result;
  }

  private extractResponseHeaders(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  private parseXhrHeaders(raw: string): Record<string, string> {
    const result: Record<string, string> = {};
    if (!raw) return result;
    raw
      .trim()
      .split(/[\r\n]+/)
      .forEach((line) => {
        const parts = line.split(": ");
        const key = parts.shift();
        if (key) result[key] = parts.join(": ");
      });
    return result;
  }

  private safeParseBody(body: unknown): unknown {
    if (!body) return null;
    if (typeof body === "string") return this.safeParseJson(body);
    if (body instanceof FormData) {
      const obj: Record<string, unknown> = {};
      body.forEach((value, key) => {
        obj[key] = value instanceof File ? `[File: ${value.name}]` : value;
      });
      return obj;
    }
    if (body instanceof URLSearchParams)
      return Object.fromEntries(body.entries());
    if (body instanceof Blob) return `[Blob: ${body.size} bytes]`;
    if (body instanceof ArrayBuffer)
      return `[ArrayBuffer: ${body.byteLength} bytes]`;
    return String(body);
  }

  private safeParseJson(text: string | null | undefined): unknown {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text.length > 5000 ? text.slice(0, 5000) + "...[truncated]" : text;
    }
  }

  private getInitiator(): string | null {
    try {
      const stack = new Error().stack;
      if (!stack) return null;
      const lines = stack.split("\n");
      for (const line of lines) {
        if (line.includes("bug-jar")) continue;
        if (line.includes("at ")) return line.trim().slice(0, 200);
      }
      return null;
    } catch {
      return null;
    }
  }
}
