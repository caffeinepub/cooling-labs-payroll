// canisterCompanyService.ts
// Canister-backed company registry — ONLY source of truth for Super Admin company data

import { backendService } from "./backendService";
import type { Company } from "./tenantStorage";

// Map canister CompanyFull shape → frontend Company type
function mapCanisterCompany(c: Record<string, unknown>): Company {
  return {
    id: String(c.id ?? ""),
    companyCode: String(c.companyCode ?? ""),
    companyName: String(c.companyName ?? ""),
    legalName: String(c.legalName ?? ""),
    brandName: String(c.brandName ?? ""),
    logoDataUrl: String(c.logoDataUrl ?? ""),
    address: String(c.address ?? ""),
    state: String(c.state ?? ""),
    country: String(c.country ?? "India"),
    moduleAccess: Array.isArray(c.moduleAccess)
      ? (c.moduleAccess as string[])
      : [],
    status: ["active", "suspended", "inactive"].includes(String(c.status))
      ? (String(c.status) as "active" | "suspended" | "inactive")
      : "active",
    adminUsername: String(c.adminUsername ?? "admin"),
    adminPassword: String(c.adminPasswordHash ?? c.adminPassword ?? ""),
    createdAt:
      typeof c.createdAt === "bigint"
        ? Number(c.createdAt)
        : Number(c.createdAt ?? Date.now()),
    updatedAt:
      typeof c.updatedAt === "bigint"
        ? Number(c.updatedAt)
        : Number(c.updatedAt ?? Date.now()),
    notes: String(c.notes ?? ""),
    planStatus: ["trial", "active", "inactive"].includes(String(c.planStatus))
      ? (String(c.planStatus) as "trial" | "active" | "inactive")
      : "trial",
  };
}

/** Fetch all companies from canister. Returns [] on error. */
export async function canisterGetCompanies(): Promise<Company[]> {
  try {
    const raw = (await backendService.getCompanies()) as unknown[];
    return (raw as Record<string, unknown>[]).map(mapCanisterCompany);
  } catch (e) {
    console.error("[canisterCompanyService] getCompanies failed", e);
    return [];
  }
}

/** Fetch single company by code from canister. */
export async function canisterGetCompanyByCode(
  code: string,
): Promise<Company | null> {
  try {
    const raw = (await backendService.getCompanyByCode(code)) as
      | [Record<string, unknown>]
      | [];
    if (!raw || raw.length === 0) return null;
    return mapCanisterCompany(raw[0]);
  } catch (e) {
    console.error("[canisterCompanyService] getCompanyByCode failed", e);
    return null;
  }
}

/**
 * Update company metadata in canister.
 * Motoko: updateCompany(id, companyName, legalName, brandName, address, state, country,
 *   adminUsername, planStatus, moduleAccess, logoDataUrl, notes)
 */
export async function canisterUpdateCompany(
  id: string,
  updates: Partial<Company>,
  current: Company,
): Promise<boolean> {
  try {
    const merged = { ...current, ...updates };
    const result = (await backendService.updateCompany(
      merged.id,
      merged.companyName,
      merged.legalName ?? "",
      merged.brandName ?? merged.companyName,
      merged.address ?? "",
      merged.state ?? "",
      merged.country ?? "India",
      merged.adminUsername,
      merged.planStatus,
      merged.moduleAccess ?? [],
      merged.logoDataUrl ?? "",
      merged.notes ?? "",
    )) as boolean;
    // If status also changed, update it separately
    if (updates.status && updates.status !== current.status) {
      await backendService.updateCompanyStatus(id, updates.status);
    }
    return result;
  } catch (e) {
    console.error("[canisterCompanyService] updateCompany failed", e);
    return false;
  }
}

/** Update company status in canister. */
export async function canisterUpdateCompanyStatus(
  id: string,
  status: "active" | "suspended" | "inactive",
): Promise<boolean> {
  try {
    return (await backendService.updateCompanyStatus(id, status)) as boolean;
  } catch (e) {
    console.error("[canisterCompanyService] updateCompanyStatus failed", e);
    return false;
  }
}

