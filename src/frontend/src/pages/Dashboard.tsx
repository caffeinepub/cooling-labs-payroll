import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  Heart,
  IndianRupee,
  RefreshCw,
  Shield,
  TrendingDown,
  Users,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { useAppContext } from "../context/AppContext";
import type { PayrollBreakdownExtended } from "../services/payrollStorage";
import { getPayrollWithBreakdown } from "../services/payrollStorage";
import { getEmployees } from "../services/workforceStorage";

// ── INR formatter ─────────────────────────────────────────────────────────────
const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function fmt(value: number): string {
  return inr.format(value);
}

const MONTH_NAMES = [
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

// ── KPI Card ───────────────────────────────────────────────────────────────────
function KpiCard({
  title,
  value,
  sub,
  icon,
  iconBg,
  iconColor,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div
      className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm flex flex-col gap-3"
      data-ocid="dashboard.card"
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-gray-500 leading-tight">
          {title}
        </p>
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}
        >
          <span className={iconColor}>{icon}</span>
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1 truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ── Payroll row for Recent Payroll Runs table ──────────────────────────────────
interface PayrollRunRow {
  month: number;
  year: number;
  label: string;
  employeeCount: number;
  totalGross: number;
  totalNet: number;
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export function Dashboard() {
  const { activeEmployees } = useAppContext();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // KPI values
  const [latestBreakdown, setLatestBreakdown] = useState<
    PayrollBreakdownExtended[]
  >([]);
  const [latestMonthLabel, setLatestMonthLabel] = useState("");

  // Table data
  const [recentEmployees, setRecentEmployees] = useState<
    { name: string; employeeId: string; status: string }[]
  >([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRunRow[]>([]);

  const load = useCallback(() => {
    const now = new Date();
    let foundMonth = 0;
    let foundYear = 0;
    let foundRecords: PayrollBreakdownExtended[] = [];

    // Find latest payroll month by scanning back up to 12 months
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      const records = getPayrollWithBreakdown(BigInt(m), BigInt(y));
      if (records.length > 0) {
        foundRecords = records;
        foundMonth = m;
        foundYear = y;
        break;
      }
    }

    if (foundMonth > 0) {
      setLatestBreakdown(foundRecords);
      setLatestMonthLabel(`${MONTH_NAMES[foundMonth - 1]} ${foundYear}`);
    } else {
      setLatestBreakdown([]);
      setLatestMonthLabel("");
    }

    // Recent payroll runs (last 5 months with data)
    const runs: PayrollRunRow[] = [];
    for (let i = 0; i < 24 && runs.length < 5; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      const recs = getPayrollWithBreakdown(BigInt(m), BigInt(y));
      if (recs.length > 0) {
        const totalGross = recs.reduce(
          (s, r) => s + (r.record.grossPay ?? 0),
          0,
        );
        const totalNet = recs.reduce((s, r) => s + (r.record.netPay ?? 0), 0);
        runs.push({
          month: m,
          year: y,
          label: `${MONTH_NAMES[m - 1]} ${y}`,
          employeeCount: recs.length,
          totalGross,
          totalNet,
        });
      }
    }
    setPayrollRuns(runs);

    // Recent employees (5 most recently added)
    const { allEmployees } = getEmployees();
    const sorted = [...allEmployees]
      .sort((a, b) => {
        const aT =
          typeof a.createdAt === "bigint" ? Number(a.createdAt) : a.createdAt;
        const bT =
          typeof b.createdAt === "bigint" ? Number(b.createdAt) : b.createdAt;
        return bT - aT;
      })
      .slice(0, 5)
      .map((e) => ({
        name: e.name,
        employeeId: e.employeeId,
        status: e.status,
      }));
    setRecentEmployees(sorted);

    setLoading(false);
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    load();
    setRefreshing(false);
  }, [load]);

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("clf:payroll-updated", handler);
    window.addEventListener("clf:attendance-updated", handler);
    return () => {
      window.removeEventListener("clf:payroll-updated", handler);
      window.removeEventListener("clf:attendance-updated", handler);
    };
  }, [load]);

  // Derived KPIs from latest payroll
  const totalSalaryPayout = latestBreakdown.reduce(
    (s, r) => s + (r.record.netPay ?? 0),
    0,
  );
  const totalPF = latestBreakdown.reduce((s, r) => s + (r.pfDeduction ?? 0), 0);
  const totalESI = latestBreakdown.reduce(
    (s, r) => s + (r.esiDeduction ?? 0),
    0,
  );
  const totalAdvances = latestBreakdown.reduce(
    (s, r) => s + (r.advanceDeduction ?? 0),
    0,
  );
  const activeAdvanceCases = latestBreakdown.filter(
    (r) => (r.advanceDeduction ?? 0) > 0,
  ).length;

  const hasPayroll = latestBreakdown.length > 0;
  const payrollSub = hasPayroll ? latestMonthLabel : "No payroll data";

  const now = new Date();
  const currentMonthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  return (
    <div className="space-y-6" data-ocid="dashboard.section">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {currentMonthLabel} overview
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          data-ocid="dashboard.button"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div
          className="grid grid-cols-2 md:grid-cols-3 gap-4"
          data-ocid="dashboard.loading_state"
        >
          {["s1", "s2", "s3", "s4", "s5", "s6"].map((k) => (
            <div
              key={k}
              className="bg-white rounded-xl border border-gray-100 p-5 h-28 animate-pulse"
            >
              <div className="h-3 w-24 bg-gray-100 rounded mb-3" />
              <div className="h-7 w-32 bg-gray-100 rounded mb-2" />
              <div className="h-2.5 w-20 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {/* 1. Total Employees */}
          <KpiCard
            title="Total Employees"
            value={String(activeEmployees.length)}
            sub="Active workforce"
            icon={<Users className="w-5 h-5" />}
            iconBg="bg-blue-50"
            iconColor="text-blue-600"
          />

          {/* 2. Salary Payout */}
          <KpiCard
            title="Salary Payout"
            value={hasPayroll ? fmt(totalSalaryPayout) : "—"}
            sub={payrollSub}
            icon={<IndianRupee className="w-5 h-5" />}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
          />

          {/* 3. PF Liability */}
          <KpiCard
            title="PF Liability"
            value={hasPayroll ? fmt(totalPF) : "—"}
            sub={payrollSub}
            icon={<Shield className="w-5 h-5" />}
            iconBg="bg-indigo-50"
            iconColor="text-indigo-600"
          />

          {/* 4. ESI Liability */}
          <KpiCard
            title="ESI Liability"
            value={hasPayroll ? fmt(totalESI) : "—"}
            sub={payrollSub}
            icon={<Heart className="w-5 h-5" />}
            iconBg="bg-teal-50"
            iconColor="text-teal-600"
          />

          {/* 5. Outstanding Advances */}
          <KpiCard
            title="Outstanding Advances"
            value={hasPayroll ? fmt(totalAdvances) : "—"}
            sub={payrollSub}
            icon={<TrendingDown className="w-5 h-5" />}
            iconBg="bg-orange-50"
            iconColor="text-orange-600"
          />

          {/* 6. Active Advance Cases */}
          <KpiCard
            title="Active Advance Cases"
            value={hasPayroll ? String(activeAdvanceCases) : "—"}
            sub={
              hasPayroll
                ? `${activeAdvanceCases} employee${activeAdvanceCases !== 1 ? "s" : ""} with advance`
                : payrollSub
            }
            icon={<AlertCircle className="w-5 h-5" />}
            iconBg="bg-amber-50"
            iconColor="text-amber-600"
          />
        </div>
      )}

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Employees */}
        <div
          className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm"
          data-ocid="dashboard.table"
        >
          <div className="px-5 pt-5 pb-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-800">
              Recent Employees
            </h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="text-gray-500 text-xs font-semibold uppercase tracking-wide px-5">
                  Name
                </TableHead>
                <TableHead className="text-gray-500 text-xs font-semibold uppercase tracking-wide">
                  Emp Code
                </TableHead>
                <TableHead className="text-gray-500 text-xs font-semibold uppercase tracking-wide pr-5">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentEmployees.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center text-sm text-gray-400 py-8"
                    data-ocid="dashboard.empty_state"
                  >
                    No employees yet
                  </TableCell>
                </TableRow>
              ) : (
                recentEmployees.map((emp, idx) => (
                  <TableRow
                    key={emp.employeeId}
                    className="hover:bg-gray-50"
                    data-ocid={`dashboard.row.${idx + 1}`}
                  >
                    <TableCell className="font-medium text-gray-900 text-sm px-5 py-3">
                      {emp.name}
                    </TableCell>
                    <TableCell className="text-gray-600 text-sm font-mono py-3">
                      {emp.employeeId}
                    </TableCell>
                    <TableCell className="py-3 pr-5">
                      <Badge
                        variant="outline"
                        className={
                          emp.status === "active"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 text-xs"
                            : "border-gray-200 bg-gray-50 text-gray-600 text-xs"
                        }
                      >
                        {emp.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Recent Payroll Runs */}
        <div
          className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm"
          data-ocid="dashboard.table"
        >
          <div className="px-5 pt-5 pb-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-800">
              Recent Payroll Runs
            </h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="text-gray-500 text-xs font-semibold uppercase tracking-wide px-5">
                  Period
                </TableHead>
                <TableHead className="text-gray-500 text-xs font-semibold uppercase tracking-wide">
                  Employees
                </TableHead>
                <TableHead className="text-gray-500 text-xs font-semibold uppercase tracking-wide">
                  Gross Pay
                </TableHead>
                <TableHead className="text-gray-500 text-xs font-semibold uppercase tracking-wide pr-5">
                  Net Pay
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payrollRuns.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-sm text-gray-400 py-8"
                    data-ocid="dashboard.empty_state"
                  >
                    No payroll runs yet
                  </TableCell>
                </TableRow>
              ) : (
                payrollRuns.map((run, idx) => (
                  <TableRow
                    key={`${run.year}-${run.month}`}
                    className="hover:bg-gray-50"
                    data-ocid={`dashboard.row.${idx + 1}`}
                  >
                    <TableCell className="font-medium text-gray-900 text-sm px-5 py-3">
                      {run.label}
                    </TableCell>
                    <TableCell className="text-gray-600 text-sm py-3">
                      {run.employeeCount}
                    </TableCell>
                    <TableCell className="text-gray-600 text-sm tabular-nums py-3">
                      {fmt(run.totalGross)}
                    </TableCell>
                    <TableCell className="text-emerald-700 font-semibold text-sm tabular-nums py-3 pr-5">
                      {fmt(run.totalNet)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
