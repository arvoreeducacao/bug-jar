# 🪲 Bug Jar

Capture everything for non-technical people to help debug. One script tag, zero config.

Bug Jar is a lightweight JavaScript library that silently records all browser activity (network requests, console logs, errors, user actions, performance metrics, and more) and lets anyone — even non-technical users — generate a complete debug report with a single click.

## Why?

Because asking someone to "open DevTools and check the Network tab" doesn't scale. Bug Jar gives your support team, QA, and stakeholders a one-click way to capture everything developers need to reproduce and fix bugs.

## What it captures

| Category | Details |
|----------|---------|
| **Network** | All fetch/XHR/beacon requests with headers, payload, response, status, timing |
| **Console** | log, warn, error, info, debug — with stack traces |
| **Errors** | Uncaught exceptions, unhandled promise rejections, resource load failures |
| **User Actions** | Clicks, inputs, navigation, scroll, resize, visibility changes |
| **Environment** | Browser, OS, viewport, DPR, timezone, language, connection type |
| **Performance** | Navigation timing, Web Vitals (LCP, FID, CLS), resource count |
| **Storage** | localStorage keys, sessionStorage keys, cookie names |
| **Screenshot** | Visual snapshot of the current page state |
| **HTML Snapshot** | Full DOM at the moment of report |
| **Feature Flags** | PostHog, LaunchDarkly, Statsig, Unleash (auto-detected) |
| **Memory** | JS heap usage (Chrome) |

## Quick Start

### Script tag (zero config)

```html
<script src="https://unpkg.com/@arvoretech/bug-jar"></script>
<script>
  BugJar.init();
</script>
```

### NPM

```bash
npm install @arvoretech/bug-jar
```

```typescript
import { init } from '@arvoretech/bug-jar'

init({
  endpoint: 'https://your-api.com/bug-reports',
  uiPosition: 'bottom-right',
})
```

## Configuration

```typescript
init({
  // Buffer sizes
  maxNetworkEntries: 100,
  maxConsoleEntries: 200,
  maxUserActions: 150,
  maxErrors: 50,

  // What to capture
  captureScreenshot: true,
  captureHtmlSnapshot: true,
  captureCookies: true,
  captureLocalStorage: true,
  captureSessionStorage: true,
  capturePerformance: true,
  captureWebVitals: true,
  captureMemory: true,
  captureConnectivity: true,

  // Privacy — fields containing these strings are redacted
  sensitiveFields: ['password', 'token', 'secret', 'authorization', 'cookie', 'session', 'credit_card', 'cvv', 'ssn', 'cpf'],

  // Where to send reports (if not set, downloads as JSON file)
  endpoint: 'https://your-api.com/bug-reports',

  // Callback when report is generated
  onCapture: (report) => console.log(report),

  // UI widget
  ui: true,
  uiPosition: 'bottom-right', // bottom-right | bottom-left | top-right | top-left
  uiLabel: 'Reportar Bug',
})
```

## Programmatic Usage

```typescript
import { BugJar } from '@arvoretech/bug-jar'

const jar = new BugJar({ ui: false })
jar.start()

// Later, capture a report programmatically
const report = await jar.capture('User clicked X but nothing happened')

// Send it wherever you want
await fetch('/api/bugs', {
  method: 'POST',
  body: JSON.stringify(report),
})
```

## Privacy & Security

- Sensitive fields are automatically redacted (passwords, tokens, secrets, etc.)
- Password inputs are never captured
- You control what gets captured via configuration
- No data leaves the browser unless you configure an endpoint
- All processing happens client-side

## Browser Support

Works in all modern browsers (Chrome, Firefox, Safari, Edge). Some features (memory info, connection type) are Chrome-only but degrade gracefully.

## Size

~12kb gzipped, zero dependencies.

## License

MIT
