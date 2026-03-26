/**
 * canisterAttendanceService.ts
 *
 * Tenant-aware attendance backed by ICP canister.
 * Strategy:
 *   - Writes: dual-write to canister (primary) + localStorage (local cache)
 *   - Reads:  always served from localStorage (fast, sync)
 *   - Sync:   syncAttendanceFromCanister() fetches all company attendance from canister
 *             and seeds localStorage — called on every login / page load
 *
 * This ensures data persists across devices, browsers, and logins.
 */

import type { AttendanceRecord } from "../types";
import * as attendanceStorage from "./attendanceStorage";
import { backendService } from "./backendService";
import { getActiveCompanyId } from "./tenantStorage";

type TenantAttRaw = Record<string, unknown>;

function mapFromCanister(raw: TenantAttRaw): AttendanceRecord {
  return {
    id: String(raw.id ?? ""),
    employeeId: String(raw.employeeId ?? ""),
    date: String(raw.date ?? ""),
    status: String(raw.status ?? ""),
    otHours: Number(raw.otHours ?? 0),
    advanceAmount: Number(raw.advanceAmount ?? 0),
    source: String(raw.changedBy ?? "admin"),
    punchIn: String(raw.punchIn ?? ""),
    punchOut: String(raw.punchOut ?? ""),
    lat: Number(raw.lat ?? 0),
    lng: Number(raw.lng ?? 0),
    isFlagged: Boolean(raw.isFlagged),
    flagReason: String(raw.flagReason ?? ""),
    isRegularized: Boolean(raw.isRegularized),
    regularizationReason: String(raw.regularizationReason ?? ""),
    changedBy: String(raw.changedBy ?? ""),
    updatedAt: BigInt(
      typeof raw.updatedAt === "bigint"
        ? raw.updatedAt
        : ((raw.updatedAt as number) ?? 0),
    ),
    createdAt: BigInt(
      typeof raw.createdAt === "bigint"
        ? raw.createdAt
        : ((raw.createdAt as number) ?? 0),
    ),
  };
}

// Key used to track if migration has run for this company
function migrationKey(companyCode: string): string {
  return `hkai_att_migrated_${companyCode}`;
}

/**
 * Fetch all attendance for the active company from canister,
 * write them into localStorage so sync reads work correctly.
 * Also migrates any pre-existing localStorage data to canister.
 */
export async function syncAttendanceFromCanister(): Promise<{
  count: number;
  source: "canister" | "local";
}> {
  const companyCode = getActiveCompanyId();
  try {
    const raw = (await backendService.getAllAttendanceByCompany(
      companyCode,
    )) as TenantAttRaw[];

    // If canister has data, seed it into localStorage and we're done
    if (raw.length > 0) {
      const records = raw.map(mapFromCanister);
      seedLocalStorage(companyCode, records);
      console.log(
        `[CanisterAtt] Synced ${records.length} records from canister for ${companyCode}`,
      );
      return { count: records.length, source: "canister" };
    }

    // Canister is empty — check if we have localStorage data to migrate
    const migratedFlag = localStorage.getItem(migrationKey(companyCode));
    if (!migratedFlag) {
      // One-time migration: push localStorage attendance to canister
      const localRecords = attendanceStorage.getAllAttendanceRaw(companyCode);
      if (localRecords.length > 0) {
        console.log(
          `[CanisterAtt] Migrating ${localRecords.length} records from localStorage to canister for ${companyCode}...`,
        );
        for (const rec of localRecords) {
          try {
            await backendService.markAttendanceForCompany(
              companyCode,
              rec.employeeId,
              rec.date,
              rec.status,
              rec.otHours,
              rec.advanceAmount ?? 0,
              rec.punchIn ?? "",
              rec.punchOut ?? "",
              rec.lat ?? 0,
              rec.lng ?? 0,
              rec.changedBy ?? "admin",
            );
          } catch (e) {
            console.warn(
              `[CanisterAtt] Migration failed for ${rec.employeeId}/${rec.date}`,
              e,
            );
          }
        }
        localStorage.setItem(migrationKey(companyCode), "1");
        // Re-fetch after migration
        const afterRaw = (await backendService.getAllAttendanceByCompany(
          companyCode,
        )) as TenantAttRaw[];
        if (afterRaw.length > 0) {
          const afterRecords = afterRaw.map(mapFromCanister);
          seedLocalStorage(companyCode, afterRecords);
          console.log(
            `[CanisterAtt] Post-migration: ${afterRecords.length} records in canister`,
          );
          return { count: afterRecords.length, source: "canister" };
        }
      } else {
        // No local data and no canister data — mark migration done
        localStorage.setItem(migrationKey(companyCode), "1");
      }
    }

    return { count: 0, source: "canister" };
  } catch (err) {
    console.warn(
      "[CanisterAtt] Canister sync failed, using localStorage:",
      err,
    );
    return { count: 0, source: "local" };
  }
}

