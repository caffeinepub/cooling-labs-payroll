/**
 * payrollStorage.ts — tenant-aware payroll engine.
 */
import type { PayrollRecord, PayrollSummary } from "../types";
import { getAttendanceByMonth } from "./attendanceStorage";
import { getCompanySettings } from "./companySettings";
import { getActiveCompanyId, getTenantKey } from "./tenantStorage";

function getKey(): string {
  return getTenantKey(getActiveCompanyId(), "clf_payroll");
}

function getManualDedKey(): string {
  return getTenantKey(getActiveCompanyId(), "clf_payroll_manual_ded");
}

/** Round to 2 decimal places */
export function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface PayrollBreakdownExtended {
  record: PayrollRecord;
  presentDays: number;
  halfDays: number;
  lopDays: number;
  paidDays: number;
  otHours: number;
  earnedBasic: number;
  earnedHra: number;
  earnedConveyance: number;
  earnedSpecialAllowance: number;
  earnedOtherAllowance: number;
  earnedGross: number;
  otPay: number;
  finalGross: number;
  pfDeduction: number;
  esiDeduction: number;
  ptDeduction: number;
  advanceDeduction: number;
  otherDeduction: number;
  totalDeductions: number;
  netPay: number;
  totalDaysInMonth: bigint;
  // Alias fields used by Payroll.tsx
  earnedHRA: number;
  earnedAllowances: number;
  fullMonthlyGross: number;
}

type RawPayroll = Omit<PayrollRecord, "month" | "year" | "generatedAt"> & {
  month: number;
  year: number;
  generatedAt: number;
};

type ManualDedStore = Record<
  string,
  { advance: number; pt: number; otherDed: number }
>;

function manualDedKeyFor(empId: string, month: number, year: number): string {
  return `${empId}__${month}__${year}`;
}

