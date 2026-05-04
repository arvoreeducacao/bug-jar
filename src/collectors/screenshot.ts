export class ScreenshotCollector {
  async capture(): Promise<string | null> {
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      const width = window.innerWidth;
      const height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio, 2);

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      const svgData = this.domToSvg(width, height);
      if (!svgData) return null;

      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
          try {
            const dataUrl = canvas.toDataURL("image/png", 0.8);
            resolve(dataUrl);
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`;

        setTimeout(() => resolve(null), 3000);
      });
    } catch {
      return null;
    }
  }

  private domToSvg(width: number, height: number): string | null {
    try {
      const clone = document.documentElement.cloneNode(true) as HTMLElement;

      const scripts = clone.querySelectorAll("script");
      scripts.forEach((s) => s.remove());

      const html = new XMLSerializer().serializeToString(clone);

      return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <foreignObject width="100%" height="100%">
          ${html}
        </foreignObject>
      </svg>`;
    } catch {
      return null;
    }
  }

  captureHtml(): string | null {
    try {
      const clone = document.documentElement.cloneNode(true) as HTMLElement;
      const scripts = clone.querySelectorAll("script");
      scripts.forEach((s) => s.remove());

      const inputs = clone.querySelectorAll(
        'input[type="password"], input[name*="token"], input[name*="secret"]',
      );
      inputs.forEach(
        (input) => ((input as HTMLInputElement).value = "[REDACTED]"),
      );

      return clone.outerHTML.slice(0, 500000);
    } catch {
      return null;
    }
  }
}
