import type { BugReport } from "./types";

export function generateSummary(report: BugReport): string {
  const lines: string[] = [];

  lines.push(`Bug Report: ${report.id}`);
  lines.push(`URL: ${report.url}`);
  lines.push(`Time: ${new Date(report.timestamp).toISOString()}`);
  lines.push(`User Description: "${report.userDescription}"`);
  lines.push("");

  lines.push("## Environment");
  lines.push(`Browser: ${extractBrowser(report.environment.userAgent)}`);
  lines.push(
    `Viewport: ${report.environment.viewportWidth}x${report.environment.viewportHeight}`,
  );
  lines.push(
    `Connection: ${report.environment.connection?.effectiveType || "unknown"}`,
  );
  lines.push(`Online: ${report.environment.online}`);
  lines.push("");

  lines.push("## Network Activity");
  const totalRequests = report.network.length;
  const failedRequests = report.network.filter(
    (n) => n.error || (n.status && n.status >= 400),
  );
  const slowRequests = report.network.filter(
    (n) => n.duration && n.duration > 3000,
  );
  lines.push(`Total requests: ${totalRequests}`);
  if (failedRequests.length > 0) {
    lines.push(`Failed requests (${failedRequests.length}):`);
    for (const req of failedRequests) {
      lines.push(
        `  - ${req.method} ${req.url} → ${req.error || `HTTP ${req.status}`}`,
      );
    }
  }
  if (slowRequests.length > 0) {
    lines.push(`Slow requests >3s (${slowRequests.length}):`);
    for (const req of slowRequests) {
      lines.push(
        `  - ${req.method} ${req.url} (${Math.round(req.duration!)}ms)`,
      );
    }
  }
  lines.push("");

  lines.push("## Errors");
  if (report.errors.length === 0) {
    lines.push("No errors captured.");
  } else {
    lines.push(`Total errors: ${report.errors.length}`);
    for (const err of report.errors) {
      lines.push(`  - [${err.type}] ${err.message}`);
      if (err.filename)
        lines.push(`    at ${err.filename}:${err.lineno}:${err.colno}`);
    }
  }
  lines.push("");

  lines.push("## Console");
  const consoleCounts = { log: 0, warn: 0, error: 0, info: 0, debug: 0 };
  for (const entry of report.console) {
    consoleCounts[entry.level]++;
  }
  lines.push(
    `Logs: ${consoleCounts.log}, Warnings: ${consoleCounts.warn}, Errors: ${consoleCounts.error}, Info: ${consoleCounts.info}, Debug: ${consoleCounts.debug}`,
  );
  const consoleErrors = report.console.filter((c) => c.level === "error");
  if (consoleErrors.length > 0) {
    lines.push("Console errors:");
    for (const ce of consoleErrors) {
      lines.push(
        `  - ${ce.args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ")}`,
      );
    }
  }
  lines.push("");

  lines.push("## User Actions");
  lines.push(`Total actions: ${report.userActions.length}`);
  const actionTypes: Record<string, number> = {};
  for (const action of report.userActions) {
    actionTypes[action.type] = (actionTypes[action.type] || 0) + 1;
  }
  for (const [type, count] of Object.entries(actionTypes)) {
    lines.push(`  - ${type}: ${count}`);
  }
  if (report.userActions.length > 0) {
    const first = report.userActions[0].timestamp;
    const last = report.userActions[report.userActions.length - 1].timestamp;
    const duration = ((last - first) / 1000).toFixed(1);
    lines.push(`Session duration: ${duration}s`);
  }
  lines.push("");

  if (report.performance) {
    lines.push("## Performance");
    const perf = report.performance;
    if (perf.largestContentfulPaint)
      lines.push(`LCP: ${Math.round(perf.largestContentfulPaint)}ms`);
    if (perf.firstInputDelay)
      lines.push(`FID: ${Math.round(perf.firstInputDelay)}ms`);
    if (perf.cumulativeLayoutShift !== null)
      lines.push(`CLS: ${perf.cumulativeLayoutShift?.toFixed(3)}`);
    if (perf.loadComplete)
      lines.push(`Page Load: ${Math.round(perf.loadComplete)}ms`);
    lines.push(
      `Resources: ${perf.resourceCount} (${formatBytes(perf.totalTransferSize)})`,
    );
  }

  return lines.join("\n");
}

function extractBrowser(ua: string): string {
  if (ua.includes("Chrome/")) {
    const match = ua.match(/Chrome\/(\d+)/);
    return `Chrome ${match?.[1] || ""}`;
  }
  if (ua.includes("Firefox/")) {
    const match = ua.match(/Firefox\/(\d+)/);
    return `Firefox ${match?.[1] || ""}`;
  }
  if (ua.includes("Safari/") && !ua.includes("Chrome")) {
    const match = ua.match(/Version\/(\d+)/);
    return `Safari ${match?.[1] || ""}`;
  }
  return ua.slice(0, 50);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
