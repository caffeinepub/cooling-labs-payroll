/**
 * canisterAuthService.ts
 * Centralised authentication via ICP canister.
 * Sessions (tokens) are stored in the canister; the token is cached in
 * sessionStorage (tab-scoped) and localStorage (cross-tab persistence).
 * Falls back to localStorage-based tenantStorage on canister errors.
 */

import { getActor } from "./backendService";
import {
  getCompanyByCode,
  clearCompanySession as localClearCompanySession,
  clearSuperAdminSession as localClearSuperAdminSession,
  getCompanySession as localGetCompanySession,
  getSuperAdminSession as localGetSuperAdminSession,
  loginCompany as localLoginCompany,
  loginSuperAdmin as localLoginSuperAdmin,
} from "./tenantStorage";

const COMPANY_TOKEN_KEY = "hkai_canister_company_token";
const SUPERADMIN_TOKEN_KEY = "hkai_canister_superadmin_token";
const COMPANY_SESSION_CACHE_KEY = "hkai_canister_company_session";
const SUPERADMIN_SESSION_CACHE_KEY = "hkai_canister_superadmin_session";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function unwrapOptional<T>(val: [] | [T]): T | null {
  if (val.length > 0) {
    const v = val[0];
    return v !== undefined ? v : null;
  }
  return null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CanisterCompanySession {
  token: string;
  companyId: string;
  companyCode: string;
  companyName: string;
  username: string;
  role: string;
  siteId: string;
}

export interface CanisterSuperAdminSession {
  token: string;
  username: string;
}

export interface CompanyLoginResult {
  success: boolean;
  session: CanisterCompanySession | null;
  errorMsg: string;
  source: "canister" | "local";
}

export interface SuperAdminLoginResult {
  success: boolean;
  session: CanisterSuperAdminSession | null;
  errorMsg: string;
  source: "canister" | "local";
}

// ─── Company Login ────────────────────────────────────────────────────────────

export async function loginCompanyCanister(
  companyCode: string,
  username: string,
  password: string,
): Promise<CompanyLoginResult> {
  // Try canister first
  try {
    const actor = await getActor();
    const result = (await actor.loginCompany(
      companyCode.toUpperCase(),
      username,
      password,
    )) as {
      success: boolean;
      token: string;
      companyCode: string;
      companyName: string;
      role: string;
      errorMsg: string;
    };

    if (result.success && result.token) {
      const session: CanisterCompanySession = {
        token: result.token,
        companyId: result.companyCode,
        companyCode: result.companyCode,
        companyName: result.companyName,
        username,
        role: result.role,
        siteId: "",
      };
      // Cache token and session
      localStorage.setItem(COMPANY_TOKEN_KEY, result.token);
      localStorage.setItem(COMPANY_SESSION_CACHE_KEY, JSON.stringify(session));
      // Also keep tenantStorage in sync so legacy modules still work
      localLoginCompany(companyCode, username, password);
      console.log("[CanisterAuth] Company login via canister:", companyCode);
      return { success: true, session, errorMsg: "", source: "canister" };
    }
    return {
      success: false,
      session: null,
      errorMsg: result.errorMsg || "Login failed",
      source: "canister",
    };
  } catch (err) {
    console.warn(
      "[CanisterAuth] Canister login failed, falling back to local:",
      err,
    );
    // Fallback: use localStorage-based tenantStorage
    const localSession = localLoginCompany(companyCode, username, password);
    if (localSession) {
      const session: CanisterCompanySession = {
        token: `local-${Date.now()}`,
        companyId: localSession.companyId,
        companyCode: localSession.companyCode,
        companyName: localSession.companyName,
        username: localSession.username,
        role: localSession.role,
        siteId: localSession.siteId || "",
      };
      localStorage.setItem(COMPANY_TOKEN_KEY, session.token);
      localStorage.setItem(COMPANY_SESSION_CACHE_KEY, JSON.stringify(session));
      return { success: true, session, errorMsg: "", source: "local" };
    }
    // Check why local failed — suspended?
    const company = getCompanyByCode(companyCode);
    if (company && company.status !== "active") {
      return {
        success: false,
        session: null,
        errorMsg: `Company is ${company.status}. Please contact HumanskeyAI support.`,
        source: "local",
      };
    }
    return {
      success: false,
      session: null,
      errorMsg: "Invalid company code, username, or password",
      source: "local",
    };
  }
}

// ─── Validate Company Session ─────────────────────────────────────────────────

export async function validateCompanySession(): Promise<CanisterCompanySession | null> {
  const token = localStorage.getItem(COMPANY_TOKEN_KEY);
  if (!token) return null;

  // Local token — skip canister validation, use cached session
  if (token.startsWith("local-")) {
    const cached = localStorage.getItem(COMPANY_SESSION_CACHE_KEY);
    if (!cached) return null;
    // Also validate via tenantStorage
    const localSession = localGetCompanySession();
    if (!localSession) return null;
    try {
      return JSON.parse(cached) as CanisterCompanySession;
    } catch {
      return null;
    }
  }

  // Canister token
  try {
    const actor = await getActor();
    const result = (await actor.validateCompanySession(token)) as
      | []
      | [
          {
            token: string;
            companyId: string;
            companyCode: string;
            companyName: string;
            username: string;
            role: string;
            siteId: string;
          },
        ];
    const sessionData = unwrapOptional(result);
    if (!sessionData) {
      // Token expired — clear everything
      clearCompanySession();
      return null;
    }
    const session: CanisterCompanySession = {
      token: sessionData.token,
      companyId: sessionData.companyId,
      companyCode: sessionData.companyCode,
      companyName: sessionData.companyName,
      username: sessionData.username,
      role: sessionData.role,
      siteId: sessionData.siteId,
    };
    // Refresh cache
    localStorage.setItem(COMPANY_SESSION_CACHE_KEY, JSON.stringify(session));
    return session;
  } catch {
    // Canister unreachable — use cached session
    const cached = localStorage.getItem(COMPANY_SESSION_CACHE_KEY);
    if (cached) {
      try {
        return JSON.parse(cached) as CanisterCompanySession;
      } catch {}
    }
    return null;
  }
}

// Get cached session (sync, no canister call)
export function getCompanySessionCached(): CanisterCompanySession | null {
  const token = localStorage.getItem(COMPANY_TOKEN_KEY);
  if (!token) return null;
  const cached = localStorage.getItem(COMPANY_SESSION_CACHE_KEY);
  if (!cached) return null;
  try {
    return JSON.parse(cached) as CanisterCompanySession;
  } catch {
    return null;
  }
}

// ─── Logout Company ───────────────────────────────────────────────────────────

export async function logoutCompany(): Promise<void> {
  const token = localStorage.getItem(COMPANY_TOKEN_KEY);
  if (token && !token.startsWith("local-")) {
    try {
      const actor = await getActor();
      await actor.logoutCompanySession(token);
    } catch {}
  }
  clearCompanySession();
}

export function clearCompanySession(): void {
  localStorage.removeItem(COMPANY_TOKEN_KEY);
  localStorage.removeItem(COMPANY_SESSION_CACHE_KEY);
  localClearCompanySession();
}

// ─── Super Admin Login ────────────────────────────────────────────────────────

export async function loginSuperAdminCanister(
  username: string,
  password: string,
): Promise<SuperAdminLoginResult> {
  try {
    const actor = await getActor();
    const result = (await actor.loginSuperAdmin(username, password)) as {
      success: boolean;
      token: string;
      errorMsg: string;
    };
    if (result.success && result.token) {
      const session: CanisterSuperAdminSession = {
        token: result.token,
        username,
      };
      localStorage.setItem(SUPERADMIN_TOKEN_KEY, result.token);
      localStorage.setItem(
        SUPERADMIN_SESSION_CACHE_KEY,
        JSON.stringify(session),
      );
      localLoginSuperAdmin(username, password); // keep legacy in sync
      console.log("[CanisterAuth] Super Admin login via canister");
      return { success: true, session, errorMsg: "", source: "canister" };
    }
    return {
      success: false,
      session: null,
      errorMsg: result.errorMsg || "Login failed",
      source: "canister",
    };
  } catch (err) {
    console.warn(
      "[CanisterAuth] Canister super admin login failed, falling back to local:",
      err,
    );
    const ok = localLoginSuperAdmin(username, password);
    if (ok) {
      const session: CanisterSuperAdminSession = {
        token: `local-sa-${Date.now()}`,
        username,
      };
      localStorage.setItem(SUPERADMIN_TOKEN_KEY, session.token);
      localStorage.setItem(
        SUPERADMIN_SESSION_CACHE_KEY,
        JSON.stringify(session),
      );
      return { success: true, session, errorMsg: "", source: "local" };
    }
    return {
      success: false,
      session: null,
      errorMsg: "Invalid Super Admin credentials",
      source: "local",
    };
  }
}

// ─── Validate Super Admin Session ────────────────────────────────────────────

export async function validateSuperAdminSession(): Promise<CanisterSuperAdminSession | null> {
  const token = localStorage.getItem(SUPERADMIN_TOKEN_KEY);
  if (!token) return null;

  if (token.startsWith("local-sa-")) {
    const localSession = localGetSuperAdminSession();
    if (!localSession) return null;
    const cached = localStorage.getItem(SUPERADMIN_SESSION_CACHE_KEY);
    if (!cached) return null;
    try {
      return JSON.parse(cached) as CanisterSuperAdminSession;
    } catch {
      return null;
    }
  }

  try {
    const actor = await getActor();
    const result = (await actor.validateSuperAdminSession(token)) as
      | []
      | [{ token: string; username: string }];
    const sessionData = unwrapOptional(result);
    if (!sessionData) {
      clearSuperAdminSession();
      return null;
    }
    const session: CanisterSuperAdminSession = {
      token: sessionData.token,
      username: sessionData.username,
    };
    localStorage.setItem(SUPERADMIN_SESSION_CACHE_KEY, JSON.stringify(session));
    return session;
  } catch {
    const cached = localStorage.getItem(SUPERADMIN_SESSION_CACHE_KEY);
    if (cached) {
      try {
        return JSON.parse(cached) as CanisterSuperAdminSession;
      } catch {}
    }
    return null;
  }
}

export function getSuperAdminSessionCached(): CanisterSuperAdminSession | null {
  const token = localStorage.getItem(SUPERADMIN_TOKEN_KEY);
  if (!token) return null;
  const cached = localStorage.getItem(SUPERADMIN_SESSION_CACHE_KEY);
  if (!cached) return null;
  try {
    return JSON.parse(cached) as CanisterSuperAdminSession;
  } catch {
    return null;
  }
}

// ─── Logout Super Admin ───────────────────────────────────────────────────────

export async function logoutSuperAdmin(): Promise<void> {
  const token = localStorage.getItem(SUPERADMIN_TOKEN_KEY);
  if (token && !token.startsWith("local-sa-")) {
    try {
      const actor = await getActor();
      await actor.logoutSuperAdminSession(token);
    } catch {}
  }
  clearSuperAdminSession();
}

export function clearSuperAdminSession(): void {
  localStorage.removeItem(SUPERADMIN_TOKEN_KEY);
  localStorage.removeItem(SUPERADMIN_SESSION_CACHE_KEY);
  localClearSuperAdminSession();
}

// ─── Active company code (for tenant-scoped storage) ─────────────────────────

export function getActiveCompanyCodeFromCanisterSession(): string {
  const session = getCompanySessionCached();
  return session?.companyCode || "COOLABS";
}
