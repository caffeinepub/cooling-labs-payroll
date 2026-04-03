/**
 * canisterPayrollService.ts
 *
 * Tenant-aware payroll backed by ICP canister.
 * Strategy:
 *   - Reads: canister (source of truth), seeded into localStorage as cache.
 *   - Writes: local engine first (immediate UI), then canister in background.
 *   - Migration: if canister is empty and localStorage has data, push all to canister.
 *
 * Uses getAllPayrollByCompany for efficient single-call sync.
 */

import type { TenantPayrollRecord } from "../backend.d";
import { getAttendanceByMonth } from "./attendanceStorage";
import { backendService } from "./backendService";
import { syncAttendanceFromCanister } from "./canisterAttendanceService";
import { loadEmployeesFromCanister } from "./canisterEmployeeService";
import {
  generatePayroll,
  getPayrollWithBreakdown,
  manualOverridePayroll,
  overwritePayroll,
  r2,
  setAdvanceDeduction,
  setOtherDeduction,
  setPayrollPT,
} from "./payrollStorage";
import { getActiveCompanyId, getTenantKey } from "./tenantStorage";
import { getEmployees } from "./workforceStorage";

/** The localStorage key used by payrollStorage for the active company */
function payrollLSKey(): string {
  return getTenantKey(getActiveCompanyId(), "clf_payroll");
}

/** Safe coerce — handles BigInt returned by ICP agent for Nat/Int fields */
function n(v: unknown): number {
  if (typeof v === "bigint") return Number(v);
  return Number(v ?? 0);
}

/** Convert a PayrollBreakdownExtended to TenantPayrollRecord for canister storage */
function toTenantRecord(
  bd: ReturnType<typeof getPayrollWithBreakdown>[0],
  companyCode: string,
): TenantPayrollRecord {
  const rec = bd.record;
  return {
    id: String(rec.id),
    companyCode,
    employeeId: String(rec.employeeId),
    month: Number(rec.month),
    year: Number(rec.year),
    earnedBasic: bd.earnedBasic,
    earnedHra: bd.earnedHra,
    earnedConveyance: bd.earnedConveyance,
    earnedSpecialAllowance: bd.earnedSpecialAllowance,
    earnedOtherAllowance: bd.earnedOtherAllowance,
    earnedGross: bd.earnedGross,
    otPay: bd.otPay,
    finalGross: bd.finalGross,
    pfDeduction: rec.pfDeduction,
    esiDeduction: rec.esiDeduction,
    ptDeduction: rec.ptDeduction,
    advanceDeduction: bd.advanceDeduction,
    otherDeduction: bd.otherDeduction,
    netPay: rec.netPay,
    paidDays: bd.paidDays,
    presentDays: bd.presentDays,
    halfDays: bd.halfDays,
    lopDays: bd.lopDays,
    totalDaysInMonth: Number(bd.totalDaysInMonth),
    otHours: bd.otHours,
    generatedAt: Number(rec.generatedAt),
  };
}

/**
 * Convert a TenantPayrollRecord from canister to localStorage-compatible raw format.
 * IMPORTANT: ICP agent returns Nat/Int as bigint — ALL numeric fields must go through n()
 * to avoid JSON.stringify throwing TypeError on bigint values.
 */
function toLocalStorageRecord(p: TenantPayrollRecord): object {
  return {
    id: String(p.id),
    employeeId: String(p.employeeId),
    month: n(p.month),
    year: n(p.year),
    basicSalary: n(p.earnedBasic),
    hra: n(p.earnedHra),
    conveyance: n(p.earnedConveyance),
    specialAllowance: n(p.earnedSpecialAllowance),
    otherAllowance: n(p.earnedOtherAllowance),
    otAmount: n(p.otPay),
    grossPay: n(p.finalGross),
    pfDeduction: n(p.pfDeduction),
    esiDeduction: n(p.esiDeduction),
    ptDeduction: n(p.ptDeduction),
    advanceDeduction: n(p.advanceDeduction),
    otherDeduction: n(p.otherDeduction),
    netPay: n(p.netPay),
    generatedAt: n(p.generatedAt),
    _presentDays: n(p.presentDays),
    _halfDays: n(p.halfDays),
    _lopDays: n(p.lopDays),
    _paidDays: n(p.paidDays),
    _otHours: n(p.otHours),
    _earnedBasic: n(p.earnedBasic),
    _earnedHra: n(p.earnedHra),
    _earnedConveyance: n(p.earnedConveyance),
    _earnedSpecialAllowance: n(p.earnedSpecialAllowance),
    _earnedOtherAllowance: n(p.earnedOtherAllowance),
    _earnedGross: n(p.earnedGross),
    _otPay: n(p.otPay),
    _finalGross: n(p.finalGross),
    _totalDaysInMonth: n(p.totalDaysInMonth),
  };
}

