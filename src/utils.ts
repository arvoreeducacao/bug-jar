export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function safeStringify(obj: unknown, maxLength = 10000): string {
  try {
    const seen = new WeakSet();
    const str = JSON.stringify(obj, (_key, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) return "[Circular]";
        seen.add(value);
      }
      if (value instanceof Error) {
        return { message: value.message, stack: value.stack, name: value.name };
      }
      if (typeof value === "function") return "[Function]";
      if (value instanceof HTMLElement) return describeElement(value);
      return value;
    });
    if (str && str.length > maxLength) {
      return str.slice(0, maxLength) + "...[truncated]";
    }
    return str || "";
  } catch {
    return "[Unserializable]";
  }
}

export function describeElement(el: Element | EventTarget | null): string {
  if (!el || !(el instanceof Element)) return "unknown";
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const classes =
    el.className && typeof el.className === "string"
      ? `.${el.className.trim().split(/\s+/).join(".")}`
      : "";
  const text = el.textContent?.trim().slice(0, 30) || "";
  const textPart = text ? ` "${text}"` : "";
  return `${tag}${id}${classes}${textPart}`;
}

export function maskSensitiveData(
  data: unknown,
  sensitiveFields: string[],
): unknown {
  if (!data || typeof data !== "object") return data;
  if (Array.isArray(data))
    return data.map((item) => maskSensitiveData(item, sensitiveFields));

  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const isFieldSensitive = sensitiveFields.some((field) =>
      key.toLowerCase().includes(field.toLowerCase()),
    );
    if (isFieldSensitive) {
      masked[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      masked[key] = maskSensitiveData(value, sensitiveFields);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

export function getStack(): string | null {
  try {
    const err = new Error();
    const stack = err.stack?.split("\n").slice(3).join("\n") || null;
    return stack;
  } catch {
    return null;
  }
}

export class RingBuffer<T> {
  private buffer: T[] = [];
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  push(item: T): void {
    if (this.buffer.length >= this.maxSize) {
      this.buffer.shift();
    }
    this.buffer.push(item);
  }

  getAll(): T[] {
    return [...this.buffer];
  }

  clear(): void {
    this.buffer = [];
  }

  get length(): number {
    return this.buffer.length;
  }
}
