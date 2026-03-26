import { FileDown, Loader2 } from "lucide-react";
import React, { useState, useCallback, useMemo } from "react";
import { ToastContainer } from "../components/ui/ToastContainer";
import { Button } from "../components/ui/button";
import { useAppContext } from "../context/AppContext";
import { useToast } from "../hooks/useToast";
import { exportXlsx } from "../lib/xlsxExport";
import * as attendanceStorage from "../services/attendanceStorage";
import * as payrollStorage from "../services/payrollStorage";

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

const REPORTS = [
  {
    key: "employee",
    title: "Employee Master",
    desc: "All employees with salary, trade, department details",
    icon: "\uD83D\uDC65",
  },
  {
    key: "attendance",
    title: "Attendance Report",
    desc: "Monthly attendance records filterable by site",
    icon: "\uD83D\uDCCB",
  },
  {
    key: "payroll",
    title: "Payroll Summary",
    desc: "Monthly payroll with gross, deductions, net pay",
    icon: "\uD83D\uDCB0",
  },
  {
    key: "pf",
    title: "PF Working Sheet",
    desc: "Employee-wise PF breakdown for the month",
    icon: "\uD83C\uDFE6",
  },
  {
    key: "esi",
    title: "ESI Working Sheet",
    desc: "Employee-wise ESI breakdown for the month",
    icon: "\uD83C\uDFE5",
  },
  {
    key: "sitelabour",
    title: "Site-wise Labour Report",
    desc: "Workforce breakdown grouped by site",
    icon: "\uD83C\uDFD7\uFE0F",
  },
];

