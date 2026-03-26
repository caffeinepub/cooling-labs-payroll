/**
 * payrollStorage.ts
 * localStorage-backed payroll with locked formula:
 *
 * Full Monthly Gross = Basic + HRA + Conveyance + Special Allow + Other Allow
 * Earned X          = Monthly X / totalDays * paidDays
 * Earned Gross      = Earned Basic + HRA + Conv + Special + Other
 * Final Gross       = Earned Gross + OT Pay
 * PF                = 12% of Earned Basic ONLY
 * ESI               = 0.75% of Final Gross (if applicable & gross <= 21000)
 * PT                = manual
 * Advance           = manual
 * Other Deductions  = manual
 * Net               = Final Gross - PF - ESI - PT - Advance - OtherDed
 */
import type { PayrollBreakdown, PayrollRecord, PayrollSummary } from "../types";
import { getAttendanceByMonth } from "./attendanceStorage";
import { getEmployees } from "./workforceStorage";

const KEY = "clf_payroll";

// Extended interface with separated earned components
export interface PayrollBreakdownExtended extends PayrollBreakdown {
  fullMonthlyGross: number;
  earnedBasic: number;
  earnedHRA: number;
  earnedAllowances: number;
  earnedGross: number;
}

type RawPayrollRecord = Omit<
  PayrollRecord,
  "month" | "year" | "generatedAt"
> & {
  month: number;
  year: number;
  generatedAt: number;
  advanceDeduction?: number;
  otherDeduction?: number;
};

type RawBreakdown = Omit<PayrollBreakdown, "totalDaysInMonth" | "record"> & {
  totalDaysInMonth: number;
  record: RawPayrollRecord;
  fullMonthlyGross: number;
  earnedBasic: number;
  earnedHRA: number;
  earnedAllowances: number;
  earnedGross: number;
};

function loadRaw(): RawBreakdown[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RawBreakdown[];
  } catch {
    return [];
  }
}

function saveRaw(data: RawBreakdown[]): void {
  localStorage.setItem(KEY, JSON.stringify(data));
}

function toBreakdown(r: RawBreakdown): PayrollBreakdownExtended {
  return {
    ...r,
    totalDaysInMonth: BigInt(r.totalDaysInMonth),
    record: {
      ...r.record,
      month: BigInt(r.record.month),
      year: BigInt(r.record.year),
      generatedAt: BigInt(r.record.generatedAt),
    },
    fullMonthlyGross: r.fullMonthlyGross ?? 0,
    earnedBasic: r.earnedBasic ?? 0,
    earnedHRA: r.earnedHRA ?? 0,
    earnedAllowances: r.earnedAllowances ?? 0,
    earnedGross: r.earnedGross ?? 0,
  };
}

export function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

