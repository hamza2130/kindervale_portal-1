import { apiRequest } from "@/services/api";
import type { Role, User } from "@/types";

export interface LoginPayload {
  username: string;
  password: string;
  role?: Role;
  otp?: string;
}

interface LoginResponseData {
  data?: LoginResponseData;
  id: string;
  name: string;
  email?: string;
  role: Role;
  accessToken: string;
  refreshToken: string;
  username?: string;
  avatar?: string;
  linkedStudentIds?: string[];
  homeroom?: string;
  designation?: string;
  user?: Partial<LoginResponseData>;
}

function normalizeRole(role?: Role): string {
  if (role === "daycareadmin" || role === "daycare_admin") return "daycare_admin";
  return role || "admin";
}

function normalizeBackendRole(role: unknown): Role {
  if (typeof role !== "string") {
    throw new Error("Login response did not include a user role.");
  }

  const normalized = role.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (normalized === "daycareadmin") return "daycareadmin";
  if (normalized === "administrator" || normalized === "admin") return "admin";
  if (normalized === "principal") return "principal";
  if (normalized === "teacher") return "teacher";
  if (normalized === "parent") return "parent";
  if (normalized === "accountant") return "accountant";

  throw new Error(`Login response included an unsupported role: ${role}`);
}

function unwrapLoginResponse(data: Partial<LoginResponseData> | undefined): Partial<LoginResponseData> {
  return data?.data && typeof data.data === "object" ? data.data : (data ?? {});
}

function buildUserFromResponse(responseData: Partial<LoginResponseData> | undefined, payload: LoginPayload): User {
  const data = unwrapLoginResponse(responseData);
  if (!Object.keys(data).length) {
    throw new Error("Login response did not include authentication data.");
  }

  const nestedUser = data.user as Partial<LoginResponseData> | undefined;
  const source = nestedUser ? nestedUser : data;
  const accessToken = data.accessToken ?? source.accessToken;
  const refreshToken = data.refreshToken ?? source.refreshToken;

  if (!accessToken || !refreshToken) {
    throw new Error("Login response did not include authentication tokens.");
  }

  return {
    id: String(source.id ?? payload.username),
    name: String(source.name ?? payload.username),
    username: String(source.username ?? payload.username),
    email: String(source.email ?? ""),
    role: normalizeBackendRole(source.role ?? payload.role),
    avatar: source.avatar,
    accessToken: String(accessToken),
    refreshToken: String(refreshToken),
    linkedStudentIds: source.linkedStudentIds,
    homeroom: source.homeroom,
    designation: source.designation
  };
}

export async function login(payload: LoginPayload): Promise<User> {
  const requestBody = {
    username: payload.username.trim().toLowerCase(),
    password: payload.password,
    role: normalizeRole(payload.role) as string,
    ...(payload.otp ? { otp: payload.otp } : {})
  };

  const responseData = await apiRequest<LoginResponseData>("/auth/login", {
    method: "POST",
    data: requestBody
  });

  const user = buildUserFromResponse(responseData, payload);

  if (typeof window !== "undefined") {
    window.localStorage.setItem("kindervale-access-token", user.accessToken ?? "");
    window.localStorage.setItem("kindervale-refresh-token", user.refreshToken ?? "");
  }

  return user;
}

export async function logout(): Promise<void> {
  if (typeof window === "undefined") return;

  const refreshToken = window.localStorage.getItem("kindervale-refresh-token");
  try {
    await apiRequest("/auth/logout", {
      method: "POST",
      data: { refreshToken }
    });
  } catch {
    // ignore logout errors; still clear local state
  }

  window.localStorage.removeItem("kindervale-user");
  window.localStorage.removeItem("kindervale-access-token");
  window.localStorage.removeItem("kindervale-refresh-token");
}

export async function getProfile(): Promise<User> {
  const responseData = await apiRequest<Partial<User>>("/auth/profile");
  return {
    id: String(responseData.id ?? ""),
    name: String(responseData.name ?? ""),
    email: String(responseData.email ?? ""),
    role: normalizeBackendRole(responseData.role ?? "parent"),
    username: responseData.username,
    avatar: responseData.avatar,
    linkedStudentIds: responseData.linkedStudentIds,
    homeroom: responseData.homeroom,
    designation: responseData.designation,
    accessToken: window.localStorage.getItem("kindervale-access-token") ?? undefined,
    refreshToken: window.localStorage.getItem("kindervale-refresh-token") ?? undefined
  };
}
