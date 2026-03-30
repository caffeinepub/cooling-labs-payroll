import {
  ChevronDown,
  ChevronRight,
  FileText,
  IndianRupee,
  Pencil,
  ShieldX,
  X,
} from "lucide-react";
import React, { useState, useCallback, useEffect, useMemo } from "react";
import { PayslipModal } from "../components/PayslipModal";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { PageLoader } from "../components/ui/LoadingSpinner";
import { ToastContainer } from "../components/ui/ToastContainer";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAppContext } from "../context/AppContext";
import { useToast } from "../hooks/useToast";
import * as canisterPayroll from "../services/canisterPayrollService";
import * as payrollStorage from "../services/payrollStorage";
import type { PayrollBreakdownExtended } from "../services/payrollStorage";
import type { Employee, PayrollSummary } from "../types";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function fmt(n: number) {
  return `\u20b9${Number(n ?? 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

interface OverrideForm {
  basicSalary: string;
  hra: string;
  conveyance: string;
  specialAllowance: string;
  otherAllowance: string;
  otAmount: string;
  advanceDeduction: string;
  otherDeduction: string;
  pfDeduction: string;
  esiDeduction: string;
  ptDeduction: string;
}

function computeNetFromForm(f: OverrideForm): number {
  const p = (k: keyof OverrideForm) => Number.parseFloat(f[k]) || 0;
  const earned =
    p("basicSalary") +
    p("hra") +
    p("conveyance") +
    p("specialAllowance") +
    p("otherAllowance");
  const finalGross = payrollStorage.r2(earned + p("otAmount"));
  return payrollStorage.r2(
    finalGross -
      p("pfDeduction") -
      p("esiDeduction") -
      p("ptDeduction") -
      p("advanceDeduction") -
      p("otherDeduction"),
  );
}

function CalcSummaryPanel({
  bd,
  empName,
  monthLabel,
}: {
  bd: PayrollBreakdownExtended;
  empName: string;
  monthLabel: string;
}) {
  const totalDays = Number(bd.totalDaysInMonth);
  const rec = bd.record;
  const paidDays = bd.paidDays;

  // Reverse-compute monthly components from earned (earned = monthly * paidDays / totalDays)
  const safeDiv = paidDays > 0 ? totalDays / paidDays : 0;
  const monthlyBasic = Math.round(bd.earnedBasic * safeDiv * 100) / 100;
  const monthlyHRA = Math.round(bd.earnedHRA * safeDiv * 100) / 100;
  const monthlyAllowances =
    Math.round(bd.earnedAllowances * safeDiv * 100) / 100;

  type SummaryRow = {
    label: string;
    formula: string;
    value: string;
    highlight?: string;
    separator?: boolean;
  };

  const rows: SummaryRow[] = [
    {
      label: "Monthly Basic",
      formula: "from salary structure",
      value: fmt(monthlyBasic),
    },
    {
      label: "Monthly HRA",
      formula: "from salary structure",
      value: fmt(monthlyHRA),
    },
    {
      label: "Monthly Allowances",
      formula: "Conv + Special + Other",
      value: fmt(monthlyAllowances),
    },
    {
      label: "Full Monthly Gross",
      formula: "Basic + HRA + Allowances",
      value: fmt(bd.fullMonthlyGross),
      highlight: "text-blue-700 font-bold",
      separator: true,
    },
    {
      label: "Total Days in Month",
      formula: monthLabel,
      value: String(totalDays),
    },
    {
      label: "Paid Days",
      formula: `Present (${bd.presentDays}) + HalfDay x0.5 (${(bd.halfDays * 0.5).toFixed(1)})`,
      value: paidDays.toFixed(2),
    },
    {
      label: "LOP Days",
      formula: `Total (${totalDays}) - Present (${bd.presentDays}) - HalfDays (${bd.halfDays})`,
      value: bd.lopDays.toFixed(2),
      separator: true,
    },
    {
      label: "Earned Basic",
      formula: `${fmt(monthlyBasic)} / ${totalDays} x ${paidDays.toFixed(2)}`,
      value: fmt(bd.earnedBasic),
    },
    {
      label: "Earned HRA",
      formula: `${fmt(monthlyHRA)} / ${totalDays} x ${paidDays.toFixed(2)}`,
      value: fmt(bd.earnedHRA),
    },
    {
      label: "Earned Allowances",
      formula: `${fmt(monthlyAllowances)} / ${totalDays} x ${paidDays.toFixed(2)}`,
      value: fmt(bd.earnedAllowances),
    },
    {
      label: "Earned Gross",
      formula: "Earned Basic + HRA + Allowances",
      value: fmt(bd.earnedGross),
      highlight: "text-blue-700 font-semibold",
    },
    {
      label: "OT Pay",
      formula: `${bd.otHours} hrs x OT Rate`,
      value: fmt(rec.otAmount),
    },
    {
      label: "Final Gross Earnings",
      formula: "Earned Gross + OT Pay",
      value: fmt(rec.grossPay),
      highlight: "text-blue-800 font-bold",
      separator: true,
    },
    {
      label: "PF  (12% of Earned Basic ONLY)",
      formula: `${fmt(bd.earnedBasic)} x 12%`,
      value: fmt(rec.pfDeduction),
      highlight: "text-red-600",
    },
    {
      label: "ESI (0.75% of Final Gross)",
      formula: `${fmt(rec.grossPay)} x 0.75%`,
      value: fmt(rec.esiDeduction),
      highlight: "text-red-600",
    },
    {
      label: "PT  (Professional Tax)",
      formula: "click to edit",
      value: fmt(rec.ptDeduction ?? 0),
      highlight: "text-orange-600",
    },
    {
      label: "Advance Deduction",
      formula: "click to edit",
      value: fmt(rec.advanceDeduction ?? 0),
      highlight: "text-orange-600",
    },
    {
      label: "Other Deductions",
      formula: "click to edit",
      value: fmt(rec.otherDeduction ?? 0),
      highlight: "text-orange-600",
      separator: true,
    },
    {
      label: "NET PAY",
      formula: "Final Gross - PF - ESI - PT - Advance - Other",
      value: fmt(rec.netPay),
      highlight: "text-green-700 font-bold text-sm",
    },
  ];

  return (
    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg mt-1">
      <p className="text-xs font-semibold text-slate-700 mb-3">
        Calculation Breakdown -- {empName} ({monthLabel})
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left pb-1.5 text-slate-500 font-medium w-2/5">
              Component
            </th>
            <th className="text-left pb-1.5 text-slate-500 font-medium">
              Formula
            </th>
            <th className="text-right pb-1.5 text-slate-500 font-medium">
              Value
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.label}
              className={`border-b border-slate-100 last:border-0${row.separator ? " border-b-slate-300" : ""}`}
            >
              <td
                className={`py-1.5 pr-2 ${row.highlight ?? "text-slate-700"}`}
              >
                {row.label}
              </td>
              <td className="py-1.5 pr-2 text-slate-400 font-mono text-xs">
                {row.formula}
              </td>
              <td
                className={`py-1.5 text-right tabular-nums ${row.highlight ?? "text-slate-700"}`}
              >
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Payroll() {
  const { isAdmin, employees, attendanceSynced } = useAppContext();
  const { toasts, addToast, removeToast } = useToast();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [breakdowns, setBreakdowns] = useState<PayrollBreakdownExtended[]>([]);
  const [summary, setSummary] = useState<PayrollSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [payrollError, setPayrollError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [overwriteOpen, setOverwriteOpen] = useState(false);
  const [overrideTarget, setOverrideTarget] =
    useState<PayrollBreakdownExtended | null>(null);
  const [overrideForm, setOverrideForm] = useState<OverrideForm | null>(null);
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [ptTarget, setPtTarget] = useState<PayrollBreakdownExtended | null>(
    null,
  );
  const [ptAmount, setPtAmount] = useState("");
  const [ptSaving, setPtSaving] = useState(false);
  const [advTarget, setAdvTarget] = useState<PayrollBreakdownExtended | null>(
    null,
  );
  const [advAmount, setAdvAmount] = useState("");
  const [advSaving, setAdvSaving] = useState(false);
  const [otherDedTarget, setOtherDedTarget] =
    useState<PayrollBreakdownExtended | null>(null);
  const [otherDedAmount, setOtherDedAmount] = useState("");
  const [otherDedSaving, setOtherDedSaving] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [payslipTarget, setPayslipTarget] =
    useState<PayrollBreakdownExtended | null>(null);

  // Dual-key empMap: keyed by both e.id (internal UUID) AND e.employeeId (human code e.g. EMP001)
  // This handles cases where payroll records may reference either key depending on migration state
  const empMap: Record<string, Employee> = (() => {
    const map: Record<string, Employee> = {};
    for (const e of employees) {
      if (e.id) map[e.id] = e;
      if (e.employeeId) map[e.employeeId] = e;
    }
    return map;
  })();

  // Canister-first load: always sync from backend before reading localStorage.
  // This guarantees Browser 2 (fresh/incognito) gets identical data to Browser 1.
  const loadPayroll = useCallback(async () => {
    setLoading(true);
    setPayrollError(null);
    try {
      // Sync from canister first — populates localStorage with canonical backend data
      await canisterPayroll.syncPayrollFromCanister();
    } catch (e) {
      console.error("[Payroll] Canister sync failed:", e);
      // Show explicit error instead of zero/empty payroll
      setPayrollError(
        "Failed to load payroll from backend. Please refresh and try again.",
      );
      setLoading(false);
      return;
    }
    // Now read from localStorage (which is now populated from canister)
    setBreakdowns(
      payrollStorage.getPayrollWithBreakdown(BigInt(month), BigInt(year)),
    );
    setSummary(payrollStorage.getPayrollSummary(BigInt(month), BigInt(year)));
    setLoading(false);
  }, [month, year]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: attendanceSynced intentionally re-triggers payroll load after backend sync
  useEffect(() => {
    void loadPayroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadPayroll, attendanceSynced]);

  // Auto-compute net pay in override form
  const computedNetPay = useMemo(() => {
    if (!overrideForm) return 0;
    return computeNetFromForm(overrideForm);
  }, [overrideForm]);

  const generate = useCallback(
    async (overwrite = false) => {
      setGenerating(true);
      try {
        const res = overwrite
          ? await canisterPayroll.overwriteAndSavePayroll(month, year)
          : await canisterPayroll.generateAndSavePayroll(month, year);
        addToast(
          `Generated for ${String(res.generatedCount)} employees`,
          "success",
        );
        void loadPayroll();
        setOverwriteOpen(false);
      } catch (err: any) {
        const msg: string = err?.message ?? "";
        if (msg.includes("NO_EMPLOYEES")) {
          addToast(
            "No employees found for this company. Please add employees first.",
            "error",
          );
        } else if (msg.includes("NO_ATTENDANCE")) {
          const MONTHS = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
          ];
          addToast(
            `No attendance found for ${MONTHS[month - 1]} ${year}. Please enter attendance before generating payroll.`,
            "error",
          );
        } else if (msg.includes("ALREADY_EXISTS")) {
          addToast(
            "Payroll already exists for all employees this month. Use Re-generate to overwrite.",
            "info",
          );
        } else {
          addToast(`Generation failed: ${msg || "Unknown error"}`, "error");
        }
      } finally {
        setGenerating(false);
      }
    },
    [month, year, addToast, loadPayroll],
  );

  const handleGenerate = useCallback(() => {
    if (breakdowns.length > 0) setOverwriteOpen(true);
    else generate(false);
  }, [breakdowns.length, generate]);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openOverride = (bd: PayrollBreakdownExtended) => {
    const r = bd.record;
    setOverrideTarget(bd);
    setOverrideForm({
      basicSalary: r.basicSalary.toFixed(2),
      hra: r.hra.toFixed(2),
      conveyance: r.conveyance.toFixed(2),
      specialAllowance: r.specialAllowance.toFixed(2),
      otherAllowance: r.otherAllowance.toFixed(2),
      otAmount: r.otAmount.toFixed(2),
      advanceDeduction: (r.advanceDeduction ?? 0).toFixed(2),
      otherDeduction: (r.otherDeduction ?? 0).toFixed(2),
      pfDeduction: r.pfDeduction.toFixed(2),
      esiDeduction: r.esiDeduction.toFixed(2),
      ptDeduction: (r.ptDeduction ?? 0).toFixed(2),
    });
  };

  const handleOverrideSave = useCallback(async () => {
    if (!overrideTarget || !overrideForm) return;
    const r = overrideTarget.record;
    const p = (k: keyof OverrideForm) =>
      Number.parseFloat(overrideForm[k]) || 0;
    setOverrideSaving(true);
    const ok = await canisterPayroll.manualOverrideAndSync(
      r.employeeId,
      BigInt(month),
      BigInt(year),
      p("basicSalary"),
      p("hra"),
      p("conveyance"),
      p("specialAllowance"),
      p("otherAllowance"),
      p("otAmount"),
      p("advanceDeduction"),
      p("otherDeduction"),
      p("pfDeduction"),
      p("esiDeduction"),
      p("ptDeduction"),
      computedNetPay,
      "admin",
    );
    if (ok) {
      addToast("Payroll updated", "success");
      setOverrideTarget(null);
      void loadPayroll();
    } else {
      addToast("Update failed", "error");
    }
    setOverrideSaving(false);
  }, [
    overrideTarget,
    overrideForm,
    computedNetPay,
    month,
    year,
    addToast,
    loadPayroll,
  ]);

  const handlePtSave = useCallback(async () => {
    if (!ptTarget) return;
    setPtSaving(true);
    const parsedPT = Number.parseFloat(ptAmount);
    if (Number.isNaN(parsedPT) || parsedPT < 0) {
      addToast("PT cannot be negative", "error");
      setPtSaving(false);
      return;
    }
    const ok = await canisterPayroll.setPTAndSync(
      ptTarget.record.employeeId,
      BigInt(month),
      BigInt(year),
      parsedPT,
    );
    if (ok) {
      addToast("PT updated", "success");
      setPtTarget(null);
      void loadPayroll();
    } else {
      addToast("PT update failed", "error");
    }
    setPtSaving(false);
  }, [ptTarget, ptAmount, month, year, addToast, loadPayroll]);

  const handleAdvSave = useCallback(async () => {
    if (!advTarget) return;
    const parsed = Number.parseFloat(advAmount);
    if (Number.isNaN(parsed) || parsed < 0) {
      addToast("Advance cannot be negative", "error");
      return;
    }
    setAdvSaving(true);
    const ok = await canisterPayroll.setAdvanceAndSync(
      advTarget.record.employeeId,
      BigInt(month),
      BigInt(year),
      parsed,
    );
    if (ok) {
      addToast("Advance deduction updated — Net Pay recalculated", "success");
      setAdvTarget(null);
      void loadPayroll();
    } else {
      addToast("Update failed", "error");
    }
    setAdvSaving(false);
  }, [advTarget, advAmount, month, year, addToast, loadPayroll]);

  const handleOtherDedSave = useCallback(async () => {
    if (!otherDedTarget) return;
    setOtherDedSaving(true);
    const parsedOther = Number.parseFloat(otherDedAmount);
    if (Number.isNaN(parsedOther) || parsedOther < 0) {
      addToast("Other deduction cannot be negative", "error");
      setOtherDedSaving(false);
      return;
    }
    const ok = await canisterPayroll.setOtherDedAndSync(
      otherDedTarget.record.employeeId,
      BigInt(month),
      BigInt(year),
      parsedOther,
    );
    if (ok) {
      addToast("Other deduction updated — Net Pay recalculated", "success");
      setOtherDedTarget(null);
      void loadPayroll();
    } else {
      addToast("Update failed", "error");
    }
    setOtherDedSaving(false);
  }, [otherDedTarget, otherDedAmount, month, year, addToast, loadPayroll]);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ShieldX className="w-12 h-12 text-gray-300 mb-3" />
        <h3 className="text-lg font-semibold text-gray-700">Access Denied</h3>
        <p className="text-sm text-gray-500">
          Payroll is restricted to administrators.
        </p>
        <a href="/admin/login" className="mt-3 text-sm text-blue-600 underline">
          Login as Admin
        </a>
      </div>
    );
  }

  const monthLabel = `${MONTHS[month - 1]} ${year}`;

  const totals = breakdowns.reduce(
    (acc, bd) => ({
      presentDays: acc.presentDays + bd.presentDays,
      halfDays: acc.halfDays + bd.halfDays,
      lopDays: acc.lopDays + bd.lopDays,
      paidDays: acc.paidDays + bd.paidDays,
      otHours: acc.otHours + bd.otHours,
      fullMonthlyGross: acc.fullMonthlyGross + bd.fullMonthlyGross,
      earnedBasic: acc.earnedBasic + bd.earnedBasic,
      earnedHRA: acc.earnedHRA + bd.earnedHRA,
      earnedAllowances: acc.earnedAllowances + bd.earnedAllowances,
      earnedGross: acc.earnedGross + bd.earnedGross,
      otPay: acc.otPay + bd.record.otAmount,
      finalGross: acc.finalGross + bd.record.grossPay,
      pf: acc.pf + bd.record.pfDeduction,
      esi: acc.esi + bd.record.esiDeduction,
      pt: acc.pt + (bd.record.ptDeduction ?? 0),
      advance: acc.advance + (bd.record.advanceDeduction ?? 0),
      otherDed: acc.otherDed + (bd.record.otherDeduction ?? 0),
      net: acc.net + bd.record.netPay,
    }),
    {
      presentDays: 0,
      halfDays: 0,
      lopDays: 0,
      paidDays: 0,
      otHours: 0,
      fullMonthlyGross: 0,
      earnedBasic: 0,
      earnedHRA: 0,
      earnedAllowances: 0,
      earnedGross: 0,
      otPay: 0,
      finalGross: 0,
      pf: 0,
      esi: 0,
      pt: 0,
      advance: 0,
      otherDed: 0,
      net: 0,
    },
  );

  const headers = [
    "Employee",
    "Present",
    "Half",
    "LOP",
    "Paid Days",
    "OT Hrs",
    "Monthly Gross",
    "Earned Basic",
    "Earned HRA",
    "Earned Allow.",
    "Earned Gross",
    "OT Pay",
    "Final Gross",
    "PF (12% Basic)",
    "ESI",
    "PT ✏",
    "Advance ✏",
    "Other Ded. ✏",
    "Net Pay",
    "",
  ];

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Month/Year selector */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <p className="text-xs font-medium text-gray-600 mb-1">Month</p>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"
              data-ocid="payroll.select"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-600 mb-1">Year</p>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-24 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"
              data-ocid="payroll.input"
            />
          </div>
          <Button
            onClick={handleGenerate}
            disabled={generating}
            data-ocid="payroll.primary_button"
          >
            <IndianRupee className="w-4 h-4 mr-1" />
            {generating
              ? "Generating..."
              : breakdowns.length > 0
                ? "Re-generate Payroll"
                : "Generate Payroll"}
          </Button>
        </div>
      </div>

      {/* Backend error banner — shown instead of zeros when canister is unreachable */}
      {payrollError && (
        <div
          className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2"
          data-ocid="payroll.error_state"
        >
          <span>⚠️</span>
          <span>{payrollError}</span>
        </div>
      )}

      {loading && <PageLoader />}

      {/* Summary cards */}
      {!payrollError && summary && Number(summary.totalEmployees) > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Employees",
              value: String(summary.totalEmployees),
              color: "text-gray-900",
            },
            {
              label: "Total Final Gross",
              value: fmt(Number(summary.totalGross)),
              color: "text-gray-900",
            },
            {
              label: "Total Deductions",
              value: fmt(Number(summary.totalDeductions)),
              color: "text-red-600",
            },
            {
              label: "Net Pay",
              value: fmt(Number(summary.totalNetPay)),
              color: "text-green-700",
            },
          ].map((c) => (
            <div
              key={c.label}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-5"
            >
              <p className="text-xs text-gray-500 mb-1">{c.label}</p>
              <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Formula note */}
      {!payrollError && breakdowns.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-700 leading-relaxed">
          <strong>Payroll Formula:</strong> Earned = (Monthly Component / Total
          Days) x Paid Days &nbsp;|&nbsp;{" "}
          <strong>PF = 12% of Earned Basic only</strong>
          &nbsp;|&nbsp; ESI = 0.75% of Final Gross &nbsp;|&nbsp; Net = Final
          Gross - PF - ESI - PT - Advance - Other Ded. &nbsp;|&nbsp;
          <strong> Click ✏ columns to set deductions inline.</strong> Click any
          row to expand formula.
        </div>
      )}

      {/* No payroll generated yet — shown only when canister is reachable but has no data */}
      {!payrollError && !loading && breakdowns.length === 0 && (
        <div
          className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center"
          data-ocid="payroll.empty_state"
        >
          <IndianRupee className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">
            No payroll generated for {monthLabel}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Click &quot;Generate Payroll&quot; to run payroll for this month.
          </p>
        </div>
      )}

      {/* Payroll table */}
      {!payrollError && breakdowns.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-700">
              Payroll Detail -- {monthLabel}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" data-ocid="payroll.table">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {headers.map((h) => (
                    <th
                      key={h}
                      className="px-3 py-3 font-medium text-gray-500 text-left whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {breakdowns.map((bd, idx) => {
                  const rec = bd.record;
                  const emp = empMap[rec.employeeId];
                  const isExpanded = expandedRows.has(rec.id);
                  return (
                    <React.Fragment key={rec.id}>
                      <tr
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleRow(rec.id)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && toggleRow(rec.id)
                        }
                        data-ocid={`payroll.item.${idx + 1}`}
                      >
                        <td className="px-3 py-3 font-medium text-gray-900 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            {isExpanded ? (
                              <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
                            ) : (
                              <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" />
                            )}
                            <span>{emp?.name ?? rec.employeeId}</span>
                          </div>
                          {emp && (
                            <span className="block text-xs text-gray-400 font-normal pl-4">
                              {emp.employeeId}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-gray-600 text-center">
                          {bd.presentDays}
                        </td>
                        <td className="px-3 py-3 text-gray-600 text-center">
                          {bd.halfDays}
                        </td>
                        <td className="px-3 py-3 text-orange-500 text-center">
                          {bd.lopDays.toFixed(2)}
                        </td>
                        <td className="px-3 py-3 text-blue-600 font-medium text-center">
                          {bd.paidDays.toFixed(2)}
                        </td>
                        <td className="px-3 py-3 text-gray-600 text-center">
                          {bd.otHours}h
                        </td>
                        <td className="px-3 py-3 text-right text-blue-700 font-semibold">
                          {fmt(bd.fullMonthlyGross)}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-600">
                          {fmt(bd.earnedBasic)}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-600">
                          {fmt(bd.earnedHRA)}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-600">
                          {fmt(bd.earnedAllowances)}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-700 font-medium">
                          {fmt(bd.earnedGross)}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-600">
                          {fmt(rec.otAmount)}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-800 font-semibold">
                          {fmt(rec.grossPay)}
                        </td>
                        <td className="px-3 py-3 text-right text-red-500">
                          {fmt(rec.pfDeduction)}
                        </td>
                        <td className="px-3 py-3 text-right text-red-500">
                          {fmt(rec.esiDeduction)}
                        </td>
                        <td className="px-3 py-3 text-right text-orange-500">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPtTarget(bd);
                              setPtAmount(String(rec.ptDeduction ?? 0));
                            }}
                            title="Click to set PT"
                            className="text-orange-500 hover:underline hover:text-orange-700"
                          >
                            {fmt(rec.ptDeduction ?? 0)}
                          </button>
                        </td>
                        <td className="px-3 py-3 text-right text-orange-600">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAdvTarget(bd);
                              setAdvAmount(String(rec.advanceDeduction ?? 0));
                            }}
                            title="Click to set Advance deduction"
                            className="text-orange-600 hover:underline hover:text-orange-800 font-medium"
                          >
                            {fmt(rec.advanceDeduction ?? 0)}
                          </button>
                        </td>
                        <td className="px-3 py-3 text-right text-orange-600">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOtherDedTarget(bd);
                              setOtherDedAmount(
                                String(rec.otherDeduction ?? 0),
                              );
                            }}
                            title="Click to set Other Deductions"
                            className="text-orange-600 hover:underline hover:text-orange-800"
                          >
                            {fmt(rec.otherDeduction ?? 0)}
                          </button>
                        </td>
                        <td className="px-3 py-3 text-right text-green-700 font-bold">
                          {fmt(rec.netPay)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPayslipTarget(bd);
                              }}
                              title="Generate Payslip"
                              className="p-1.5 rounded hover:bg-blue-50 text-blue-400 hover:text-blue-600"
                              data-ocid="payslip.open_modal_button"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openOverride(bd);
                              }}
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td
                            colSpan={headers.length}
                            className="px-4 pb-4 pt-0 bg-slate-50"
                          >
                            <CalcSummaryPanel
                              bd={bd}
                              empName={emp?.name ?? rec.employeeId}
                              monthLabel={monthLabel}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                  <td className="px-3 py-3 text-gray-700">Totals</td>
                  <td className="px-3 py-3 text-center text-gray-700">
                    {totals.presentDays}
                  </td>
                  <td className="px-3 py-3 text-center text-gray-700">
                    {totals.halfDays}
                  </td>
                  <td className="px-3 py-3 text-center text-orange-500">
                    {totals.lopDays.toFixed(2)}
                  </td>
                  <td className="px-3 py-3 text-center text-blue-600">
                    {totals.paidDays.toFixed(2)}
                  </td>
                  <td className="px-3 py-3 text-center text-gray-700">
                    {totals.otHours}h
                  </td>
                  <td className="px-3 py-3 text-right text-blue-700">
                    {fmt(totals.fullMonthlyGross)}
                  </td>
                  <td className="px-3 py-3 text-right text-gray-700">
                    {fmt(totals.earnedBasic)}
                  </td>
                  <td className="px-3 py-3 text-right text-gray-700">
                    {fmt(totals.earnedHRA)}
                  </td>
                  <td className="px-3 py-3 text-right text-gray-700">
                    {fmt(totals.earnedAllowances)}
                  </td>
                  <td className="px-3 py-3 text-right text-gray-700">
                    {fmt(totals.earnedGross)}
                  </td>
                  <td className="px-3 py-3 text-right text-gray-700">
                    {fmt(totals.otPay)}
                  </td>
                  <td className="px-3 py-3 text-right text-gray-800">
                    {fmt(totals.finalGross)}
                  </td>
                  <td className="px-3 py-3 text-right text-red-600">
                    {fmt(totals.pf)}
                  </td>
                  <td className="px-3 py-3 text-right text-red-600">
                    {fmt(totals.esi)}
                  </td>
                  <td className="px-3 py-3 text-right text-orange-600">
                    {fmt(totals.pt)}
                  </td>
                  <td className="px-3 py-3 text-right text-orange-600">
                    {fmt(totals.advance)}
                  </td>
                  <td className="px-3 py-3 text-right text-orange-600">
                    {fmt(totals.otherDed)}
                  </td>
                  <td className="px-3 py-3 text-right text-green-700">
                    {fmt(totals.net)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={overwriteOpen}
        onClose={() => setOverwriteOpen(false)}
        onConfirm={() => generate(true)}
        title="Overwrite Payroll"
        message={`Payroll for ${monthLabel} already exists. This will delete and regenerate it. Continue?`}
        confirmLabel="Overwrite"
        danger
        loading={generating}
      />

      {/* Manual Override Dialog */}
      <Dialog
        open={!!overrideTarget}
        onOpenChange={(o) => !o && setOverrideTarget(null)}
      >
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Manual Override --{" "}
              {empMap[overrideTarget?.record.employeeId ?? ""]?.name ?? ""}
            </DialogTitle>
          </DialogHeader>
          {overrideForm && (
            <div className="space-y-3 py-2">
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                Changes are recorded in the audit trail. Net Pay is
                auto-calculated from formula.
              </p>
              {(
                [
                  ["basicSalary", "Earned Basic"],
                  ["hra", "Earned HRA"],
                  ["conveyance", "Earned Conveyance"],
                  ["specialAllowance", "Earned Special Allow."],
                  ["otherAllowance", "Earned Other Allow."],
                  ["otAmount", "OT Pay"],
                  ["pfDeduction", "PF Deduction"],
                  ["esiDeduction", "ESI Deduction"],
                  ["ptDeduction", "PT Deduction"],
                  ["advanceDeduction", "Advance Deduction"],
                  ["otherDeduction", "Other Deductions"],
                ] as [keyof OverrideForm, string][]
              ).map(([key, label]) => (
                <div key={key} className="grid grid-cols-2 gap-3 items-center">
                  <Label className="text-xs">{label}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={overrideForm[key]}
                    onChange={(e) =>
                      setOverrideForm((f) =>
                        f ? { ...f, [key]: e.target.value } : f,
                      )
                    }
                    className="text-sm"
                  />
                </div>
              ))}
              {/* Auto-computed Net Pay */}
              <div className="grid grid-cols-2 gap-3 items-center border-t pt-3">
                <Label className="text-xs font-bold text-green-700">
                  Net Pay (computed)
                </Label>
                <div className="text-sm font-bold text-green-700 px-3 py-2 bg-green-50 rounded-lg">
                  {fmt(computedNetPay)}
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOverrideTarget(null)}>
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
            <Button onClick={handleOverrideSave} disabled={overrideSaving}>
              {overrideSaving ? "Saving..." : "Save Override"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* PT Dialog */}
      <Dialog open={!!ptTarget} onOpenChange={(o) => !o && setPtTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Set Professional Tax (PT)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-600">
              Employee:{" "}
              <strong>
                {empMap[ptTarget?.record.employeeId ?? ""]?.name ?? ""}
              </strong>
            </p>
            <div>
              <Label htmlFor="pt-amount">PT Amount (₹)</Label>
              <Input
                id="pt-amount"
                type="number"
                min="0"
                value={ptAmount}
                onChange={(e) => setPtAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePtSave()}
              />
            </div>
            <p className="text-xs text-gray-400">
              Net Pay will be automatically recalculated after saving.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPtTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handlePtSave} disabled={ptSaving}>
              {ptSaving ? "Saving..." : "Set PT"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Advance Deduction Dialog */}
      <Dialog open={!!advTarget} onOpenChange={(o) => !o && setAdvTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Set Advance Deduction</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-600">
              Employee:{" "}
              <strong>
                {empMap[advTarget?.record.employeeId ?? ""]?.name ?? ""}
              </strong>
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-700">
              Final Gross:{" "}
              <strong>{fmt(advTarget?.record.grossPay ?? 0)}</strong>
              &nbsp;|&nbsp; This amount will be deducted from Final Gross to
              compute Net Pay.
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
              Current Advance:{" "}
              <strong>{fmt(advTarget?.record.advanceDeduction ?? 0)}</strong>
            </div>
            <div>
              <Label htmlFor="adv-amount">Advance Amount (₹)</Label>
              <Input
                id="adv-amount"
                type="number"
                min="0"
                value={advAmount}
                onChange={(e) => setAdvAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdvSave()}
              />
            </div>
            <p className="text-xs text-gray-400">
              Net Pay = Final Gross - PF - ESI - PT - <strong>Advance</strong> -
              Other Ded.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAdvTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleAdvSave} disabled={advSaving}>
              {advSaving ? "Saving..." : "Set Advance"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Other Deductions Dialog */}
      <Dialog
        open={!!otherDedTarget}
        onOpenChange={(o) => !o && setOtherDedTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Set Other Deductions</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-600">
              Employee:{" "}
              <strong>
                {empMap[otherDedTarget?.record.employeeId ?? ""]?.name ?? ""}
              </strong>
            </p>
            <div>
              <Label htmlFor="othded-amount">Other Deductions (₹)</Label>
              <Input
                id="othded-amount"
                type="number"
                min="0"
                value={otherDedAmount}
                onChange={(e) => setOtherDedAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleOtherDedSave()}
              />
            </div>
            <p className="text-xs text-gray-400">
              Net Pay = Final Gross - PF - ESI - PT - Advance -{" "}
              <strong>Other Ded.</strong>
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOtherDedTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleOtherDedSave} disabled={otherDedSaving}>
              {otherDedSaving ? "Saving..." : "Set Deduction"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payslip Modal — render even if employee not found in empMap (use fallback) */}
      {payslipTarget && (
        <PayslipModal
          open={!!payslipTarget}
          onClose={() => setPayslipTarget(null)}
          bd={payslipTarget}
          employee={
            empMap[payslipTarget.record.employeeId] ??
            ({
              id: payslipTarget.record.employeeId,
              employeeId: payslipTarget.record.employeeId,
              name: empMap[payslipTarget.record.employeeId]?.name ?? "Employee",
              mobile: "",
              site: "",
              tradeId: "",
              departmentId: "",
              status: "active",
              salaryMode: "auto",
              cityType: "non-metro",
              basicSalary: 0,
              hra: 0,
              conveyance: 0,
              specialAllowance: 0,
              otherAllowance: 0,
              otRate: 0,
              pfApplicable: false,
              esiApplicable: false,
              aadhaarNumber: "",
              panNumber: "",
              uanNumber: "",
              esiNumber: "",
              bankAccountHolderName: "",
              bankAccountNumber: "",
              ifscCode: "",
              bankName: "",
              branchAddress: "",
              dateOfJoining: "",
              createdAt: BigInt(0),
            } as Employee)
          }
          monthLabel={`${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][month - 1]} ${year}`}
          month={month}
          year={year}
        />
      )}
    </div>
  );
}
