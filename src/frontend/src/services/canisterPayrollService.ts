/**
 * canisterPayrollService.ts
 *
 * Tenant-aware payroll backed by ICP canister.
 * Strategy:
 *   - Writes: canister (primary) + localStorage (cache)
 *   - Reads:  localStorage (fast, sync) — already synced from canister on login
 *   - Sync:   syncPayrollFromCanister() fetches all company payroll and seeds localStorage
 *
 * Payroll calculation uses the shared engine in payrollStorage.ts (correct formula:
 *   Earned = Monthly × PaidDays / TotalDaysInMonth)
 * Attendance data is read from localStorage (already synced from canister).
 */

import type { TenantPayrollRecord } from "../backend.d";
import { backendService } from "./backendService";
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

/** The localStorage key used by payrollStorage for the active company */
function payrollLSKey(): string {
  return `clf_${getActiveCompanyId()}_clf_payroll`;
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

/** Convert a TenantPayrollRecord from canister to localStorage-compatible raw format */
function toLocalStorageRecord(p: TenantPayrollRecord): object {
  return {
    id: p.id,
    employeeId: p.employeeId,
    month: p.month,
    year: p.year,
    // In localStorage, basicSalary = earnedBasic, hra = earnedHra, etc.
    basicSalary: p.earnedBasic,
    hra: p.earnedHra,
    conveyance: p.earnedConveyance,
    specialAllowance: p.earnedSpecialAllowance,
    otherAllowance: p.earnedOtherAllowance,
    otAmount: p.otPay,
    grossPay: p.finalGross,
    pfDeduction: p.pfDeduction,
    esiDeduction: p.esiDeduction,
    ptDeduction: p.ptDeduction,
    advanceDeduction: p.advanceDeduction,
    otherDeduction: p.otherDeduction,
    netPay: p.netPay,
    generatedAt: p.generatedAt,
    // Extended breakdown fields
    _presentDays: p.presentDays,
    _halfDays: p.halfDays,
    _lopDays: p.lopDays,
    _paidDays: p.paidDays,
    _otHours: p.otHours,
    _earnedBasic: p.earnedBasic,
    _earnedHra: p.earnedHra,
    _earnedConveyance: p.earnedConveyance,
    _earnedSpecialAllowance: p.earnedSpecialAllowance,
    _earnedOtherAllowance: p.earnedOtherAllowance,
    _earnedGross: p.earnedGross,
    _otPay: p.otPay,
    _finalGross: p.finalGross,
    _totalDaysInMonth: p.totalDaysInMonth,
  };
}

/**
 * Sync all payroll records for the active company from canister into localStorage.
 * Called on login / page load.
 */
export async function syncPayrollFromCanister(): Promise<{
  count: number;
  source: "canister" | "local";
}> {
  const companyCode = getActiveCompanyId();
  try {
    // We fetch all months by getting records from canister
    // Unfortunately canister API is per-month; we do a broad fetch by loading
    // all records using a dedicated query if available.
    // For now we use a workaround: read all tenantPayroll records for this company
    // We'll add a getAllPayrollByCompany call to the canister.
    // For current implementation, we use the existing getPayrollByCompanyAndMonth
    // for the current month and previous 2 months to populate the cache.
    const now = new Date();
    const months: [number, number][] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push([d.getMonth() + 1, d.getFullYear()]);
    }

    const allRecords: TenantPayrollRecord[] = [];
    for (const [m, y] of months) {
      try {
        const recs = (await backendService.getPayrollByCompanyAndMonth(
          companyCode,
          m,
          y,
        )) as TenantPayrollRecord[];
        allRecords.push(...recs);
      } catch {
        // ignore per-month errors
      }
    }

    if (allRecords.length > 0) {
      seedLocalStorage(companyCode, allRecords);
      console.log(
        `[CanisterPayroll] Synced ${allRecords.length} records from canister for ${companyCode}`,
      );
      return { count: allRecords.length, source: "canister" };
    }

    return { count: 0, source: "canister" };
  } catch (err) {
    console.warn("[CanisterPayroll] Sync failed, using localStorage:", err);
    return { count: 0, source: "local" };
  }
}

/**
 * Overwrite localStorage payroll cache with canister records.
 */
function seedLocalStorage(
  _companyCode: string,
  records: TenantPayrollRecord[],
): void {
  const key = payrollLSKey();
  try {
    // Read existing localStorage to preserve months not fetched
    let existing: any[] = [];
    try {
      const raw = localStorage.getItem(key);
      if (raw) existing = JSON.parse(raw);
    } catch {}

    // Build set of month+year pairs from canister records
    const canisterMonths = new Set(records.map((r) => `${r.month}-${r.year}`));

    // Keep existing records for months NOT covered by canister sync
    const preserved = existing.filter(
      (r: any) => !canisterMonths.has(`${r.month}-${r.year}`),
    );

    const merged = [...preserved, ...records.map(toLocalStorageRecord)];
    localStorage.setItem(key, JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent("clf:payroll-updated"));
  } catch (e) {
    console.warn("[CanisterPayroll] Failed to seed localStorage:", e);
  }
}

/**
 * Generate payroll for a month using local computation engine,
 * then save all generated records to canister.
 * Skips employees that already have payroll for this month.
 */
export async function generateAndSavePayroll(
  month: number,
  year: number,
): Promise<{ generatedCount: number }> {
  const companyCode = getActiveCompanyId();

  // Run local computation (reads from localStorage attendance + employees)
  const result = generatePayroll(BigInt(month), BigInt(year), "admin");

  // Read the freshly computed records from localStorage
  await pushMonthToCanister(companyCode, month, year);

  return { generatedCount: Number(result.generatedCount) };
}

/**
 * Overwrite payroll for a month: delete canister records, recompute, save.
 */
export async function overwriteAndSavePayroll(
  month: number,
  year: number,
): Promise<{ generatedCount: number }> {
  const companyCode = getActiveCompanyId();

  // Delete this month from canister first
  try {
    await backendService.deletePayrollForCompanyAndMonth(
      companyCode,
      month,
      year,
    );
  } catch (e) {
    console.warn("[CanisterPayroll] Delete before overwrite failed:", e);
  }

  // Run local overwrite computation
  const result = overwritePayroll(BigInt(month), BigInt(year), "admin");

  // Push fresh records to canister
  await pushMonthToCanister(companyCode, month, year);

  return { generatedCount: Number(result.generatedCount) };
}

/**
 * Read payroll records for a month from localStorage (already synced),
 * convert to TenantPayrollRecord format, and save to canister.
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

/**
 * Save a manual deduction update (advance/PT/other) to canister.
 * Call after payrollStorage.setAdvanceDeduction / setPayrollPT / setOtherDeduction.
 */
export async function saveDeductionToCanister(
  employeeId: string,
  month: number,
  year: number,
  ptDeduction: number,
  advanceDeduction: number,
  otherDeduction: number,
): Promise<void> {
  const companyCode = getActiveCompanyId();
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

/** Re-export wrappers that also sync to canister */
export async function setAdvanceAndSync(
  empId: string,
  month: bigint,
  year: bigint,
  advance: number,
): Promise<boolean> {
  const ok = setAdvanceDeduction(empId, month, year, advance);
  // Read current PT and other to preserve them
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
  // Push updated record to canister
  const companyCode = getActiveCompanyId();
  await pushMonthToCanister(companyCode, Number(month), Number(year));
  return ok;
}

export { r2 };