function genId(): string {
  return `pay-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Recompute net pay from stored fields */
function recomputeNet(rec: RawPayrollRecord): number {
  return r2(
    rec.grossPay -
      rec.pfDeduction -
      rec.esiDeduction -
      (rec.ptDeduction || 0) -
      (rec.advanceDeduction || 0) -
      (rec.otherDeduction || 0),
  );
}

function buildBreakdownsForMonth(
  monthNum: number,
  yearNum: number,
  _generatedBy: string,
): RawBreakdown[] {
  const { activeEmployees } = getEmployees();
  const paddedMonth = String(monthNum).padStart(2, "0");
  const attendanceRecs = getAttendanceByMonth(paddedMonth, String(yearNum));
  const totalDays = daysInMonth(monthNum, yearNum);
  const now = Date.now();

  return activeEmployees.map((emp) => {
    const empRecs = attendanceRecs.filter((a) => a.employeeId === emp.id);
    const presentDays = empRecs.filter((a) => a.status === "Present").length;
    const halfDays = empRecs.filter(
      (a) => a.status === "HalfDay" || a.status === "Half Day",
    ).length;
    const paidLeaveDays = empRecs.filter((a) => a.status === "Leave").length;
    // Paid Days = Present + HalfDay * 0.5 + PaidLeave
    const paidDays = presentDays + halfDays * 0.5 + paidLeaveDays;
    const lopDays = Math.max(
      0,
      totalDays - presentDays - halfDays - paidLeaveDays,
    );
    const otHours = empRecs.reduce((s, a) => s + (a.otHours || 0), 0);

    // --- Full monthly salary structure (as entered) ---
    const mBasic = emp.basicSalary || 0;
    const mHRA = emp.hra || 0;
    const mConv = emp.conveyance || 0;
    const mSpecial = emp.specialAllowance || 0;
    const mOther = emp.otherAllowance || 0;
    const fullMonthlyGross = mBasic + mHRA + mConv + mSpecial + mOther;

    // --- Earned = monthly / totalDays * paidDays ---
    const factor = totalDays > 0 ? paidDays / totalDays : 0;
    const earnedBasic = r2(mBasic * factor);
    const earnedHRA = r2(mHRA * factor);
    const earnedConv = r2(mConv * factor);
    const earnedSpecial = r2(mSpecial * factor);
    const earnedOther = r2(mOther * factor);
    const earnedAllowances = r2(earnedConv + earnedSpecial + earnedOther);
    const earnedGross = r2(earnedBasic + earnedHRA + earnedAllowances);

    // --- OT Pay ---
    const otPay = r2(otHours * (emp.otRate || 0));

    // --- Final Gross = Earned Gross + OT Pay ---
    const finalGross = r2(earnedGross + otPay);

    // --- Deductions ---
    // PF: 12% of Earned Basic ONLY
    const pfDeduction = emp.pfApplicable ? r2(earnedBasic * 0.12) : 0;
    // ESI: 0.75% of Final Gross if applicable and finalGross <= 21000
    const esiDeduction =
      emp.esiApplicable && finalGross <= 21000 ? r2(finalGross * 0.0075) : 0;
    const ptDeduction = 0;
    const advanceDeduction = 0;
    const otherDeduction = 0;

    const netPay = r2(
      finalGross -
        pfDeduction -
        esiDeduction -
        ptDeduction -
        advanceDeduction -
        otherDeduction,
    );

    const record: RawPayrollRecord = {
      id: genId(),
      employeeId: emp.id,
      month: monthNum,
      year: yearNum,
      // store earned (prorated) values in record fields
      basicSalary: earnedBasic,
      hra: earnedHRA,
      conveyance: earnedConv,
      specialAllowance: earnedSpecial,
      otherAllowance: earnedOther,
      otAmount: otPay,
      grossPay: finalGross,
      pfDeduction,
      esiDeduction,
      ptDeduction,
      advanceDeduction,
      otherDeduction,
      netPay,
      generatedAt: now,
    };

    return {
      record,
      presentDays,
      halfDays,
      lopDays,
      paidDays,
      otHours,
      totalDaysInMonth: totalDays,
      fullMonthlyGross,
      earnedBasic,
      earnedHRA,
      earnedAllowances,
      earnedGross,
    };
  });
}

export function generatePayroll(
  month: bigint,
  year: bigint,
  _generatedBy: string,
): { generatedCount: bigint } {
  const monthNum = Number(month);
  const yearNum = Number(year);
  const existing = loadRaw();
  const alreadyPresent = new Set(
    existing
      .filter((r) => r.record.month === monthNum && r.record.year === yearNum)
      .map((r) => r.record.employeeId),
  );
  const newBreakdowns = buildBreakdownsForMonth(
    monthNum,
    yearNum,
    _generatedBy,
  ).filter((b) => !alreadyPresent.has(b.record.employeeId));
  saveRaw([...existing, ...newBreakdowns]);
  return { generatedCount: BigInt(newBreakdowns.length) };
}

export function overwritePayroll(
  month: bigint,
  year: bigint,
  _generatedBy: string,
): { generatedCount: bigint } {
  const monthNum = Number(month);
  const yearNum = Number(year);
  const existing = loadRaw().filter(
    (r) => !(r.record.month === monthNum && r.record.year === yearNum),
  );
  const newBreakdowns = buildBreakdownsForMonth(
    monthNum,
    yearNum,
    _generatedBy,
  );
  saveRaw([...existing, ...newBreakdowns]);
  return { generatedCount: BigInt(newBreakdowns.length) };
}

export function getPayrollWithBreakdown(
  month: bigint,
  year: bigint,
): PayrollBreakdownExtended[] {
  const monthNum = Number(month);
  const yearNum = Number(year);
  return loadRaw()
    .filter((r) => r.record.month === monthNum && r.record.year === yearNum)
    .map(toBreakdown);
}

export function getPayrollSummary(month: bigint, year: bigint): PayrollSummary {
  const breakdowns = getPayrollWithBreakdown(month, year);
  const totalGross = breakdowns.reduce((s, b) => s + b.record.grossPay, 0);
  const totalDeductions = breakdowns.reduce(
    (s, b) =>
      s +
      b.record.pfDeduction +
      b.record.esiDeduction +
      (b.record.ptDeduction || 0) +
      ((b.record as unknown as RawPayrollRecord).advanceDeduction || 0) +
      ((b.record as unknown as RawPayrollRecord).otherDeduction || 0),
    0,
  );
  const totalNetPay = breakdowns.reduce((s, b) => s + b.record.netPay, 0);
  return {
    totalEmployees: BigInt(breakdowns.length),
    totalGross,
    totalDeductions,
    totalNetPay,
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
  _changedBy: string,
): boolean {
  const monthNum = Number(month);
  const yearNum = Number(year);
  const data = loadRaw();
  const idx = data.findIndex(
    (r) =>
      r.record.employeeId === empId &&
      r.record.month === monthNum &&
      r.record.year === yearNum,
  );
  if (idx === -1) return false;
  const rec = data[idx].record;
  const earnedGross = r2(
    basicSalary + hra + conveyance + specialAllowance + otherAllowance,
  );
  const finalGross = r2(earnedGross + otAmount);
  rec.basicSalary = basicSalary;
  rec.hra = hra;
  rec.conveyance = conveyance;
  rec.specialAllowance = specialAllowance;
  rec.otherAllowance = otherAllowance;
  rec.otAmount = otAmount;
  rec.grossPay = finalGross;
  rec.pfDeduction = pfDeduction;
  rec.esiDeduction = esiDeduction;
  rec.ptDeduction = ptDeduction;
  rec.advanceDeduction = advanceDeduction;
  rec.otherDeduction = otherDeduction;
  // Always recompute net pay from formula — never trust frontend input
  rec.netPay = recomputeNet(rec);
  // update extended breakdown fields
  data[idx].earnedBasic = basicSalary;
  data[idx].earnedHRA = hra;
  data[idx].earnedAllowances = r2(
    conveyance + specialAllowance + otherAllowance,
  );
  data[idx].earnedGross = earnedGross;
  saveRaw(data);
  return true;
}

export function setPayrollPT(
  empId: string,
  month: bigint,
  year: bigint,
  ptAmount: number,
): boolean {
  const monthNum = Number(month);
  const yearNum = Number(year);
  const data = loadRaw();
  const idx = data.findIndex(
    (r) =>
      r.record.employeeId === empId &&
      r.record.month === monthNum &&
      r.record.year === yearNum,
  );
  if (idx === -1) return false;
  const rec = data[idx].record;
  rec.ptDeduction = ptAmount;
  rec.netPay = recomputeNet(rec);
  saveRaw(data);
  return true;
}

export function setAdvanceDeduction(
  empId: string,
  month: bigint,
  year: bigint,
  amount: number,
): boolean {
  const monthNum = Number(month);
  const yearNum = Number(year);
  const data = loadRaw();
  const idx = data.findIndex(
    (r) =>
      r.record.employeeId === empId &&
      r.record.month === monthNum &&
      r.record.year === yearNum,
  );
  if (idx === -1) return false;
  const rec = data[idx].record;
  rec.advanceDeduction = amount;
  rec.netPay = recomputeNet(rec);
  saveRaw(data);
  return true;
}

export function setOtherDeduction(
  empId: string,
  month: bigint,
  year: bigint,
  amount: number,
): boolean {
  const monthNum = Number(month);
  const yearNum = Number(year);
  const data = loadRaw();
  const idx = data.findIndex(
    (r) =>
      r.record.employeeId === empId &&
      r.record.month === monthNum &&
      r.record.year === yearNum,
  );
  if (idx === -1) return false;
  const rec = data[idx].record;
  rec.otherDeduction = amount;
  rec.netPay = recomputeNet(rec);
  saveRaw(data);
  return true;
}
