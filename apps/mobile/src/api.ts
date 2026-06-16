import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "./session";
import type {
  AuthResponse,
  AuthTokens,
  BetaLevel,
  BetaResponse,
  Hold,
  PublicUser,
  RouteDetail,
  RouteSummary,
} from "./types";

// Adres backendu. Na fizycznym telefonie zmień na adres LAN komputera,
// np. EXPO_PUBLIC_API_URL=http://192.168.1.10:4000
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Buduje pełny adres zdjęcia na podstawie aktualnego serwera (API_URL).
 * Obsługuje zarówno ścieżki względne (`/uploads/...`), jak i stare, zapisane
 * adresy bezwzględne (np. z `localhost`), które przepisuje na bieżący host.
 */
export function imageSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  const idx = url.indexOf("/uploads/");
  if (idx >= 0) return API_URL + url.slice(idx);
  if (url.startsWith("/")) return API_URL + url;
  return url;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * `fetch` z limitem czasu — bez tego nieosiągalny serwer (np. zły adres LAN)
 * powoduje, że żądanie wisi w nieskończoność, a w UI kręci się spinner.
 */
async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs = 12000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new ApiError(
        0,
        `Brak połączenia z serwerem (${API_URL}). Sprawdź, czy backend działa i czy adres LAN jest aktualny.`,
      );
    }
    throw new ApiError(0, `Nie można połączyć z serwerem (${API_URL}).`);
  } finally {
    clearTimeout(timer);
  }
}

async function parseError(res: Response): Promise<never> {
  let message = `Błąd serwera (${res.status})`;
  try {
    const body = await res.json();
    if (body?.error) message = body.error;
    else if (Array.isArray(body?.issues) && body.issues[0]) message = body.issues[0].message;
  } catch {
    // brak ciała JSON
  }
  throw new ApiError(res.status, message);
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  const res = await fetchWithTimeout(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    await clearTokens();
    return false;
  }
  const data = (await res.json()) as AuthResponse;
  await setTokens(data.tokens);
  return true;
}

/** Upload pliku obrazu (multipart) na podany endpoint. */
async function uploadFile<T>(path: string, uri: string): Promise<T> {
  const form = new FormData();
  const ext = uri.split(".").pop()?.toLowerCase() ?? "jpg";
  const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  // React Native FormData przyjmuje obiekt { uri, name, type }
  form.append("file", { uri, name: `upload.${ext}`, type: mime } as unknown as Blob);

  const token = getAccessToken();
  const res = await fetchWithTimeout(
    `${API_URL}${path}`,
    {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    },
    30000, // upload zdjęcia może trwać dłużej
  );
  if (!res.ok) await parseError(res);
  return (await res.json()) as T;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

async function request<T>(path: string, opts: RequestOptions = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.auth !== false) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetchWithTimeout(`${API_URL}${path}`, {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 401 && retry && opts.auth !== false) {
    if (await tryRefresh()) return request<T>(path, opts, false);
  }
  if (!res.ok) await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---------- Auth ----------

export const api = {
  register(input: { username: string; password: string; heightCm: number }) {
    return request<AuthResponse>("/auth/register", { body: input, auth: false });
  },
  login(input: { username: string; password: string }) {
    return request<AuthResponse>("/auth/login", { body: input, auth: false });
  },
  me() {
    return request<PublicUser>("/me");
  },
  updateProfile(heightCm: number) {
    return request<PublicUser>("/me", { method: "PATCH", body: { heightCm } });
  },
  uploadAvatar(uri: string) {
    return uploadFile<PublicUser>("/me/avatar", uri);
  },

  // ---------- Trasy ----------
  listRoutes() {
    return request<RouteSummary[]>("/routes");
  },
  getRoute(id: string) {
    return request<RouteDetail>(`/routes/${id}`);
  },
  createRoute(input: {
    name: string;
    imgW: number;
    imgH: number;
    routeHeightM: number;
    holds: Omit<Hold, "id">[];
  }) {
    return request<RouteDetail>("/routes", { body: input });
  },
  updateRoute(
    id: string,
    input: Partial<{
      name: string;
      routeHeightM: number;
      imgW: number;
      imgH: number;
      holds: Omit<Hold, "id">[];
    }>,
  ) {
    return request<RouteDetail>(`/routes/${id}`, { method: "PATCH", body: input });
  },
  deleteRoute(id: string) {
    return request<void>(`/routes/${id}`, { method: "DELETE" });
  },
  getBeta(routeId: string, opts: { heightCm?: number; levels?: BetaLevel[] } = {}) {
    return request<BetaResponse>(`/routes/${routeId}/beta`, { body: opts });
  },

  // ---------- Upload zdjęcia trasy (multipart) ----------
  uploadImage(routeId: string, uri: string) {
    return uploadFile<RouteDetail>(`/routes/${routeId}/image`, uri);
  },
};

export type { AuthTokens };
