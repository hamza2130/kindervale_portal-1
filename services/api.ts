import axios, { type AxiosError, type AxiosInstance, type AxiosRequestConfig, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";

export interface ApiEnvelope<T> {
  data?: T;
  message?: string;
  success?: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type QueryValue = string | number | boolean | null | undefined;

export type ApiRequestConfig = AxiosRequestConfig & { query?: Record<string, QueryValue> };

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status = 0, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

const STORAGE_ACCESS_TOKEN = "kindervale-access-token";
const STORAGE_REFRESH_TOKEN = "kindervale-refresh-token";
const STORAGE_USER = "kindervale-user";

// NEXT_PUBLIC_API_URL lets a non-production run (local dev against a staging backend, or a
// non-production deployment) point at a different backend -- matches the name already used by
// the pre-existing (previously unwired) .env.production file. Set in .env.local for local dev,
// or per-environment in Vercel's dashboard for a hosted non-production deployment; Production
// needs no change, it keeps using the hardcoded fallback.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://kindervale-backend.onrender.com/api";

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json"
  }
});

let refreshPromise: Promise<void> | null = null;

function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_ACCESS_TOKEN);
}

function getStoredRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_REFRESH_TOKEN);
}

function setStoredTokens(accessToken: string, refreshToken: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_ACCESS_TOKEN, accessToken);
  window.localStorage.setItem(STORAGE_REFRESH_TOKEN, refreshToken);
}

function clearStoredAuth() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_ACCESS_TOKEN);
  window.localStorage.removeItem(STORAGE_REFRESH_TOKEN);
  window.localStorage.removeItem(STORAGE_USER);
}

function redirectToLogin() {
  if (typeof window !== "undefined") {
    if (window.location.pathname === "/login") return;
    window.location.assign("/login");
  }
}

function attachAuthHeader(config: AxiosRequestConfig): AxiosRequestConfig {
  const token = getStoredAccessToken();
  if (!token) return config;
  return {
    ...config,
    headers: {
      ...(config.headers ?? {}),
      Authorization: `Bearer ${token}`
    }
  };
}

function extractResponseData<T>(payload: ApiEnvelope<T> | T): T | undefined {
  if (payload && typeof payload === "object" && ("success" in payload || "message" in payload) && "data" in payload) {
    return (payload as ApiEnvelope<T>).data as T;
  }
  return payload as T;
}

async function refreshTokens(): Promise<void> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getStoredRefreshToken();
    if (!refreshToken) {
      throw new ApiError("Refresh token unavailable", 401);
    }

    try {
      const response = await apiClient.post<ApiEnvelope<{ accessToken: string; refreshToken?: string }>>(
        "/auth/refresh",
        { refreshToken },
        { headers: { "Content-Type": "application/json" } }
      );

      const data = extractResponseData(response.data);
      if (!data?.accessToken) {
        throw new ApiError("Unable to refresh authentication", 401, response.data);
      }

      setStoredTokens(data.accessToken, data.refreshToken ?? refreshToken);
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

apiClient.interceptors.request.use((config) => attachAuthHeader(config as AxiosRequestConfig) as InternalAxiosRequestConfig);

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || !error.config || !error.response) {
      return Promise.reject(error);
    }

    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
    const requestUrl = String(originalRequest.url ?? "");
    const canRefresh = !requestUrl.includes("/auth/login") && !requestUrl.includes("/auth/logout") && !requestUrl.includes("/auth/refresh");
    if (error.response.status === 401 && canRefresh && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        await refreshTokens();
        return apiClient({
          ...originalRequest,
          headers: {
            ...(originalRequest.headers ?? {}),
            Authorization: `Bearer ${getStoredAccessToken()}`
          }
        });
      } catch (refreshError) {
        clearStoredAuth();
        redirectToLogin();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

function createUrl(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error) && error.response) {
    const payload = error.response.data as ApiEnvelope<unknown> | Record<string, unknown>;
    if (payload && typeof payload === "object" && "message" in payload) {
      return String((payload as any).message);
    }
    return error.response.statusText || "Request failed";
  }

  if (error instanceof Error) return error.message;
  return "Request failed";
}

export async function apiRequest<T>(path: string, config: ApiRequestConfig = {}) {
  const { query, headers, ...axiosConfig } = config;
  const url = createUrl(path);
  const data = axiosConfig.data ?? (axiosConfig as any).body;
  const isFormData = typeof FormData !== "undefined" && data instanceof FormData;

  const requestHeaders = { ...(headers ?? {}) } as Record<string, unknown>;
  if (isFormData) {
    delete requestHeaders["Content-Type"];
    requestHeaders["Content-Type"] = undefined;
  }

  const normalizedConfig = {
    ...axiosConfig,
    params: query,
    headers: Object.keys(requestHeaders).length ? requestHeaders : undefined,
    data
  } as AxiosRequestConfig;

  if ((axiosConfig as any).body !== undefined) {
    delete (normalizedConfig as any).body;
  }

  try {
    const response = await apiClient.request<ApiEnvelope<T> | T>({
      url,
      ...normalizedConfig
    });

    const parsed = extractResponseData<T>(response.data);
    if (parsed !== undefined) return parsed;
    return response.data as T;
  } catch (error) {
    const message = getErrorMessage(error);
    const status = axios.isAxiosError(error) && error.response ? error.response.status : 0;
    const body = axios.isAxiosError(error) ? error.response?.data : undefined;
    throw new ApiError(message, status, body);
  }
}

export function normalizeList<T>(value: T[] | PaginatedResponse<T> | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : value.items ?? [];
}
