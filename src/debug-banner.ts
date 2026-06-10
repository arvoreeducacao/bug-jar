export type DebugBannerState = "recording" | "encrypting" | "uploading" | "done" | "error";

export class DebugBanner {
  private container: HTMLElement | null = null;
  private onFinish: () => Promise<void>;

  constructor(onFinish: () => Promise<void>) {
    this.onFinish = onFinish;
  }

  mount(): void {
    if (this.container) return;

    this.container = document.createElement("div");
    this.container.id = "bug-jar-debug-banner";
    this.container.innerHTML = `
      <div class="bug-jar-debug-banner-inner">
        <span class="bug-jar-debug-dot"></span>
        <span class="bug-jar-debug-text">Sessão de depuração ativa — gravando</span>
        <button class="bug-jar-debug-finish">Finalizar e enviar</button>
      </div>
    `;

    this.injectStyles();
    document.body.appendChild(this.container);
    this.bindEvents();
  }

  unmount(): void {
    this.container?.remove();
    this.container = null;
    document.getElementById("bug-jar-debug-banner-styles")?.remove();
  }

  setState(state: DebugBannerState, message?: string): void {
    if (!this.container) return;
    const text = this.container.querySelector(
      ".bug-jar-debug-text",
    ) as HTMLElement | null;
    const button = this.container.querySelector(
      ".bug-jar-debug-finish",
    ) as HTMLButtonElement | null;
    const dot = this.container.querySelector(
      ".bug-jar-debug-dot",
    ) as HTMLElement | null;

    const labels: Record<DebugBannerState, string> = {
      recording: "Sessão de depuração ativa — gravando",
      encrypting: "Criptografando o relatório...",
      uploading: "Enviando o relatório...",
      done: "Relatório enviado com sucesso. Pode fechar a aba.",
      error: message ?? "Falha ao enviar o relatório.",
    };

    if (text) text.textContent = labels[state];
    if (button) button.disabled = state !== "recording" && state !== "error";
    if (dot) dot.dataset.state = state;

    if (state === "error" && button) button.textContent = "Tentar novamente";
    if (state === "recording" && button) button.textContent = "Finalizar e enviar";
  }

  private bindEvents(): void {
    const button = this.container?.querySelector(
      ".bug-jar-debug-finish",
    ) as HTMLButtonElement | null;
    button?.addEventListener("click", () => {
      void this.onFinish();
    });
  }

  private injectStyles(): void {
    if (document.getElementById("bug-jar-debug-banner-styles")) return;
    const style = document.createElement("style");
    style.id = "bug-jar-debug-banner-styles";
    style.textContent = `
      #bug-jar-debug-banner {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .bug-jar-debug-banner-inner {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 16px;
        background: #1a1a1a;
        color: #fff;
        font-size: 13px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      }
      .bug-jar-debug-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #dc2626;
        animation: bug-jar-debug-pulse 1.5s infinite;
        flex-shrink: 0;
      }
      .bug-jar-debug-dot[data-state="done"] { background: #16a34a; animation: none; }
      .bug-jar-debug-dot[data-state="error"] { background: #f59e0b; animation: none; }
      .bug-jar-debug-text { flex: 1; }
      .bug-jar-debug-finish {
        padding: 6px 14px;
        border: none;
        border-radius: 6px;
        background: #fff;
        color: #1a1a1a;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
      }
      .bug-jar-debug-finish:disabled { opacity: 0.6; cursor: not-allowed; }
      @keyframes bug-jar-debug-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
    `;
    document.head.appendChild(style);
  }
}
