const COOKIE_NAME = "bug-jar-session";

function resolveCookieDomain(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const host = window.location.hostname;
  const parts = host.split(".");
  if (parts.length < 2) return undefined;
  const root = parts.slice(-2).join(".");
  return `.${root}`;
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
