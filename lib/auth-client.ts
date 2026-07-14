export type UserRole = "USER" | "ADMIN";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: UserRole;
}

interface SessionPayload {
  accessToken: string;
  user: AuthUser;
}

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
let accessToken: string | null = null;
let refreshPromise: Promise<SessionPayload | null> | null = null;
let restorePromise: Promise<SessionPayload | null> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export async function refreshSession(): Promise<SessionPayload | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = fetch(`${apiUrl}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  })
    .then(async (response) => {
      if (!response.ok) {
        accessToken = null;
        return null;
      }
      const session = (await response.json()) as SessionPayload;
      accessToken = session.accessToken;
      return session;
    })
    .catch(() => {
      accessToken = null;
      return null;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

export function restoreSessionOnce() {
  restorePromise ??= refreshSession();
  return restorePromise;
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
  retryAfterRefresh = true,
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (response.status !== 401 || !retryAfterRefresh) return response;

  const session = await refreshSession();
  if (!session) return response;
  return apiFetch(path, init, false);
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const response = await apiFetch("/auth/me");
  if (!response.ok) return null;
  const payload = (await response.json()) as { user: AuthUser };
  return payload.user;
}

export async function logoutSession() {
  await fetch(`${apiUrl}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  accessToken = null;
}

export const googleLoginUrl = `${apiUrl}/auth/google`;