/**
 * Overwrite the company's attendance in localStorage with records from canister.
 * This is safe because canister is source of truth.
 */
function seedLocalStorage(
  companyCode: string,
  records: AttendanceRecord[],
): void {
  // attendanceStorage uses getTenantKey internally; we write raw records directly
  const key = `clf_${companyCode}_clf_attendance`;
  const rawRecords = records.map((r) => ({
    ...r,
    updatedAt: Number(r.updatedAt),
    createdAt: Number(r.createdAt),
  }));
  try {
    localStorage.setItem(key, JSON.stringify(rawRecords));
    window.dispatchEvent(new CustomEvent("clf:attendance-updated"));
  } catch (e) {
    console.warn("[CanisterAtt] Failed to seed localStorage:", e);
  }
}

// ── Write operations (dual-write) ────────────────────────────────────────

export async function markAttendanceInCanister(
  empId: string,
  dateStr: string,
  status: string,
  otHours: number,
  punchIn: string,
  punchOut: string,
  lat: number,
  lng: number,
  source: string,
  advanceAmount = 0,
): Promise<void> {
  const companyCode = getActiveCompanyId();
  try {
    await backendService.markAttendanceForCompany(
      companyCode,
      empId,
      dateStr,
      status,
      otHours,
      advanceAmount,
      punchIn,
      punchOut,
      lat,
      lng,
      source,
    );
  } catch (e) {
    console.warn("[CanisterAtt] markAttendance canister write failed:", e);
  }
}

export async function markAttendanceOverwriteInCanister(
  empId: string,
  dateStr: string,
  status: string,
  otHours: number,
  punchIn: string,
  punchOut: string,
  lat: number,
  lng: number,
  source: string,
  advanceAmount = 0,
): Promise<void> {
  const companyCode = getActiveCompanyId();
  try {
    await backendService.markAttendanceOverwriteForCompany(
      companyCode,
      empId,
      dateStr,
      status,
      otHours,
      advanceAmount,
      punchIn,
      punchOut,
      lat,
      lng,
      source,
    );
  } catch (e) {
    console.warn(
      "[CanisterAtt] markAttendanceOverwrite canister write failed:",
      e,
    );
  }
}

export async function deleteAttendanceInCanister(
  empId: string,
  dateStr: string,
): Promise<void> {
  const companyCode = getActiveCompanyId();
  try {
    await backendService.deleteAttendanceForCompany(
      companyCode,
      empId,
      dateStr,
    );
  } catch (e) {
    console.warn("[CanisterAtt] deleteAttendance canister write failed:", e);
  }
}

export async function bulkMarkAttendanceInCanister(
  entries: [string, string, string, number][],
  source: string,
): Promise<void> {
  const companyCode = getActiveCompanyId();
  try {
    await backendService.bulkMarkAttendanceForCompany(
      companyCode,
      entries,
      source,
    );
  } catch (e) {
    console.warn("[CanisterAtt] bulkMarkAttendance canister write failed:", e);
  }
}

export async function bulkMarkAttendanceOverwriteInCanister(
  entries: [string, string, string, number][],
  source: string,
): Promise<void> {
  const companyCode = getActiveCompanyId();
  try {
    await backendService.bulkMarkAttendanceOverwriteForCompany(
      companyCode,
      entries,
      source,
    );
  } catch (e) {
    console.warn(
      "[CanisterAtt] bulkMarkAttendanceOverwrite canister write failed:",
      e,
    );
  }
}

export async function updateAttendanceOTInCanister(
  empId: string,
  dateStr: string,
  otHours: number,
  source: string,
): Promise<void> {
  const companyCode = getActiveCompanyId();
  try {
    await backendService.updateAttendanceOTForCompany(
      companyCode,
      empId,
      dateStr,
      otHours,
      source,
    );
  } catch (e) {
    console.warn("[CanisterAtt] updateOT canister write failed:", e);
  }
}

export async function updateAttendanceAdvanceInCanister(
  empId: string,
  dateStr: string,
  advanceAmount: number,
  source: string,
): Promise<void> {
  const companyCode = getActiveCompanyId();
  try {
    await backendService.updateAttendanceAdvanceForCompany(
      companyCode,
      empId,
      dateStr,
      advanceAmount,
      source,
    );
  } catch (e) {
    console.warn("[CanisterAtt] updateAdvance canister write failed:", e);
  }
}
