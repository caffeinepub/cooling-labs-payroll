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

/** Fetch all companies from canister. Uses update call to auto-bootstrap if empty. */
export async function canisterGetCompanies(): Promise<Company[]> {
  // First try update call — this auto-bootstraps canister if companiesFull is empty
  try {
    const raw = (await backendService.getCompaniesUpdate()) as unknown[];
    const result = (raw as Record<string, unknown>[]).map(mapCanisterCompany);
    console.log(
      "[canisterCompanyService] getCompaniesUpdate succeeded, count:",
      result.length,
    );
    return result;
  } catch (e) {
    console.error("[canisterCompanyService] getCompaniesUpdate failed:", e);
  }
  // Fallback: query (won't bootstrap, but may return existing data)
  try {
    const raw2 = (await backendService.getCompanies()) as unknown[];
    const result2 = (raw2 as Record<string, unknown>[]).map(mapCanisterCompany);
    console.log(
      "[canisterCompanyService] getCompanies query result, count:",
      result2.length,
    );
    return result2;
  } catch (e2) {
    console.error(
      "[canisterCompanyService] getCompanies query also failed:",
      e2,
    );
    // Throw so callers can show an explicit error instead of silently showing 0
    throw new Error("Backend canister is unreachable. Please try again.");
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
 * TRUE MERGE: push any locally-created companies that don't yet exist in canister.
 * Skips COOLABS and DEMOCORP (bootstrapped by canister). Does NOT skip if canister has data.
 */
export async function migrateLocalCompaniesToCanister(
  localCompanies: Company[],
): Promise<void> {
  if (!localCompanies || localCompanies.length === 0) return;
  try {
    // Ensure canister is bootstrapped first
    await backendService.ensureCompaniesBootstrapped();
    const existing = await canisterGetCompanies();
    const existingCodes = new Set(
      existing.map((c) => c.companyCode.toUpperCase()),
    );

    let migrated = 0;
    for (const c of localCompanies) {
      const code = c.companyCode.toUpperCase();
      // Skip system defaults — already bootstrapped by canister
      if (code === "COOLABS" || code === "DEMOCORP") continue;
      // Only migrate companies that don't already exist in canister
      if (!existingCodes.has(code)) {
        await canisterCreateCompany(c);
        migrated++;
        console.log(
          `[canisterCompanyService] migrated company to canister: ${code}`,
        );
      }
    }
    if (migrated > 0) {
      console.log(
        `[canisterCompanyService] merged ${migrated} new companies to canister`,
      );
    }
  } catch (e) {
    console.error("[canisterCompanyService] migration failed", e);
  }
}
