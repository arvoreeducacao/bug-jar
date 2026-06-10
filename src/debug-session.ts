export interface DebugSessionPayload {
  token: string;
  publicKey: string;
  expiresAt: number;
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
  rawFetch: typeof fetch = fetch,
): Promise<DebugSessionPayload> {
  const url = `${sessionEndpoint.replace(/\/$/, "")}/${encodeURIComponent(token)}`;
  const response = await rawFetch(url, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to load debug session (${response.status})`);
  }

  return (await response.json()) as DebugSessionPayload;
}

export function makeChunkUrlFetcher(
  sessionEndpoint: string,
  rawFetch: typeof fetch = fetch,
) {
  const base = sessionEndpoint.replace(/\/$/, "");
  return async (params: {
    token: string;
    pageId: string;
    stream: "data" | "video";
    seq: number;
  }): Promise<{ uploadUrl: string }> => {
    const url = `${base}/${encodeURIComponent(params.token)}/chunk-url`;
    const response = await rawFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        pageId: params.pageId,
        stream: params.stream,
        seq: params.seq,
      }),
    });
    if (!response.ok) {
      throw new Error(`Failed to get chunk URL (${response.status})`);
    }
    return (await response.json()) as { uploadUrl: string };
  };
}

export async function uploadPageMeta(
  sessionEndpoint: string,
  token: string,
  pageId: string,
  meta: Record<string, unknown>,
  rawFetch: typeof fetch = fetch,
): Promise<void> {
  const base = sessionEndpoint.replace(/\/$/, "");
  const url = `${base}/${encodeURIComponent(token)}/meta`;
  await rawFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    keepalive: true,
    body: JSON.stringify({ pageId, meta }),
  });
}