/**
 * Sync ALL payroll records for the active company from canister into localStorage.
 * Uses getAllPayrollByCompany for a single efficient call.
 * If canister is empty and localStorage has payroll data, migrates to canister.
 * Called on login / page load.
 */
export async function syncPayrollFromCanister(): Promise<{
  count: number;
  source: "canister" | "local";
}> {
  const companyCode = getActiveCompanyId();
  if (!companyCode) return { count: 0, source: "local" as const };
  try {
    // Single call to get ALL payroll for this company (no month-by-month loop)
    const allRecords = (await backendService.getAllPayrollByCompany(
      companyCode,
    )) as TenantPayrollRecord[];

    if (allRecords.length > 0) {
      seedLocalStorageAll(companyCode, allRecords);
      console.log(
        `[CanisterPayroll] Synced ${allRecords.length} records from canister for ${companyCode}`,
      );
      return { count: allRecords.length, source: "canister" };
    }

    // Canister is empty — attempt migration from localStorage
    const key = payrollLSKey();
    let localRecords: any[] = [];
    try {
      const raw = localStorage.getItem(key);
      if (raw) localRecords = JSON.parse(raw);
    } catch {}

    if (localRecords.length > 0) {
      console.log(
        `[CanisterPayroll] Migrating ${localRecords.length} payroll records from localStorage to canister for ${companyCode}...`,
      );
      // Convert localStorage records to TenantPayrollRecord format
      const tenantRecords: TenantPayrollRecord[] = localRecords.map(
        (r: any) => ({
          id: String(r.id ?? ""),
          companyCode,
          employeeId: String(r.employeeId ?? ""),
          month: Number(r.month ?? 0),
          year: Number(r.year ?? 0),
          earnedBasic: Number(r._earnedBasic ?? r.basicSalary ?? 0),
          earnedHra: Number(r._earnedHra ?? r.hra ?? 0),
          earnedConveyance: Number(r._earnedConveyance ?? r.conveyance ?? 0),
          earnedSpecialAllowance: Number(
            r._earnedSpecialAllowance ?? r.specialAllowance ?? 0,
          ),
          earnedOtherAllowance: Number(
            r._earnedOtherAllowance ?? r.otherAllowance ?? 0,
          ),
          earnedGross: Number(r._earnedGross ?? r.grossPay ?? 0),
          otPay: Number(r._otPay ?? r.otAmount ?? 0),
          finalGross: Number(r._finalGross ?? r.grossPay ?? 0),
          pfDeduction: Number(r.pfDeduction ?? 0),
          esiDeduction: Number(r.esiDeduction ?? 0),
          ptDeduction: Number(r.ptDeduction ?? 0),
          advanceDeduction: Number(r.advanceDeduction ?? 0),
          otherDeduction: Number(r.otherDeduction ?? 0),
          netPay: Number(r.netPay ?? 0),
          paidDays: Number(r._paidDays ?? 0),
          presentDays: Number(r._presentDays ?? 0),
          halfDays: Number(r._halfDays ?? 0),
          lopDays: Number(r._lopDays ?? 0),
          totalDaysInMonth: Number(r._totalDaysInMonth ?? 30),
          otHours: Number(r._otHours ?? 0),
          generatedAt: Number(r.generatedAt ?? 0),
        }),
      );

      try {
        await backendService.savePayrollForCompany(companyCode, tenantRecords);
        console.log(
          `[CanisterPayroll] Migrated ${tenantRecords.length} records to canister`,
        );
        return { count: tenantRecords.length, source: "canister" };
      } catch (e) {
        console.warn("[CanisterPayroll] Migration to canister failed:", e);
      }
    }

    return { count: 0, source: "canister" };
  } catch (err) {
    console.warn("[CanisterPayroll] Sync failed, using localStorage:", err);
    return { count: 0, source: "local" };
  }
}

