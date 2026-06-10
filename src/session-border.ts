export class SessionBorder {
  private container: HTMLElement | null = null;

  mount(): void {
    if (this.container) return;

    this.container = document.createElement("div");
    this.container.id = "bug-jar-session-border";
    this.container.setAttribute("aria-hidden", "true");
    this.container.innerHTML = `
      <div class="bug-jar-session-border-glow"></div>
      <div class="bug-jar-session-pill">
        <span class="bug-jar-session-pill-dot"></span>
        <span>Sessão de depuração ativa</span>
      </div>
    `;

    this.injectStyles();
    document.body.appendChild(this.container);
  }

  unmount(): void {
    this.container?.remove();
    this.container = null;
    document.getElementById("bug-jar-session-border-styles")?.remove();
  }

  private injectStyles(): void {
    if (document.getElementById("bug-jar-session-border-styles")) return;
    const style = document.createElement("style");
    style.id = "bug-jar-session-border-styles";
    style.textContent = `
      #bug-jar-session-border {
        position: fixed;
        inset: 0;
        z-index: 2147483646;
        pointer-events: none;
      }
      .bug-jar-session-border-glow {
        position: absolute;
        inset: 0;
        border-radius: 14px;
        padding: 4px;
        background: linear-gradient(
          120deg,
          #66DCCE,
          #39AF9F,
          #40CAB6,
          #309385,
          #66DCCE
        );
        background-size: 300% 300%;
        animation: bug-jar-border-flow 6s ease infinite;
        -webkit-mask:
          linear-gradient(#fff 0 0) content-box,
          linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
        mask:
          linear-gradient(#fff 0 0) content-box,
          linear-gradient(#fff 0 0);
        mask-composite: exclude;
      }
      .bug-jar-session-pill {
        position: absolute;
        bottom: 16px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 14px;
        border-radius: 999px;
        background: rgba(15, 27, 21, 0.85);
        color: #E6FAF7;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px;
        font-weight: 500;
        box-shadow: 0 4px 16px rgba(0,0,0,0.25);
        backdrop-filter: blur(6px);
      }
      .bug-jar-session-pill-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #40CAB6;
        animation: bug-jar-border-pulse 1.6s ease-in-out infinite;
      }
      @keyframes bug-jar-border-flow {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      @keyframes bug-jar-border-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(0.85); }
      }
      @media (prefers-reduced-motion: reduce) {
        .bug-jar-session-border-glow { animation: none; }
        .bug-jar-session-pill-dot { animation: none; }
      }
    `;
    document.head.appendChild(style);
  }
}
