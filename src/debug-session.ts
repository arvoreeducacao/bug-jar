import type { BugReport } from "./types";
import { exportAsZip } from "./export";
import { encryptForServer } from "./collectors/encryptor";

export interface DebugSessionPayload {
  token: string;
  publicKey: string;
  presignedPut: string;
  reportId: string;
  expiresAt: number;
}

export interface DebugSessionConfig {
  sessionEndpoint?: string;
  token: string;
}

export function readDebugTokenFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("debug");
  } catch {
    return null;
  }
}

export async function fetchDebugSession(
  sessionEndpoint: string,
  token: string,
): Promise<DebugSessionPayload> {
  const url = `${sessionEndpoint.replace(/\/$/, "")}/${encodeURIComponent(token)}`;
  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to load debug session (${response.status})`);
  }

  return (await response.json()) as DebugSessionPayload;
}

export async function uploadEncryptedReport(
  payload: DebugSessionPayload,
  report: BugReport,
  videoBlob: Blob | null,
): Promise<void> {
  const zip = await exportAsZip(report, videoBlob);
  const zipBytes = new Uint8Array(await zip.arrayBuffer());
  const encrypted = await encryptForServer(zipBytes, payload.publicKey);

  const response = await fetch(payload.presignedPut, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body: encrypted,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload report (${response.status})`);
  }
}