/** Reset company admin password in canister. */
export async function canisterResetCompanyPassword(
  companyId: string,
  newPassword: string,
): Promise<boolean> {
  try {
    return (await backendService.updateCompanyAdminPassword(
      companyId,
      newPassword,
    )) as boolean;
  } catch (e) {
    console.error("[canisterCompanyService] resetCompanyPassword failed", e);
    return false;
  }
}

/** Get tenant summary (employee count, attendance count, payroll count, etc.) */
export async function canisterGetTenantSummary(companyCode: string): Promise<{
  employeeCount: number;
  attendanceCount: number;
  payrollCount: number;
  status: string;
  plan: string;
  modules: string[];
  createdAt: number;
  updatedAt: number;
} | null> {
  try {
    const raw = (await backendService.getTenantSummary(companyCode)) as Record<
      string,
      unknown
    >;
    return {
      employeeCount: Number(raw.employeeCount ?? 0),
      attendanceCount: Number(raw.attendanceCount ?? 0),
      payrollCount: Number(raw.payrollCount ?? 0),
      status: String(raw.status ?? ""),
      plan: String(raw.plan ?? ""),
      modules: Array.isArray(raw.modules) ? (raw.modules as string[]) : [],
      createdAt: Number(raw.createdAt ?? 0),
      updatedAt: Number(raw.updatedAt ?? 0),
    };
  } catch (e) {
    console.error("[canisterCompanyService] getTenantSummary failed", e);
    return null;
  }
}

/** Get platform stats from canister (always fresh, not localStorage). */
export async function canisterGetPlatformStats(): Promise<{
  totalCompanies: number;
  activeCompanies: number;
  suspendedCompanies: number;
  inactiveCompanies: number;
  trialCompanies: number;
  paidCompanies: number;
  totalEmployees: number;
  totalUsers: number;
} | null> {
  try {
    const raw = (await backendService.getPlatformStats()) as Record<
      string,
      unknown
    >;
    return {
      totalCompanies: Number(raw.totalCompanies ?? 0),
      activeCompanies: Number(raw.activeCompanies ?? 0),
      suspendedCompanies: Number(raw.suspendedCompanies ?? 0),
      inactiveCompanies: Number(raw.inactiveCompanies ?? 0),
      trialCompanies: Number(raw.trialCompanies ?? 0),
      paidCompanies: Number(raw.paidCompanies ?? 0),
      totalEmployees: Number(raw.totalEmployees ?? 0),
      totalUsers: Number(raw.totalUsers ?? 0),
    };
  } catch (e) {
    console.error("[canisterCompanyService] getPlatformStats failed", e);
    return null;
  }
}

/**
 * Create company in canister.
 */
export async function canisterCreateCompany(
  c: Omit<Company, "id" | "createdAt" | "updatedAt">,
): Promise<boolean> {
  try {
    const result = (await backendService.createCompany(
      c.companyCode,
      c.companyName,
      c.legalName ?? "",
      c.brandName ?? c.companyName,
      c.address ?? "",
      c.state ?? "",
      c.country ?? "India",
      c.adminUsername,
      c.adminPassword,
      c.planStatus,
      c.moduleAccess ?? [],
      c.logoDataUrl ?? "",
    )) as { success: boolean; errorMsg: string };
    return result.success;
  } catch (e) {
    console.error("[canisterCompanyService] createCompany failed", e);
    return false;
  }
}

/**
 * Push local companies to canister if canister is empty (one-time migration).
 */
export async function migrateLocalCompaniesToCanister(
  localCompanies: Company[],
): Promise<void> {
  try {
    const existing = await canisterGetCompanies();
    if (existing.length > 0) return; // canister already has data
    for (const c of localCompanies) {
      await canisterCreateCompany(c);
    }
    console.log(
      "[canisterCompanyService] migrated",
      localCompanies.length,
      "companies to canister",
    );
  } catch (e) {
    console.error("[canisterCompanyService] migration failed", e);
  }
}
