import { CheckCircle, HardHat, IndianRupee, Lock, LogOut } from "lucide-react";
import React, { useState, useCallback, useEffect, useMemo } from "react";
import { AttendanceBadge } from "../components/ui/StatusBadge";
import { ToastContainer } from "../components/ui/ToastContainer";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useToast } from "../hooks/useToast";
import * as attendanceStorage from "../services/attendanceStorage";
import * as payrollStorage from "../services/payrollStorage";
import * as workforceStorage from "../services/workforceStorage";
import type { AttendanceRecord, Employee, Supervisor } from "../types";

const STATUS_OPTIONS = ["Present", "Absent", "HalfDay", "Leave"] as const;
type AttStatus = (typeof STATUS_OPTIONS)[number];

type LoginMode = "pin" | "password";

export function SupervisorView() {
  const { toasts, addToast, removeToast } = useToast();

  // Login state
  const [loginMode, setLoginMode] = useState<LoginMode>("password");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);

  const [supervisor, setSupervisor] = useState<Supervisor | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord[]>(
    [],
  );
  const [marking, setMarking] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"attendance" | "salary">(
    "attendance",
  );
  const [payrollMonth, setPayrollMonth] = useState(new Date().getMonth() + 1);
  const [payrollYear, setPayrollYear] = useState(new Date().getFullYear());
  const [payrollRecords, setPayrollRecords] = useState<
    {
      record: {
        employeeId: string;
        basicSalary: number;
        grossPay: number;
        pfDeduction: number;
        esiDeduction: number;
        netPay: number;
      };
    }[]
  >([]);

  const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
  const todayYear = today.slice(0, 4);
  const todayMonth = today.slice(4, 6);

  const handleVerify = useCallback(async () => {
    setVerifying(true);
    try {
      if (loginMode === "pin") {
        if (!phone.trim() || !pin.trim()) {
          addToast("Enter phone and PIN", "warning");
          return;
        }
        const valid = workforceStorage.verifySupervisorPin(
          phone.trim(),
          pin.trim(),
        );
        if (valid) {
          const sups = workforceStorage.getSupervisors();
          const sup = sups.find((s) => s.phone === phone.trim());
          if (sup) setSupervisor(sup);
          else addToast("Supervisor not found", "error");
        } else {
          addToast("Invalid phone or PIN", "error");
        }
      } else {
        if (!username.trim() || !password.trim()) {
          addToast("Enter username and password", "warning");
          return;
        }
        const sup = workforceStorage.loginSupervisorByCredentials(
          username.trim(),
          password.trim(),
        );
        if (sup) {
          setSupervisor(sup);
        } else {
          addToast("Invalid username or password", "error");
        }
      }
    } finally {
      setVerifying(false);
    }
  }, [loginMode, phone, pin, username, password, addToast]);

  useEffect(() => {
    if (!supervisor) return;
    const paddedMonth = todayMonth.padStart(2, "0");
    const empResult = supervisor.siteId
      ? workforceStorage.getEmployeesBySite(supervisor.siteId)
      : workforceStorage.getEmployees();
    setEmployees(empResult.activeEmployees);

    // Use localStorage attendance
    const allAtt = attendanceStorage.getAttendanceByMonth(
      paddedMonth,
      todayYear,
    );
    const siteEmpIds = new Set(empResult.activeEmployees.map((e) => e.id));
    const todayAtt = allAtt.filter(
      (a) => a.date === today && siteEmpIds.has(a.employeeId),
    );
    setTodayAttendance(todayAtt);
  }, [supervisor, today, todayMonth, todayYear]);

  const loadPayroll = useCallback(() => {
    if (!supervisor?.siteId) return;
    const breakdowns = payrollStorage.getPayrollWithBreakdown(
      BigInt(payrollMonth),
      BigInt(payrollYear),
    );
    // Filter to supervisor's site employees
    const { activeEmployees: siteEmps } = workforceStorage.getEmployeesBySite(
      supervisor.siteId,
    );
    const siteEmpIds = new Set(siteEmps.map((e) => e.id));
    setPayrollRecords(
      breakdowns.filter((b) => siteEmpIds.has(b.record.employeeId)),
    );
  }, [supervisor, payrollMonth, payrollYear]);

  useEffect(() => {
    if (activeTab === "salary" && supervisor) loadPayroll();
  }, [activeTab, loadPayroll, supervisor]);

  const getEmpAttendance = useCallback(
    (empId: string) => todayAttendance.find((a) => a.employeeId === empId),
    [todayAttendance],
  );

  const handleMark = useCallback(
    (empId: string, status: AttStatus) => {
      setMarking(empId);
      try {
        const source = `supervisor:${supervisor?.phone ?? supervisor?.username}`;
        const ok = attendanceStorage.markAttendance(
          empId,
          today,
          status,
          0,
          "",
          "",
          0,
          0,
          source,
        );
        if (ok) {
          setTodayAttendance((prev) => [
            ...prev,
            {
              id: Math.random().toString(36),
              employeeId: empId,
              date: today,
              status,
              otHours: 0,
              punchIn: "",
              punchOut: "",
              lat: 0,
              lng: 0,
              isFlagged: false,
              flagReason: "",
              isRegularized: false,
              regularizationReason: "",
              changedBy: source,
              updatedAt: BigInt(Date.now()),
              createdAt: BigInt(Date.now()),
            },
          ]);
          addToast(`Marked ${status}`, "success");
        } else {
          addToast("Already marked for today", "warning");
        }
      } finally {
        setMarking(null);
      }
    },
    [today, supervisor, addToast],
  );

  const markedCount = useMemo(() => todayAttendance.length, [todayAttendance]);
  const empMap = useMemo(
    () => Object.fromEntries(employees.map((e) => [e.id, e])),
    [employees],
  );

  const MONTHS = [
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

  if (!supervisor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <ToastContainer toasts={toasts} onRemove={removeToast} />
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3">
              <HardHat className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-lg font-bold text-gray-900">
              Supervisor Login
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Cooling Labs — Attendance Portal
            </p>
          </div>

          {/* Toggle login mode */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-4">
            <button
              type="button"
              onClick={() => setLoginMode("password")}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                loginMode === "password"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500"
              }`}
            >
              Username / Password
            </button>
            <button
              type="button"
              onClick={() => setLoginMode("pin")}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                loginMode === "pin"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500"
              }`}
            >
              Phone + PIN
            </button>
          </div>

          <div className="space-y-4">
            {loginMode === "password" ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="sv-user">Username</Label>
                  <Input
                    id="sv-user"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sv-pass">Password</Label>
                  <Input
                    id="sv-pass"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                    onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="sv-phone">Phone Number</Label>
                  <Input
                    id="sv-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Registered phone number"
                    type="tel"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sv-pin">4-Digit PIN</Label>
                  <Input
                    id="sv-pin"
                    type="password"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••"
                    onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                  />
                </div>
              </>
            )}
            <Button
              onClick={handleVerify}
              disabled={verifying}
              className="w-full"
            >
              <Lock className="w-4 h-4 mr-2" />
              {verifying ? "Verifying..." : "Login"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="font-bold text-gray-900">
            Supervisor: {supervisor.name}
          </p>
          <p className="text-xs text-gray-500">
            {supervisor.siteId ? `Site: ${supervisor.siteId}` : "All Sites"} —
            Today: {new Date().toLocaleDateString()}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSupervisor(null)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </div>

      <div className="p-6 space-y-4 max-w-4xl mx-auto">
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: "Employees",
              value: String(employees.length),
              color: "text-gray-900",
            },
            {
              label: "Marked Today",
              value: String(markedCount),
              color: "text-blue-700",
            },
            {
              label: "Pending",
              value: String(Math.max(0, employees.length - markedCount)),
              color: "text-orange-600",
            },
          ].map((c) => (
            <div
              key={c.label}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-4"
            >
              <p className="text-xs text-gray-500 mb-1">{c.label}</p>
              <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab("attendance")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "attendance"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Attendance
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("salary")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "salary"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <IndianRupee className="w-3.5 h-3.5 inline mr-1" />
            Salary Summary
          </button>
        </div>

        {activeTab === "attendance" && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-700">
                Employee Attendance — Today
              </p>
            </div>
            {employees.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">
                No employees assigned to your site yet.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-500">
                      Employee
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">
                      ID
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">
                      Status
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">
                      Mark
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {employees.map((emp) => {
                    const att = getEmpAttendance(emp.id);
                    return (
                      <tr key={emp.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {emp.name}
                        </td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                          {emp.employeeId}
                        </td>
                        <td className="px-4 py-3">
                          {att ? (
                            <AttendanceBadge status={att.status} />
                          ) : (
                            <span className="text-xs text-gray-400">
                              Not marked
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {att ? (
                            <span className="inline-flex items-center gap-1 text-xs text-green-600">
                              <CheckCircle className="w-3.5 h-3.5" /> Done
                            </span>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              {STATUS_OPTIONS.map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => handleMark(emp.id, s)}
                                  disabled={marking === emp.id}
                                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                    s === "Present"
                                      ? "bg-green-100 text-green-700 hover:bg-green-200"
                                      : s === "Absent"
                                        ? "bg-red-100 text-red-700 hover:bg-red-200"
                                        : s === "HalfDay"
                                          ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                  }`}
                                >
                                  {s === "HalfDay" ? "Half" : s}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "salary" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs text-gray-500 mb-2 font-medium">
                VIEW ONLY — Contact admin for payroll changes
              </p>
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Month</p>
                  <select
                    value={payrollMonth}
                    onChange={(e) => setPayrollMonth(Number(e.target.value))}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-2"
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
                    value={payrollYear}
                    onChange={(e) => setPayrollYear(Number(e.target.value))}
                    className="w-24 text-sm border border-gray-200 rounded-lg px-3 py-2"
                  />
                </div>
                <Button size="sm" onClick={loadPayroll}>
                  Load
                </Button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {payrollRecords.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-sm">
                  No payroll generated for this period.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-3 font-medium text-gray-500">
                        Employee
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">
                        Basic
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">
                        Gross
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">
                        PF
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">
                        ESI
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">
                        Net Pay
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {payrollRecords.map((b) => {
                      const emp = empMap[b.record.employeeId];
                      return (
                        <tr
                          key={b.record.employeeId}
                          className="hover:bg-gray-50"
                        >
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {emp?.name ?? b.record.employeeId}
                            {emp && (
                              <span className="block text-xs text-gray-400 font-normal">
                                {emp.employeeId}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600">
                            ₹
                            {Number(b.record.basicSalary).toLocaleString(
                              "en-IN",
                              { maximumFractionDigits: 0 },
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700 font-medium">
                            ₹
                            {Number(b.record.grossPay).toLocaleString("en-IN", {
                              maximumFractionDigits: 0,
                            })}
                          </td>
                          <td className="px-4 py-3 text-right text-red-500">
                            ₹
                            {Number(b.record.pfDeduction).toLocaleString(
                              "en-IN",
                              { maximumFractionDigits: 0 },
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-red-500">
                            ₹
                            {Number(b.record.esiDeduction).toLocaleString(
                              "en-IN",
                              { maximumFractionDigits: 0 },
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-green-700 font-bold">
                            ₹
                            {Number(b.record.netPay).toLocaleString("en-IN", {
                              maximumFractionDigits: 0,
                            })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