function loadManualDeds(): ManualDedStore {
  try {
    const raw = localStorage.getItem(getManualDedKey());
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveManualDeds(data: ManualDedStore): void {
  localStorage.setItem(getManualDedKey(), JSON.stringify(data));
}

function load(): RawPayroll[] {
  try {
    const raw = localStorage.getItem(getKey());
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveRaw(records: RawPayroll[]): void {
  localStorage.setItem(getKey(), JSON.stringify(records));
}

function toPayrollRecord(r: RawPayroll): PayrollRecord {
  return {
    ...r,
    month: BigInt(r.month),
    year: BigInt(r.year),
    generatedAt: BigInt(r.generatedAt),
  };
}

function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

function computePayrollForEmployee(
  emp: {
    id: string;
    employeeId: string;
    name: string;
    basicSalary: number;
    hra: number;
    conveyance: number;
    specialAllowance: number;
    otherAllowance: number;
    pfApplicable: boolean;
    esiApplicable: boolean;
    salaryMode?: string;
  },
  month: number,
  year: number,
  settings: ReturnType<typeof getCompanySettings>,
  manualOverride?: { advance: number; pt: number; otherDed: number },
): RawPayroll {
  const attMonth = String(month).padStart(2, "0");
  const attYear = String(year);
  const attRecords = getAttendanceByMonth(attMonth, attYear).filter(
    (r) => r.employeeId === emp.id,
  );

  let presentDays = 0;
  let halfDays = 0;
  let leaveDays = 0;
  let _weeklyOffDays = 0;
  let _holidayDays = 0;
  let lopDays = 0;
  let totalOTHours = 0;
  let totalAdvance = 0;

  for (const r of attRecords) {
    const s = (r.status || "").toLowerCase().replace(/\s/g, "");
    if (s === "present") presentDays++;
    else if (s === "halfday" || s === "half") halfDays++;
    else if (s === "leave") leaveDays++;
    else if (s === "weeklyoff" || s === "wo") _weeklyOffDays++;
    else if (s === "holiday") _holidayDays++;
    else if (s === "absent") lopDays++;
    totalOTHours += r.otHours ?? 0;
    totalAdvance += r.advanceAmount ?? 0;
  }

  // workingDays is kept for OT rate reference only (not used in earned ratio anymore)
  const _workingDays = settings.workingDaysPerMonth || 26;
  void _workingDays;
  const paidDays = r2(presentDays + halfDays * 0.5 + leaveDays);
  const totalDaysInMonth = getDaysInMonth(month, year);

  const ratio = totalDaysInMonth > 0 ? paidDays / totalDaysInMonth : 0; // FIX: use calendar days, not workingDaysPerMonth setting

  const earnedBasic = r2(emp.basicSalary * ratio);
  const earnedHra = r2(emp.hra * ratio);
  const earnedConveyance = r2((emp.conveyance || 0) * ratio);
  const earnedSpecialAllowance = r2((emp.specialAllowance || 0) * ratio);
  const earnedOtherAllowance = r2((emp.otherAllowance || 0) * ratio);

  const earnedGross = r2(
    earnedBasic +
      earnedHra +
      earnedConveyance +
      earnedSpecialAllowance +
      earnedOtherAllowance,
  );

  const dailyRate =
    totalDaysInMonth > 0 ? emp.basicSalary / totalDaysInMonth : 0; // FIX: OT rate also based on calendar days
  const hourlyRate = dailyRate / 8;
  const otPay = r2(
    totalOTHours * hourlyRate * (settings.otRateMultiplier || 2),
  );
  const finalGross = r2(earnedGross + otPay);

  const pfRate = (settings.pfEmployeeRate ?? 12) / 100;
  const esiRate = (settings.esiEmployeeRate ?? 0.75) / 100;

  const pfDeduction = emp.pfApplicable ? r2(earnedBasic * pfRate) : 0;
  const esiDeduction =
    emp.esiApplicable && finalGross <= 21000 ? r2(finalGross * esiRate) : 0;

  const ptDeduction =
    manualOverride?.pt !== undefined
      ? manualOverride.pt
      : settings.ptApplicable
        ? settings.ptAmount
        : 0;
  const advanceDeduction =
    manualOverride?.advance !== undefined
      ? manualOverride.advance
      : totalAdvance;
  const otherDeduction = manualOverride?.otherDed || 0;

  const totalDeductions = r2(
    pfDeduction +
      esiDeduction +
      (ptDeduction ?? 0) +
      advanceDeduction +
      otherDeduction,
  );
  const netPay = r2(finalGross - totalDeductions);

  return {
    id: `pay-${emp.id}-${month}-${year}`,
    employeeId: emp.id,
    month,
    year,
    basicSalary: earnedBasic,
    hra: earnedHra,
    conveyance: earnedConveyance,
    specialAllowance: earnedSpecialAllowance,
    otherAllowance: earnedOtherAllowance,
    otAmount: otPay,
    grossPay: r2(finalGross),
    pfDeduction,
    esiDeduction,
    ptDeduction,
    advanceDeduction,
    otherDeduction,
    netPay,
    generatedAt: Date.now(),
    // Extended fields stored for breakdown
    _presentDays: presentDays,
    _halfDays: halfDays,
    _lopDays: lopDays,
    _paidDays: paidDays,
    _otHours: totalOTHours,
    _earnedBasic: earnedBasic,
    _earnedHra: earnedHra,
    _earnedConveyance: earnedConveyance,
    _earnedSpecialAllowance: earnedSpecialAllowance,
    _earnedOtherAllowance: earnedOtherAllowance,
    _earnedGross: earnedGross,
    _otPay: otPay,
    _finalGross: finalGross,
    _totalDaysInMonth: totalDaysInMonth,
  } as RawPayroll;
}

function toBreakdown(r: RawPayroll): PayrollBreakdownExtended {
  const ext = r as any;
  return {
    record: toPayrollRecord(r),
    presentDays: ext._presentDays ?? 0,
    halfDays: ext._halfDays ?? 0,
    lopDays: ext._lopDays ?? 0,
    paidDays: ext._paidDays ?? 0,
    otHours: ext._otHours ?? 0,
    earnedBasic: ext._earnedBasic ?? r.basicSalary,
    earnedHra: ext._earnedHra ?? r.hra,
    earnedConveyance: ext._earnedConveyance ?? (r.conveyance || 0),
    earnedSpecialAllowance:
      ext._earnedSpecialAllowance ?? (r.specialAllowance || 0),
    earnedOtherAllowance: ext._earnedOtherAllowance ?? (r.otherAllowance || 0),
    earnedGross: ext._earnedGross ?? r.grossPay,
    otPay: ext._otPay ?? r.otAmount,
    finalGross: ext._finalGross ?? r.grossPay,
    pfDeduction: r.pfDeduction,
    esiDeduction: r.esiDeduction,
    ptDeduction: r.ptDeduction,
    advanceDeduction: r.advanceDeduction ?? 0,
    otherDeduction: r.otherDeduction ?? 0,
    totalDeductions: r2(
      r.pfDeduction +
        r.esiDeduction +
        r.ptDeduction +
        (r.advanceDeduction ?? 0) +
        (r.otherDeduction ?? 0),
    ),
    netPay: r.netPay,
    totalDaysInMonth: BigInt(ext._totalDaysInMonth ?? 26),
    earnedHRA: ext._earnedHra ?? r.hra,
    earnedAllowances: r2(
      (ext._earnedConveyance ?? r.conveyance ?? 0) +
        (ext._earnedSpecialAllowance ?? r.specialAllowance ?? 0) +
        (ext._earnedOtherAllowance ?? r.otherAllowance ?? 0),
    ),
    fullMonthlyGross: ext._finalGross ?? r.grossPay,
  };
}

/** Generate payroll for all active employees for a given month/year. Skips if already exists. */
export function generatePayroll(
  month: bigint,
  year: bigint,
  _updatedBy: string,
): { generatedCount: bigint } {
  const m = Number(month);
  const y = Number(year);
  const records = load();
  const settings = getCompanySettings();
  const manualDeds = loadManualDeds();

  // Import employee data dynamically to avoid circular dep
  let employees: any[] = [];
  try {
    const wf = require("./workforceStorage");
    employees = wf.getEmployees().activeEmployees;
  } catch {
    // fallback
    const raw = localStorage.getItem(
      getTenantKey(getActiveCompanyId(), "clf_employees"),
    );
    if (raw)
      employees = JSON.parse(raw).filter((e: any) => e.status === "active");
  }

  let generatedCount = 0;
  const existingIds = new Set(
    records
      .filter((r) => r.month === m && r.year === y)
      .map((r) => r.employeeId),
  );

  const newRecords: RawPayroll[] = [];
  for (const emp of employees) {
    if (existingIds.has(emp.id)) continue;
    const manual = manualDeds[manualDedKeyFor(emp.id, m, y)];
    newRecords.push(computePayrollForEmployee(emp, m, y, settings, manual));
    generatedCount++;
  }

  if (newRecords.length > 0) {
    saveRaw([...records, ...newRecords]);
  }
  return { generatedCount: BigInt(generatedCount) };
}

/** Regenerate payroll for all active employees for a given month/year (overwrites existing). */
export function overwritePayroll(
  month: bigint,
  year: bigint,
  _updatedBy: string,
): { generatedCount: bigint } {
  const m = Number(month);
  const y = Number(year);
  const records = load();
  const settings = getCompanySettings();
  const manualDeds = loadManualDeds();

  let employees: any[] = [];
  try {
    const wf = require("./workforceStorage");
    employees = wf.getEmployees().activeEmployees;
  } catch {
    const raw = localStorage.getItem(
      getTenantKey(getActiveCompanyId(), "clf_employees"),
    );
    if (raw)
      employees = JSON.parse(raw).filter((e: any) => e.status === "active");
  }

  const filtered = records.filter((r) => !(r.month === m && r.year === y));
  const newRecords: RawPayroll[] = [];
  for (const emp of employees) {
    const manual = manualDeds[manualDedKeyFor(emp.id, m, y)];
    newRecords.push(computePayrollForEmployee(emp, m, y, settings, manual));
  }
  saveRaw([...filtered, ...newRecords]);
  return { generatedCount: BigInt(newRecords.length) };
}

export function getPayrollWithBreakdown(
  month: bigint,
  year: bigint,
): PayrollBreakdownExtended[] {
  const m = Number(month);
  const y = Number(year);
  return load()
    .filter((r) => r.month === m && r.year === y)
    .map(toBreakdown);
}

export function getPayrollSummary(month: bigint, year: bigint): PayrollSummary {
  const m = Number(month);
  const y = Number(year);
  const recs = load().filter((r) => r.month === m && r.year === y);
  let totalGross = 0;
  let totalDeductions = 0;
  let totalNetPay = 0;
  for (const r of recs) {
    totalGross += r.grossPay;
    totalDeductions += r2(
      r.pfDeduction +
        r.esiDeduction +
        r.ptDeduction +
        (r.advanceDeduction ?? 0) +
        (r.otherDeduction ?? 0),
    );
    totalNetPay += r.netPay;
  }
  return {
    totalEmployees: BigInt(recs.length),
    totalGross: r2(totalGross),
    totalDeductions: r2(totalDeductions),
    totalNetPay: r2(totalNetPay),
  };
}

export function manualOverridePayroll(
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
  _netPayIgnored: number,
  _updatedBy: string,
): boolean {
  const m = Number(month);
  const y = Number(year);
  const records = load();
  const idx = records.findIndex(
    (r) => r.employeeId === empId && r.month === m && r.year === y,
  );
  const earnedGross = r2(
    basicSalary + hra + conveyance + specialAllowance + otherAllowance,
  );
  const finalGross = r2(earnedGross + otAmount);
  const totalDed = r2(
    pfDeduction +
      esiDeduction +
      ptDeduction +
      advanceDeduction +
      otherDeduction,
  );
  const netPay = r2(finalGross - totalDed);

  const updated: RawPayroll = {
    ...(idx >= 0
      ? records[idx]
      : {
          id: `pay-${empId}-${m}-${y}`,
          employeeId: empId,
          month: m,
          year: y,
          generatedAt: Date.now(),
        }),
    basicSalary,
    hra,
    conveyance,
    specialAllowance,
    otherAllowance,
    otAmount,
    grossPay: finalGross,
    pfDeduction,
    esiDeduction,
    ptDeduction,
    advanceDeduction,
    otherDeduction,
    netPay,
    _earnedBasic: basicSalary,
    _earnedHra: hra,
    _earnedConveyance: conveyance,
    _earnedSpecialAllowance: specialAllowance,
    _earnedOtherAllowance: otherAllowance,
    _earnedGross: earnedGross,
    _otPay: otAmount,
    _finalGross: finalGross,
  } as unknown as RawPayroll;

  if (idx >= 0) {
    records[idx] = updated;
  } else {
    records.push(updated);
  }
  saveRaw(records);

  // Save manual overrides
  const store = loadManualDeds();
  const mkey = manualDedKeyFor(empId, m, y);
  store[mkey] = {
    advance: advanceDeduction,
    pt: ptDeduction,
    otherDed: otherDeduction,
  };
  saveManualDeds(store);

  return true;
}

export function setPayrollPT(
  empId: string,
  month: bigint,
  year: bigint,
  pt: number,
): boolean {
  const m = Number(month);
  const y = Number(year);
  const records = load();
  const idx = records.findIndex(
    (r) => r.employeeId === empId && r.month === m && r.year === y,
  );
  if (idx === -1) return false;
  const rec = records[idx];
  const totalDed = r2(
    rec.pfDeduction +
      rec.esiDeduction +
      pt +
      (rec.advanceDeduction ?? 0) +
      (rec.otherDeduction ?? 0),
  );
  records[idx] = {
    ...rec,
    ptDeduction: pt,
    netPay: r2(rec.grossPay - totalDed),
  };
  saveRaw(records);
  const store = loadManualDeds();
  const mkey = manualDedKeyFor(empId, m, y);
  if (!store[mkey]) store[mkey] = { advance: 0, pt: 0, otherDed: 0 };
  store[mkey].pt = pt;
  saveManualDeds(store);
  return true;
}

export function setAdvanceDeduction(
  empId: string,
  month: bigint,
  year: bigint,
  advance: number,
): boolean {
  const m = Number(month);
  const y = Number(year);
  const records = load();
  const idx = records.findIndex(
    (r) => r.employeeId === empId && r.month === m && r.year === y,
  );
  if (idx === -1) return false;
  const rec = records[idx];
  const totalDed = r2(
    rec.pfDeduction +
      rec.esiDeduction +
      rec.ptDeduction +
      advance +
      (rec.otherDeduction ?? 0),
  );
  records[idx] = {
    ...rec,
    advanceDeduction: advance,
    netPay: r2(rec.grossPay - totalDed),
  };
  saveRaw(records);
  const store = loadManualDeds();
  const mkey = manualDedKeyFor(empId, m, y);
  if (!store[mkey]) store[mkey] = { advance: 0, pt: 0, otherDed: 0 };
  store[mkey].advance = advance;
  saveManualDeds(store);
  return true;
}

export function setOtherDeduction(
  empId: string,
  month: bigint,
  year: bigint,
  otherDed: number,
): boolean {
  const m = Number(month);
  const y = Number(year);
  const records = load();
  const idx = records.findIndex(
    (r) => r.employeeId === empId && r.month === m && r.year === y,
  );
  if (idx === -1) return false;
  const rec = records[idx];
  const totalDed = r2(
    rec.pfDeduction +
      rec.esiDeduction +
      rec.ptDeduction +
      (rec.advanceDeduction ?? 0) +
      otherDed,
  );
  records[idx] = {
    ...rec,
    otherDeduction: otherDed,
    netPay: r2(rec.grossPay - totalDed),
  };
  saveRaw(records);
  const store = loadManualDeds();
  const mkey = manualDedKeyFor(empId, m, y);
  if (!store[mkey]) store[mkey] = { advance: 0, pt: 0, otherDed: 0 };
  store[mkey].otherDed = otherDed;
  saveManualDeds(store);
  return true;
}

/** Get sum of advance for employee in a month (from attendance records) */
export function getAdvanceSumForEmployee(
  employeeId: string,
  month: number,
  year: number,
): number {
  const m = String(month).padStart(2, "0");
  const y = String(year);
  const { getAttendanceByMonth: getAtt } = require("./attendanceStorage");
  const records = getAtt(m, y) as any[];
  return records
    .filter((r) => r.employeeId === employeeId)
    .reduce((s, r) => s + (r.advanceAmount || 0), 0);
}
