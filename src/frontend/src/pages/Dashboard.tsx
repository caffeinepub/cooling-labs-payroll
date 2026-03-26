import { useNavigate } from "@tanstack/react-router";
import {
  ChevronRight,
  Clock,
  IndianRupee,
  Plus,
  TrendingUp,
  Users,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { useAppContext } from "../context/AppContext";
import * as attendanceStorage from "../services/attendanceStorage";
import * as payrollStorage from "../services/payrollStorage";
import type { PayrollSummary } from "../types";

function KpiCard({
  title,
  value,
  sub,
  icon,
  color,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}
        >
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export function Dashboard() {
  const { activeEmployees } = useAppContext();
  const navigate = useNavigate();
  const [payrollSummary, setPayrollSummary] = useState<PayrollSummary | null>(
    null,
  );
  const [otTotal, setOtTotal] = useState(0);
  const [attRate, setAttRate] = useState(0);
  const [presentCount, setPresentCount] = useState(0);
  const [totalEntries, setTotalEntries] = useState(0);

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const monthName = now.toLocaleString("default", { month: "long" });

  const load = useCallback(() => {
    // Payroll summary from localStorage
    const summary = payrollStorage.getPayrollSummary(
      BigInt(month),
      BigInt(year),
    );
    setPayrollSummary(Number(summary.totalEmployees) > 0 ? summary : null);

    // Attendance stats from localStorage
    const paddedMonth = String(month).padStart(2, "0");
    const att = attendanceStorage.getAttendanceByMonth(
      paddedMonth,
      String(year),
    );
    const present = att.filter(
      (a) => a.status === "Present" || a.status === "HalfDay",
    ).length;
    const rate = att.length > 0 ? Math.round((present / att.length) * 100) : 0;
    const ot = att.reduce((s, a) => s + (a.otHours ?? 0), 0);
    setPresentCount(present);
    setTotalEntries(att.length);
    setAttRate(rate);
    setOtTotal(ot);
  }, [month, year]);

  useEffect(() => {
    load();
    // Refresh on storage changes (e.g. when attendance or payroll is saved in another tab)
    const handler = () => load();
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-500">
            {monthName} {year} overview
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Active Employees"
          value={String(activeEmployees.length)}
          sub="Total workforce"
          icon={<Users className="w-5 h-5 text-blue-600" />}
          color="bg-blue-50"
        />
        <KpiCard
          title="Net Payroll"
          value={
            payrollSummary
              ? `₹${Number(payrollSummary.totalNetPay).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
              : "—"
          }
          sub={`${monthName} ${year}`}
          icon={<IndianRupee className="w-5 h-5 text-green-600" />}
          color="bg-green-50"
        />
        <KpiCard
          title="OT Hours"
          value={otTotal.toFixed(1)}
          sub="This month"
          icon={<Clock className="w-5 h-5 text-orange-600" />}
          color="bg-orange-50"
        />
        <KpiCard
          title="Attendance Rate"
          value={`${attRate}%`}
          sub={`${presentCount} of ${totalEntries} entries`}
          icon={<TrendingUp className="w-5 h-5 text-purple-600" />}
          color="bg-purple-50"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Quick Actions
        </h3>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigate({ to: "/employees" })}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> Add Employee
          </button>
          <button
            type="button"
            onClick={() => navigate({ to: "/attendance/bulk" })}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
          >
            <ChevronRight className="w-4 h-4" /> Bulk Attendance
          </button>
          <button
            type="button"
            onClick={() => navigate({ to: "/payroll" })}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
          >
            <ChevronRight className="w-4 h-4" /> Generate Payroll
          </button>
          <button
            type="button"
            onClick={() => navigate({ to: "/reports" })}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
          >
            <ChevronRight className="w-4 h-4" /> Reports
          </button>
        </div>
      </div>

      {payrollSummary && Number(payrollSummary.totalEmployees) > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            Payroll Summary — {monthName} {year}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500">Employees</p>
              <p className="text-lg font-bold text-gray-900">
                {String(payrollSummary.totalEmployees)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Gross</p>
              <p className="text-lg font-bold text-gray-900">
                ₹
                {Number(payrollSummary.totalGross).toLocaleString("en-IN", {
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Deductions</p>
              <p className="text-lg font-bold text-red-600">
                ₹
                {Number(payrollSummary.totalDeductions).toLocaleString(
                  "en-IN",
                  { maximumFractionDigits: 0 },
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Net Pay</p>
              <p className="text-lg font-bold text-green-700">
                ₹
                {Number(payrollSummary.totalNetPay).toLocaleString("en-IN", {
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