export function Reports() {
  const { employees, trades, departments } = useAppContext();
  const { toasts, addToast, removeToast } = useToast();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [filterSite, setFilterSite] = useState("all");
  const [loading, setLoading] = useState<string | null>(null);

  const siteOptions = useMemo(
    () => Array.from(new Set(employees.map((e) => e.site).filter(Boolean))),
    [employees],
  );
  const tradeMap = useMemo(
    () => Object.fromEntries(trades.map((t) => [t.id, t.name])),
    [trades],
  );
  const deptMap = useMemo(
    () => Object.fromEntries(departments.map((d) => [d.id, d.name])),
    [departments],
  );
  const empMap = useMemo(
    () => Object.fromEntries(employees.map((e) => [e.id, e])),
    [employees],
  );

  const doExport = useCallback(
    async (key: string) => {
      setLoading(key);
      try {
        if (key === "employee") {
          if (employees.length === 0) {
            addToast("No employee data to export", "warning");
            return;
          }
          const data = employees.map((e) => ({
            "Employee ID": e.employeeId,
            Name: e.name,
            Mobile: e.mobile,
            Site: e.site,
            Trade: tradeMap[e.tradeId] ?? e.tradeId,
            Department: deptMap[e.departmentId] ?? e.departmentId,
            "Salary Mode": e.salaryMode,
            "Basic Salary": e.basicSalary,
            HRA: e.hra,
            Conveyance: e.conveyance,
            "Special Allow.": e.specialAllowance,
            "Other Allow.": e.otherAllowance,
            "OT Rate": e.otRate,
            PF: e.pfApplicable ? "Yes" : "No",
            ESI: e.esiApplicable ? "Yes" : "No",
            Status: e.status,
            // KYC / Statutory
            "Aadhaar Number": e.aadhaarNumber || "",
            "PAN Number": e.panNumber || "",
            "UAN Number": e.uanNumber || "",
            "ESI Number": e.esiNumber || "",
            // Bank Details
            "Account Holder Name": e.bankAccountHolderName || "",
            "Account Number": e.bankAccountNumber || "",
            "IFSC Code": e.ifscCode || "",
            "Bank Name": e.bankName || "",
            "Branch Address": e.branchAddress || "",
          }));
          exportXlsx(data, "Employee_Master.csv", "Employees");
          addToast("Employee Master exported", "success");
        } else if (key === "attendance") {
          const paddedMonth = String(month).padStart(2, "0");
          // Use localStorage — no canister needed
          const recs = attendanceStorage.getAttendanceByMonth(
            paddedMonth,
            String(year),
          );
          const filtered =
            filterSite === "all"
              ? recs
              : recs.filter((r) => empMap[r.employeeId]?.site === filterSite);
          if (filtered.length === 0) {
            addToast(
              `No attendance records found for ${MONTHS[month - 1]} ${year}`,
              "warning",
            );
            return;
          }
          const data = filtered.map((r) => ({
            "Employee ID": empMap[r.employeeId]?.employeeId ?? r.employeeId,
            Name: empMap[r.employeeId]?.name ?? "",
            Site: empMap[r.employeeId]?.site ?? "",
            Date: `${r.date.slice(0, 4)}-${r.date.slice(4, 6)}-${r.date.slice(6, 8)}`,
            Status: r.status,
            "OT Hours": r.otHours,
            "Punch In": r.punchIn,
            "Punch Out": r.punchOut,
            Regularized: r.isRegularized ? "Yes" : "No",
            Flagged: r.isFlagged ? "Yes" : "No",
            Source: r.changedBy,
          }));
          exportXlsx(
            data,
            `Attendance_${MONTHS[month - 1]}_${year}.csv`,
            "Attendance",
          );
          addToast("Attendance Report exported", "success");
        } else if (key === "payroll") {
          const breakdowns = payrollStorage.getPayrollWithBreakdown(
            BigInt(month),
            BigInt(year),
          );
          if (breakdowns.length === 0) {
            addToast(
              `No payroll generated for ${MONTHS[month - 1]} ${year}`,
              "warning",
            );
            return;
          }
          const data = breakdowns.map((b) => ({
            "Employee ID":
              empMap[b.record.employeeId]?.employeeId ?? b.record.employeeId,
            Name: empMap[b.record.employeeId]?.name ?? "",
            Site: empMap[b.record.employeeId]?.site ?? "",
            "Full Monthly Gross": b.fullMonthlyGross?.toFixed(2) ?? "0.00",
            "Paid Days": b.paidDays,
            "LOP Days": b.lopDays,
            "Earned Basic": b.record.basicSalary.toFixed(2),
            "Earned HRA": b.record.hra.toFixed(2),
            "Earned Allowances": (
              (b.record.conveyance ?? 0) +
              (b.record.specialAllowance ?? 0) +
              (b.record.otherAllowance ?? 0)
            ).toFixed(2),
            "OT Pay": b.record.otAmount.toFixed(2),
            "Gross Pay": b.record.grossPay.toFixed(2),
            "PF Deduction": b.record.pfDeduction.toFixed(2),
            "ESI Deduction": b.record.esiDeduction.toFixed(2),
            "PT Deduction": (b.record.ptDeduction ?? 0).toFixed(2),
            "Net Pay": b.record.netPay.toFixed(2),
          }));
          exportXlsx(
            data,
            `Payroll_Summary_${MONTHS[month - 1]}_${year}.csv`,
            "Payroll",
          );
          addToast("Payroll Summary exported", "success");
        } else if (key === "pf") {
          const breakdowns = payrollStorage.getPayrollWithBreakdown(
            BigInt(month),
            BigInt(year),
          );
          const data = breakdowns
            .filter((b) => b.record.pfDeduction > 0)
            .map((b) => ({
              "Employee ID":
                empMap[b.record.employeeId]?.employeeId ?? b.record.employeeId,
              Name: empMap[b.record.employeeId]?.name ?? "",
              Site: empMap[b.record.employeeId]?.site ?? "",
              "Earned Basic": b.record.basicSalary.toFixed(2),
              "Employee PF (12%)": b.record.pfDeduction.toFixed(2),
              "Employer PF (12%)": b.record.pfDeduction.toFixed(2),
              "Total PF": (b.record.pfDeduction * 2).toFixed(2),
            }));
          if (data.length === 0) {
            addToast("No PF records for this month", "warning");
            return;
          }
          exportXlsx(data, `PF_Working_${MONTHS[month - 1]}_${year}.csv`, "PF");
          addToast("PF Sheet exported", "success");
        } else if (key === "esi") {
          const breakdowns = payrollStorage.getPayrollWithBreakdown(
            BigInt(month),
            BigInt(year),
          );
          const data = breakdowns
            .filter((b) => b.record.esiDeduction > 0)
            .map((b) => ({
              "Employee ID":
                empMap[b.record.employeeId]?.employeeId ?? b.record.employeeId,
              Name: empMap[b.record.employeeId]?.name ?? "",
              Site: empMap[b.record.employeeId]?.site ?? "",
              "Gross Pay": b.record.grossPay.toFixed(2),
              "Employee ESI (0.75%)": b.record.esiDeduction.toFixed(2),
              "Employer ESI (3.25%)": (b.record.grossPay * 0.0325).toFixed(2),
            }));
          if (data.length === 0) {
            addToast("No ESI records for this month", "warning");
            return;
          }
          exportXlsx(
            data,
            `ESI_Working_${MONTHS[month - 1]}_${year}.csv`,
            "ESI",
          );
          addToast("ESI Sheet exported", "success");
        } else if (key === "sitelabour") {
          const siteGroups: Record<string, typeof employees> = {};
          for (const e of employees) {
            if (!siteGroups[e.site]) siteGroups[e.site] = [];
            siteGroups[e.site].push(e);
          }
          const data: object[] = [];
          for (const [site, emps] of Object.entries(siteGroups)) {
            for (const e of emps) {
              data.push({
                Site: site,
                "Employee ID": e.employeeId,
                Name: e.name,
                Trade: tradeMap[e.tradeId] ?? e.tradeId,
                Department: deptMap[e.departmentId] ?? e.departmentId,
                "Basic Salary": e.basicSalary,
                Status: e.status,
              });
            }
          }
          if (data.length === 0) {
            addToast("No data to export", "warning");
            return;
          }
          exportXlsx(data, "Site_Labour_Report.csv", "Labour");
          addToast("Site Labour Report exported", "success");
        }
      } catch (err) {
        addToast("Export failed", "error");
        console.error(err);
      } finally {
        setLoading(null);
      }
    },
    [employees, month, year, filterSite, addToast, tradeMap, deptMap, empMap],
  );

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <p className="text-xs font-medium text-gray-500 mb-3">REPORT FILTERS</p>
        <div className="flex flex-wrap gap-3">
          <div>
            <p className="text-xs text-gray-500 mb-1">Month</p>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Year</p>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-24 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"
            />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Site</p>
            <select
              value={filterSite}
              onChange={(e) => setFilterSite(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"
            >
              <option value="all">All Sites</option>
              {siteOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.map((r) => (
          <div
            key={r.key}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-5"
          >
            <div className="text-2xl mb-2">{r.icon}</div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              {r.title}
            </h3>
            <p className="text-xs text-gray-500 mb-4">{r.desc}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => doExport(r.key)}
              disabled={loading === r.key}
              className="w-full"
            >
              {loading === r.key ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />{" "}
                  Exporting...
                </>
              ) : (
                <>
                  <FileDown className="w-3.5 h-3.5 mr-1.5" /> Export CSV/Excel
                </>
              )}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
