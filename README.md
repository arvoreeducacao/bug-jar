# 🪲 Bug Jar

Capture everything for non-technical people to help debug. One debug link, zero config.

Bug Jar is a lightweight JavaScript library that silently records all browser activity (network requests, console logs, errors, user actions, performance metrics, and more) and lets you capture a complete, encrypted debug session from a one-time debug link.

## Why?

Because asking someone to "open DevTools and check the Network tab" doesn't scale. Bug Jar gives your support team and QA a link they can send to anyone to capture everything developers need to reproduce and fix bugs.

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

Bug Jar runs as a **debug session**: staff generates a one-time link, the user
opens it in the real app, and the encrypted package is uploaded to S3. See
[Debug Session Mode](#debug-session-mode-encrypted-upload-to-s3) below.

```html
<script src="https://unpkg.com/@arvoretech/bug-jar"></script>
<script>
  BugJar.init({
    debugSessionEndpoint: 'https://livros.arvore.com.br/debug-sessions',
  })
</script>
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

  // Callback when report is generated
  onCapture: (report) => console.log(report),

  // Debug session
  debugSessionEndpoint: 'https://livros.arvore.com.br/debug-sessions',
  // debugToken is read automatically from the ?debug=<token> query param
})
```

## Programmatic Usage

```typescript
import { BugJar } from '@arvoretech/bug-jar'

const jar = new BugJar()
jar.start()

// Later, capture a report programmatically
const report = await jar.capture('User clicked X but nothing happened')

// Send it wherever you want
await fetch('/api/bugs', {
  method: 'POST',
  body: JSON.stringify(report),
})
```

## Debug Session Mode (encrypted upload to S3)

For non-technical users, staff can generate a one-time debug link. The user opens
the link in the real app, reproduces the bug, and Bug Jar records the whole flow,
encrypts the package end-to-end in the browser, and uploads it straight to a
private S3 bucket via a presigned URL. No AWS credentials ever reach the browser.

```html
<script src="https://unpkg.com/@arvoretech/bug-jar"></script>
<script>
  BugJar.init({
    debugSessionEndpoint: 'https://livros.arvore.com.br/debug-sessions',
    // debugToken is read automatically from the ?debug=<token> query param
  })
</script>
```

Flow:

1. Staff (admin) calls `POST /debug-sessions` with the target app URL and gets back
   a `debugLink` (`https://app.../?debug=<token>`), the server public key, and an expiry.
2. The user opens the link. Bug Jar detects `?debug=<token>`, persists the token in
   a `.arvore.com.br` cookie, fetches the session, starts screen recording, and
   shows an animated **session border** (no button, no banner).
3. The user just uses the app. The session survives navigation across apps
   (app-v2 → legacy → reader) by re-hydrating the token from the cookie on each
   page. Each page streams **encrypted chunks** to S3 in real time:
   - **data** (network/console/errors/actions/storage) every 5s as JSONL
   - **video** chunks straight from `MediaRecorder` as they are produced
   Chunks are uploaded to `debug/<token>/<pageId>/<stream>/<seq>.bin` via per-chunk
   presigned PUT URLs (`POST /debug-sessions/:token/chunk-url`). Page metadata goes
   to `debug/<token>/<pageId>/meta.json` (`POST /debug-sessions/:token/meta`).
4. Staff reconstructs the session offline:
   ```bash
   BUG_JAR_API=https://livros.arvore.com.br/debug-sessions \
   BUG_JAR_API_TOKEN=<admin-jwt> \
   node scripts/decrypt-session.cjs <token> ./out
   ```
   This reads the X25519 private key from Secrets Manager (`bug-jar/keypair`),
   downloads all chunks via `GET /debug-sessions/:token/download`, decrypts each
   per-page stream, and writes `<pageId>/data.jsonl`, `<pageId>/video.webm`,
   `<pageId>/meta.json`.

## Speed test

At the start of each page, Bug Jar runs a fast.com-style network speed test
against the Árvore backend and stores the result in that page's `meta.json`:

- **latency** — minimum and jitter from repeated `GET /speedtest/ping`
- **download (Mbps)** — 8 MB pulled across 4 parallel streams
  (`GET /speedtest/download?bytes=N`)
- **upload (Mbps)** — 4 MB sent to `POST /speedtest/upload` (server discards it)

It measures the real end-to-end throughput between the user and our
infrastructure (which is exactly what we want when debugging "the app is slow").
The test runs once per page and is best-effort — failures leave the fields null
without blocking the session.

## Encryption

Each stream (data and video, per page) is encrypted with libsodium
`crypto_secretstream_xchacha20poly1305`: a random symmetric key drives the stream,
and that key is sealed with `crypto_box_seal` (X25519) to the server public key.
The first chunk of every stream is `[magic][version][sealedKeyLen][sealedKey][header]`;
subsequent chunks are the encrypted stream messages, the last carrying `TAG_FINAL`.
Chunks leave the browser already unreadable; only the holder of the X25519 private
key can open them. `libsodium-wrappers` is loaded dynamically, so it only ships
when debug mode is actually used.

> Cross-app continuity works because all apps live under `*.arvore.com.br` and
> share the session cookie. Screen recording restarts per app (the browser does
> not allow `getDisplayMedia` to persist across full page loads / origins), so the
> video is reconstructed per page rather than as one continuous file.


## Privacy & Security

- Sensitive fields are automatically redacted (passwords, tokens, secrets, etc.)
- Password inputs are never captured
- You control what gets captured via configuration
- No data leaves the browser unless a debug session is active
- All processing happens client-side

## Browser Support

Works in all modern browsers (Chrome, Firefox, Safari, Edge). Some features (memory info, connection type) are Chrome-only but degrade gracefully.

## Size

~12kb gzipped, zero dependencies.

## License

MIT
