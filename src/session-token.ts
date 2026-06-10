const COOKIE_NAME = "bug-jar-session";

function resolveCookieDomain(): string | undefined {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return undefined;
  }
  const host = window.location.hostname;
  if (/^[0-9.]+$/.test(host) || host === "localhost") {
    return undefined;
  }
  const parts = host.split(".");
  if (parts.length < 2) return undefined;

  const probe = "bug-jar-domain-probe";
  for (let i = parts.length - 2; i >= 0; i--) {
    const candidate = `.${parts.slice(i).join(".")}`;
    document.cookie = `${probe}=1; Path=/; Domain=${candidate}; SameSite=Lax`;
    const accepted = document.cookie.includes(`${probe}=1`);
    document.cookie = `${probe}=; Path=/; Domain=${candidate}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    if (accepted) {
      return candidate;
    }
  }
  return undefined;
}

export function readSessionToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  const value = match.slice(COOKIE_NAME.length + 1);
  return value ? decodeURIComponent(value) : null;
}

export function persistSessionToken(token: string, expiresAt: number): void {
  if (typeof document === "undefined") return;
  const domain = resolveCookieDomain();
  const expires = new Date(expiresAt).toUTCString();
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const domainPart = domain ? `; Domain=${domain}` : "";
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Expires=${expires}; SameSite=Lax${domainPart}${secure}`;
}

export function clearSessionToken(): void {
  if (typeof document === "undefined") return;
  const domain = resolveCookieDomain();
  const domainPart = domain ? `; Domain=${domain}` : "";
  document.cookie = `${COOKIE_NAME}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${domainPart}`;
}