/**
 * Overwrite localStorage payroll cache entirely with canister records.
 */
function seedLocalStorageAll(
  companyCode: string,
  records: TenantPayrollRecord[],
): void {
  const key = getTenantKey(companyCode, "clf_payroll");
  try {
    localStorage.setItem(
      key,
      JSON.stringify(records.map(toLocalStorageRecord)),
    );
    window.dispatchEvent(new CustomEvent("clf:payroll-updated"));
  } catch (e) {
    console.error("[CanisterPayroll] Failed to seed localStorage:", e);
  }
}

/**
 * Generate payroll for a month using local computation engine,
 * push to canister in background, return immediately from local state.
 * The UI should read from payrollStorage directly after this call.
 */
export async function generateAndSavePayroll(
  month: number,
  year: number,
): Promise<{ generatedCount: number }> {
  const companyCode = getActiveCompanyId();
  if (!companyCode) throw new Error("No authenticated company. Please log in.");

  // Pre-sync: ensure employees are loaded from canister
  const empData = getEmployees();
  if (empData.activeEmployees.length === 0) {
    console.log(
      "[CanisterPayroll] No local employees — syncing from canister...",
    );
    await loadEmployeesFromCanister();
  }
  const empDataAfter = getEmployees();
  if (empDataAfter.activeEmployees.length === 0) {
    throw new Error(
      "No employees found for this company. Please add employees first.",
    );
  }

  // Pre-sync: ensure attendance is loaded from canister
  const attRecords = getAttendanceByMonth(String(month), String(year));
  if (attRecords.length === 0) {
    console.log(
      "[CanisterPayroll] No local attendance — syncing from canister...",
    );
    await syncAttendanceFromCanister();
  }
  const attAfter = getAttendanceByMonth(String(month), String(year));
  if (attAfter.length === 0) {
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    throw new Error(
      `No attendance found for ${monthNames[month - 1]} ${year}. Please enter attendance before generating payroll.`,
    );
  }

  // Run local payroll engine — saves to localStorage immediately
  const result = generatePayroll(BigInt(month), BigInt(year), "admin");
  const count = Number(result.generatedCount);
  if (count === 0) {
    // Check if records already exist (all employees skipped due to existingIds)
    const existing = getPayrollWithBreakdown(BigInt(month), BigInt(year));
    if (existing.length > 0) {
      throw new Error(
        `Payroll already exists for all ${existing.length} employees this month. Use Re-generate to overwrite.`,
      );
    }
    throw new Error(
      "Payroll generation produced 0 records. Check that employees have valid salary structures.",
    );
  }

  // Push to canister in background — UI reads from localStorage immediately
  void pushMonthToCanister(companyCode, month, year);

  return { generatedCount: count };
}

/**
 * Overwrite payroll for a month: delete canister records, recompute, save.
 */
export async function overwriteAndSavePayroll(
  month: number,
  year: number,
): Promise<{ generatedCount: number }> {
  const companyCode = getActiveCompanyId();
  if (!companyCode) throw new Error("No authenticated company. Please log in.");

  // Pre-sync: ensure employees and attendance are loaded from canister
  const empData = getEmployees();
  if (empData.activeEmployees.length === 0) {
    await loadEmployeesFromCanister();
  }
  const attRecords = getAttendanceByMonth(String(month), String(year));
  if (attRecords.length === 0) {
    await syncAttendanceFromCanister();
  }
  const attAfter = getAttendanceByMonth(String(month), String(year));
  if (attAfter.length === 0) {
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    throw new Error(
      `No attendance found for ${monthNames[month - 1]} ${year}. Please enter attendance before generating payroll.`,
    );
  }

  // Delete old canister records for this month (background — don't block)
  void backendService
    .deletePayrollForCompanyAndMonth(companyCode, month, year)
    .catch((e: unknown) =>
      console.warn("[CanisterPayroll] Delete before overwrite failed:", e),
    );

  // Run local payroll engine — saves to localStorage immediately
  const result = overwritePayroll(BigInt(month), BigInt(year), "admin");
  const count = Number(result.generatedCount);
  if (count === 0) {
    throw new Error(
      "Re-generate produced 0 records. Check that employees have valid salary structures and attendance exists for this month.",
    );
  }

  // Push to canister in background
  void pushMonthToCanister(companyCode, month, year);

  return { generatedCount: count };
}

