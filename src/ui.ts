import type { BugJarConfig, BugReport } from "./types";
import type { ScreenRecorder } from "./collectors/screen-recorder";

export class BugJarUI {
  private container: HTMLElement | null = null;
  private config: BugJarConfig;
  private onReport: (description: string) => Promise<BugReport>;
  private screenRecorder: ScreenRecorder;

  constructor(
    config: BugJarConfig,
    onReport: (description: string) => Promise<BugReport>,
    screenRecorder: ScreenRecorder,
  ) {
    this.config = config;
    this.onReport = onReport;
    this.screenRecorder = screenRecorder;
  }

  mount(): void {
    if (this.container) return;

    this.container = document.createElement("div");
    this.container.id = "bug-jar-widget";
    this.container.innerHTML = this.getWidgetHTML();
    document.body.appendChild(this.container);

    this.injectStyles();
    this.bindEvents();
  }

  unmount(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    const style = document.getElementById("bug-jar-styles");
    if (style) style.remove();
  }

  private getWidgetHTML(): string {
    const pos = this.config.uiPosition;
    const posClass = `bug-jar--${pos}`;

    return `
      <button class="bug-jar-trigger ${posClass}" aria-label="${this.config.uiLabel}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3.003 3.003 0 116 0v1"/>
          <path d="M12 20c-3.3 0-6-2.7-6-6v-3a6 6 0 0112 0v3c0 3.3-2.7 6-6 6z"/>
          <path d="M12 20v2M6 13H2M22 13h-4M6 17l-2 2M18 17l2 2M6 9l-2-2M18 9l2-2"/>
        </svg>
        <span>${this.config.uiLabel}</span>
      </button>
      <div class="bug-jar-modal" hidden>
        <div class="bug-jar-modal-backdrop"></div>
        <div class="bug-jar-modal-content">
          <div class="bug-jar-modal-header">
            <h3>Reportar Bug</h3>
            <button class="bug-jar-close" aria-label="Fechar">&times;</button>
          </div>
          <div class="bug-jar-modal-body">
            <label for="bug-jar-description">O que aconteceu?</label>
            <textarea id="bug-jar-description" placeholder="Descreva o que você estava fazendo e o que deu errado..." rows="4"></textarea>
            <p class="bug-jar-hint">Todas as informações técnicas serão capturadas automaticamente.</p>
            <div class="bug-jar-recording-section">
              <button class="bug-jar-record-btn">
                <span class="bug-jar-record-icon"></span>
                <span class="bug-jar-record-label">Gravar Tela</span>
              </button>
              <span class="bug-jar-recording-status" hidden>Gravando...</span>
            </div>
          </div>
          <div class="bug-jar-modal-footer">
            <button class="bug-jar-cancel">Cancelar</button>
            <button class="bug-jar-submit">Enviar Relatório</button>
          </div>
          <div class="bug-jar-status" hidden></div>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    if (!this.container) return;

    const trigger = this.container.querySelector(
      ".bug-jar-trigger",
    ) as HTMLElement;
    const modal = this.container.querySelector(".bug-jar-modal") as HTMLElement;
    const backdrop = this.container.querySelector(
      ".bug-jar-modal-backdrop",
    ) as HTMLElement;
    const closeBtn = this.container.querySelector(
      ".bug-jar-close",
    ) as HTMLElement;
    const cancelBtn = this.container.querySelector(
      ".bug-jar-cancel",
    ) as HTMLElement;
    const submitBtn = this.container.querySelector(
      ".bug-jar-submit",
    ) as HTMLElement;
    const textarea = this.container.querySelector(
      "#bug-jar-description",
    ) as HTMLTextAreaElement;
    const status = this.container.querySelector(
      ".bug-jar-status",
    ) as HTMLElement;
    const recordBtn = this.container.querySelector(
      ".bug-jar-record-btn",
    ) as HTMLElement;
    const recordingStatus = this.container.querySelector(
      ".bug-jar-recording-status",
    ) as HTMLElement;

    const openModal = () => {
      modal.hidden = false;
      textarea.focus();
      this.updateRecordingUI(recordBtn, recordingStatus);
    };

    const closeModal = () => {
      modal.hidden = true;
      textarea.value = "";
      status.hidden = true;
    };

    trigger.addEventListener("click", openModal);
    backdrop.addEventListener("click", closeModal);
    closeBtn.addEventListener("click", closeModal);
    cancelBtn.addEventListener("click", closeModal);

    recordBtn.addEventListener("click", async () => {
      if (this.screenRecorder.isRecording) {
        return;
      }
      closeModal();
      await this.screenRecorder.start();
      this.updateTriggerForRecording(trigger);
    });

    submitBtn.addEventListener("click", async () => {
      const description = textarea.value.trim();
      if (!description) {
        textarea.classList.add("bug-jar-error");
        return;
      }
      textarea.classList.remove("bug-jar-error");

      submitBtn.setAttribute("disabled", "true");
      submitBtn.textContent = "Capturando...";
      status.hidden = true;

      try {
        await this.onReport(description);
        status.textContent = "✓ Relatório baixado como .zip!";
        status.className = "bug-jar-status bug-jar-status--success";
        status.hidden = false;
        this.resetTrigger(trigger);
        setTimeout(closeModal, 2000);
      } catch (err) {
        status.textContent = `Erro: ${err instanceof Error ? err.message : "Falha ao gerar relatório"}`;
        status.className = "bug-jar-status bug-jar-status--error";
        status.hidden = false;
      } finally {
        submitBtn.removeAttribute("disabled");
        submitBtn.textContent = "Enviar Relatório";
      }
    });

    textarea.addEventListener("input", () => {
      textarea.classList.remove("bug-jar-error");
    });
  }

  private updateRecordingUI(
    recordBtn: HTMLElement,
    recordingStatus: HTMLElement,
  ): void {
    if (this.screenRecorder.isRecording) {
      recordBtn.classList.add("bug-jar-record-btn--active");
      recordingStatus.hidden = false;
      const label = recordBtn.querySelector(".bug-jar-record-label");
      if (label) label.textContent = "Gravando...";
    } else {
      recordBtn.classList.remove("bug-jar-record-btn--active");
      recordingStatus.hidden = true;
      const label = recordBtn.querySelector(".bug-jar-record-label");
      if (label) label.textContent = "Gravar Tela";
    }
  }

  private updateTriggerForRecording(trigger: HTMLElement): void {
    trigger.classList.add("bug-jar-trigger--recording");
    const span = trigger.querySelector("span");
    if (span) span.textContent = "⏺ Gravando...";
  }

  private resetTrigger(trigger: HTMLElement): void {
    trigger.classList.remove("bug-jar-trigger--recording");
    const span = trigger.querySelector("span");
    if (span) span.textContent = this.config.uiLabel;
  }

  private injectStyles(): void {
    if (document.getElementById("bug-jar-styles")) return;

    const style = document.createElement("style");
    style.id = "bug-jar-styles";
    style.textContent = `
      #bug-jar-widget {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        color: #1a1a1a;
      }