/**
 * Read payroll records for a month from localStorage, convert, and save to canister.
 */
async function pushMonthToCanister(
  companyCode: string,
  month: number,
  year: number,
): Promise<void> {
  try {
    const breakdowns = getPayrollWithBreakdown(BigInt(month), BigInt(year));
    if (breakdowns.length === 0) return;
    const tenantRecords = breakdowns.map((bd) =>
      toTenantRecord(bd, companyCode),
    );
    await backendService.savePayrollForCompany(companyCode, tenantRecords);
    console.log(
      `[CanisterPayroll] Pushed ${tenantRecords.length} records to canister for ${companyCode} ${month}/${year}`,
    );
  } catch (e) {
    console.warn("[CanisterPayroll] Push to canister failed:", e);
  }
}

export async function saveDeductionToCanister(
  employeeId: string,
  month: number,
  year: number,
  ptDeduction: number,
  advanceDeduction: number,
  otherDeduction: number,
): Promise<void> {
  const companyCode = getActiveCompanyId();
  if (!companyCode) return;
  try {
    await backendService.updatePayrollDeductionForCompany(
      companyCode,
      employeeId,
      month,
      year,
      ptDeduction,
      advanceDeduction,
      otherDeduction,
    );
  } catch (e) {
    console.warn("[CanisterPayroll] Deduction update to canister failed:", e);
  }
}

export async function setAdvanceAndSync(
  empId: string,
  month: bigint,
  year: bigint,
  advance: number,
): Promise<boolean> {
  const ok = setAdvanceDeduction(empId, month, year, advance);
  const bds = getPayrollWithBreakdown(month, year);
  const bd = bds.find((b) => b.record.employeeId === empId);
  await saveDeductionToCanister(
    empId,
    Number(month),
    Number(year),
    bd?.ptDeduction ?? 0,
    advance,
    bd?.otherDeduction ?? 0,
  );
  return ok;
}

export async function setPTAndSync(
  empId: string,
  month: bigint,
  year: bigint,
  pt: number,
): Promise<boolean> {
  const ok = setPayrollPT(empId, month, year, pt);
  const bds = getPayrollWithBreakdown(month, year);
  const bd = bds.find((b) => b.record.employeeId === empId);
  await saveDeductionToCanister(
    empId,
    Number(month),
    Number(year),
    pt,
    bd?.advanceDeduction ?? 0,
    bd?.otherDeduction ?? 0,
  );
  return ok;
}

export async function setOtherDedAndSync(
  empId: string,
  month: bigint,
  year: bigint,
  otherDed: number,
): Promise<boolean> {
  const ok = setOtherDeduction(empId, month, year, otherDed);
  const bds = getPayrollWithBreakdown(month, year);
  const bd = bds.find((b) => b.record.employeeId === empId);
  await saveDeductionToCanister(
    empId,
    Number(month),
    Number(year),
    bd?.ptDeduction ?? 0,
    bd?.advanceDeduction ?? 0,
    otherDed,
  );
  return ok;
}

export async function manualOverrideAndSync(
  empId: string,
  month: bigint,
  year: bigint,
  basicSalary: number,
  hra: number,
  conveyance: number,
  specialAllowance: number,
  otherAllowance: number,
  otAmount: number,
  advanceDeduction: number,
  otherDeduction: number,
  pfDeduction: number,
  esiDeduction: number,
  ptDeduction: number,
  netPay: number,
  updatedBy: string,
): Promise<boolean> {
  const ok = manualOverridePayroll(
    empId,
    month,
    year,
    basicSalary,
    hra,
    conveyance,
    specialAllowance,
    otherAllowance,
    otAmount,
    advanceDeduction,
    otherDeduction,
    pfDeduction,
    esiDeduction,
    ptDeduction,
    netPay,
    updatedBy,
  );
  const companyCode = getActiveCompanyId();
  if (!companyCode) return ok;
  await pushMonthToCanister(companyCode, Number(month), Number(year));
  return ok;
}

export { r2 };