      .bug-jar-trigger {
        position: fixed;
        z-index: 99999;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 10px 16px;
        border: none;
        border-radius: 24px;
        background: #1a1a1a;
        color: #fff;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        transition: transform 0.15s, box-shadow 0.15s, background 0.3s;
      }

      .bug-jar-trigger:hover {
        transform: scale(1.05);
        box-shadow: 0 6px 20px rgba(0,0,0,0.2);
      }

      .bug-jar-trigger--recording {
        background: #dc2626;
        animation: bug-jar-pulse 1.5s infinite;
      }

      @keyframes bug-jar-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }

      .bug-jar--bottom-right { bottom: 20px; right: 20px; }
      .bug-jar--bottom-left { bottom: 20px; left: 20px; }
      .bug-jar--top-right { top: 20px; right: 20px; }
      .bug-jar--top-left { top: 20px; left: 20px; }

      .bug-jar-modal {
        position: fixed;
        inset: 0;
        z-index: 100000;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .bug-jar-modal[hidden] { display: none; }

      .bug-jar-modal-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(0,0,0,0.5);
        backdrop-filter: blur(2px);
      }

      .bug-jar-modal-content {
        position: relative;
        width: 90%;
        max-width: 480px;
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        overflow: hidden;
      }

      .bug-jar-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid #eee;
      }

      .bug-jar-modal-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }

      .bug-jar-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #666;
        padding: 0 4px;
      }

      .bug-jar-modal-body {
        padding: 20px;
      }

      .bug-jar-modal-body label {
        display: block;
        font-weight: 500;
        margin-bottom: 8px;
      }

      #bug-jar-description {
        width: 100%;
        padding: 12px;
        border: 1px solid #ddd;
        border-radius: 8px;
        font-size: 14px;
        font-family: inherit;
        resize: vertical;
        min-height: 100px;
        box-sizing: border-box;
      }

      #bug-jar-description:focus {
        outline: none;
        border-color: #1a1a1a;
        box-shadow: 0 0 0 2px rgba(26,26,26,0.1);
      }

      #bug-jar-description.bug-jar-error {
        border-color: #e53e3e;
      }

      .bug-jar-hint {
        margin: 8px 0 0;
        font-size: 12px;
        color: #888;
      }

      .bug-jar-recording-section {
        margin-top: 16px;
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .bug-jar-record-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        border: 1px solid #ddd;
        border-radius: 6px;
        background: #fff;
        cursor: pointer;
        font-size: 13px;
        transition: all 0.2s;
      }

      .bug-jar-record-btn:hover {
        border-color: #dc2626;
        color: #dc2626;
      }

      .bug-jar-record-btn--active {
        border-color: #dc2626;
        background: #fef2f2;
        color: #dc2626;
        pointer-events: none;
      }

      .bug-jar-record-icon {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #dc2626;
      }

      .bug-jar-recording-status {
        font-size: 12px;
        color: #dc2626;
        font-weight: 500;
        animation: bug-jar-pulse 1.5s infinite;
      }

      .bug-jar-modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 16px 20px;
        border-top: 1px solid #eee;
      }

      .bug-jar-cancel {
        padding: 8px 16px;
        border: 1px solid #ddd;
        border-radius: 6px;
        background: #fff;
        cursor: pointer;
        font-size: 13px;
      }

      .bug-jar-submit {
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        background: #1a1a1a;
        color: #fff;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
      }

      .bug-jar-submit:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .bug-jar-status {
        padding: 12px 20px;
        font-size: 13px;
        text-align: center;
      }

      .bug-jar-status--success { color: #16a34a; background: #f0fdf4; }
      .bug-jar-status--error { color: #dc2626; background: #fef2f2; }
    `;
    document.head.appendChild(style);
  }
}
