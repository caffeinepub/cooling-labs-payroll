import {
  AlertCircle,
  CheckCircle,
  HardHat,
  IndianRupee,
  Lock,
  LogOut,
  PlusCircle,
  Users,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AttendanceBadge } from "../components/ui/StatusBadge";
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
import { useToast } from "../hooks/useToast";
import * as approvalsStorage from "../services/approvalsStorage";
import * as attendanceStorage from "../services/attendanceStorage";
import * as mastersStorage from "../services/mastersStorage";
import * as payrollStorage from "../services/payrollStorage";
import * as regularizationStorage from "../services/regularizationStorage";
import * as supervisorPermissionsStorage from "../services/supervisorPermissionsStorage";
import * as workforceStorage from "../services/workforceStorage";
import type {
  AttendanceRecord,
  Employee,
  Site,
  Supervisor,
  SupervisorPermissions,
} from "../types";

type LoginMode = "pin" | "password";
type PortalTab = "attendance" | "ot" | "advance" | "regularization" | "salary";

const STATUS_OPTIONS = ["Present", "Absent", "Half Day", "Leave"] as const;
type AttStatus = (typeof STATUS_OPTIONS)[number];

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

const STATUS_VALUES = [
  "Present",
  "Absent",
  "HalfDay",
  "Half Day",
  "Leave",
  "Weekly Off",
  "Holiday",
];

function PermissionBlock({
  children,
  allowed,
  label,
}: { children: React.ReactNode; allowed: boolean; label?: string }) {
  if (allowed) return <>{children}</>;
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center bg-gray-50 rounded-xl border border-gray-200">
      <Lock className="w-8 h-8 text-gray-300 mb-2" />
      <p className="text-sm text-gray-500">{label ?? "Not permitted"}</p>
      <p className="text-xs text-gray-400 mt-1">
        Contact admin to enable access
      </p>
    </div>
  );
}

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
  const [assignedSite, setAssignedSite] = useState<Site | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [permissions, setPermissions] = useState<SupervisorPermissions>(
    supervisorPermissionsStorage.DEFAULT_PERMISSIONS,
  );
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord[]>(
    [],
  );
  const [marking, setMarking] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PortalTab>("attendance");
  const [attDate, setAttDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  // OT dialog
  const [otOpen, setOtOpen] = useState(false);
  const [otEmpId, setOtEmpId] = useState("");
  const [otDate, setOtDate] = useState(new Date().toISOString().split("T")[0]);
  const [otHours, setOtHours] = useState("");
  const [otReason, setOtReason] = useState("");
  const [otSaving, setOtSaving] = useState(false);

  // Advance dialog
  const [advOpen, setAdvOpen] = useState(false);
  const [advEmpId, setAdvEmpId] = useState("");
  const [advMonth, setAdvMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [advAmount, setAdvAmount] = useState("");
  const [advReason, setAdvReason] = useState("");
  const [advSaving, setAdvSaving] = useState(false);

  // Regularization dialog
  const [regOpen, setRegOpen] = useState(false);
  const [regEmpId, setRegEmpId] = useState("");
  const [regDate, setRegDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [regType, setRegType] = useState<
    "status" | "ot" | "advance" | "combined"
  >("status");
  const [regOldStatus, setRegOldStatus] = useState("Absent");
  const [regNewStatus, setRegNewStatus] = useState("Present");
  const [regOldOT, setRegOldOT] = useState("");
  const [regNewOT, setRegNewOT] = useState("");
  const [regOldAdv, setRegOldAdv] = useState("");
  const [regNewAdv, setRegNewAdv] = useState("");
  const [regReason, setRegReason] = useState("");
  const [regSaving, setRegSaving] = useState(false);

  // Payroll
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

  // Request lists
  const [otRequests, setOtRequests] = useState<
    ReturnType<typeof approvalsStorage.getApprovalRequests>
  >([]);
  const [advRequests, setAdvRequests] = useState<
    ReturnType<typeof approvalsStorage.getApprovalRequests>
  >([]);
  const [regRequests, setRegRequests] = useState<
    ReturnType<typeof regularizationStorage.getRegularizationRequests>
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

  // Resolve site and employees when supervisor logs in
  useEffect(() => {
    if (!supervisor) return;

    // Load permissions
    const perms = supervisorPermissionsStorage.getPermissionsForSupervisor(
      supervisor.phone,
    );
    setPermissions(perms);

    // Resolve site
    const allSites = mastersStorage.getSites().sites;
    const foundSite = allSites.find(
      (s) =>
        s.id === supervisor.siteId ||
        s.name === supervisor.siteId ||
        s.siteCode === supervisor.siteId,
    );
    setAssignedSite(foundSite ?? null);

    // Resolve employees using site NAME (not ID)
    const siteNameToMatch = foundSite?.name ?? supervisor.siteId;
    const allEmps = workforceStorage.getEmployees().activeEmployees;
    const siteEmployees = allEmps.filter(
      (e) =>
        e.site === siteNameToMatch ||
        e.site === supervisor.siteId ||
        (foundSite &&
          (e.site === foundSite.name ||
            e.site === foundSite.id ||
            e.site === foundSite.siteCode)),
    );
    console.debug(
      "[SupervisorPortal] supervisor.siteId:",
      supervisor.siteId,
      "| resolved site:",
      foundSite?.name,
      "| employees found:",
      siteEmployees.length,
    );
    setEmployees(siteEmployees);
  }, [supervisor]);

  // Load today's attendance when employees or date changes
  useEffect(() => {
    if (!supervisor || employees.length === 0) return;
    const dateKey = attDate.replace(/-/g, "");
    const year = dateKey.slice(0, 4);
    const month = dateKey.slice(4, 6);
    const allAtt = attendanceStorage.getAttendanceByMonth(month, year);
    const siteEmpIds = new Set(employees.map((e) => e.id));
    setTodayAttendance(
      allAtt.filter((a) => a.date === dateKey && siteEmpIds.has(a.employeeId)),
    );
  }, [supervisor, employees, attDate]);

  // Load today's attendance for today's summary
  const todayAtt = useMemo(() => {
    const siteEmpIds = new Set(employees.map((e) => e.id));
    const allAtt = attendanceStorage.getAttendanceByMonth(
      todayMonth,
      todayYear,
    );
    return allAtt.filter(
      (a) => a.date === today && siteEmpIds.has(a.employeeId),
    );
  }, [employees, today, todayMonth, todayYear]);

  // Load request lists
  const loadRequests = useCallback(() => {
    if (!supervisor) return;
    const supId = supervisor.phone;
    const all = approvalsStorage
      .getApprovalRequests()
      .filter((r) => r.requestedBy === supId);
    setOtRequests(all.filter((r) => r.requestType === "ot_request"));
    setAdvRequests(all.filter((r) => r.requestType === "advance_request"));
    setRegRequests(
      regularizationStorage
        .getRegularizationRequests()
        .filter((r) => r.requestedBy === supId),
    );
  }, [supervisor]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const loadPayroll = useCallback(() => {
    if (!employees.length) return;
    const breakdowns = payrollStorage.getPayrollWithBreakdown(
      BigInt(payrollMonth),
      BigInt(payrollYear),
    );
    const empIds = new Set(employees.map((e) => e.id));
    setPayrollRecords(
      breakdowns.filter((b) => empIds.has(b.record.employeeId)),
    );
  }, [employees, payrollMonth, payrollYear]);

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
        const dateKey = attDate.replace(/-/g, "");
        const source = `supervisor:${supervisor?.phone ?? supervisor?.username}`;
        const ok = attendanceStorage.markAttendance(
          empId,
          dateKey,
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
              date: dateKey,
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
          addToast("Already marked for this date", "warning");
        }
      } finally {
        setMarking(null);
      }
    },
    [attDate, supervisor, addToast],
  );

  const handleBulkPresent = useCallback(() => {
    const dateKey = attDate.replace(/-/g, "");
    const source = `supervisor:${supervisor?.phone ?? supervisor?.username}`;
    let count = 0;
    for (const emp of employees) {
      const exists = todayAttendance.some((a) => a.employeeId === emp.id);
      if (!exists) {
        attendanceStorage.markAttendance(
          emp.id,
          dateKey,
          "Present",
          0,
          "",
          "",
          0,
          0,
          source,
        );
        count++;
      }
    }
    // Reload
    const year = dateKey.slice(0, 4);
    const month = dateKey.slice(4, 6);
    const allAtt = attendanceStorage.getAttendanceByMonth(month, year);
    const siteEmpIds = new Set(employees.map((e) => e.id));
    setTodayAttendance(
      allAtt.filter((a) => a.date === dateKey && siteEmpIds.has(a.employeeId)),
    );
    addToast(`Bulk marked ${count} employees as Present`, "success");
  }, [attDate, employees, todayAttendance, supervisor, addToast]);

  const handleSubmitOT = useCallback(() => {
    if (!otEmpId || !otHours || !otReason.trim()) {
      addToast("Fill all OT fields", "warning");
      return;
    }
    setOtSaving(true);
    const dateKey = otDate.replace(/-/g, "");
    const hours = Number.parseFloat(otHours);
    const supId = supervisor?.phone ?? supervisor?.username ?? "supervisor";

    if (permissions.ot.requireApproval) {
      approvalsStorage.createApprovalRequest({
        requestType: "ot_request",
        employeeId: otEmpId,
        siteId: assignedSite?.id ?? supervisor?.siteId ?? "",
        date: dateKey,
        monthRef: dateKey.slice(0, 6),
        oldValue: { otHours: 0 },
        newValue: { otHours: hours },
        reason: otReason,
        requestedBy: supId,
      });
      addToast("OT request submitted for admin approval", "success");
    } else {
      attendanceStorage.updateAttendanceOT(otEmpId, dateKey, hours, supId);
      addToast("OT updated directly", "success");
    }
    setOtOpen(false);
    setOtEmpId("");
    setOtHours("");
    setOtReason("");
    loadRequests();
    setOtSaving(false);
  }, [
    otEmpId,
    otDate,
    otHours,
    otReason,
    permissions.ot.requireApproval,
    assignedSite,
    supervisor,
    addToast,
    loadRequests,
  ]);

  const handleSubmitAdvance = useCallback(() => {
    if (!advEmpId || !advAmount || !advReason.trim()) {
      addToast("Fill all advance fields", "warning");
      return;
    }
    setAdvSaving(true);
    const monthKey = `${advMonth.replace("-", "")}01`; // YYYYMMDD fallback
    const amount = Number.parseFloat(advAmount);
    const supId = supervisor?.phone ?? supervisor?.username ?? "supervisor";

    if (permissions.advance.requireApproval) {
      approvalsStorage.createApprovalRequest({
        requestType: "advance_request",
        employeeId: advEmpId,
        siteId: assignedSite?.id ?? supervisor?.siteId ?? "",
        date: monthKey,
        monthRef: advMonth.replace("-", ""),
        oldValue: { advance: 0 },
        newValue: { advance: amount },
        reason: advReason,
        requestedBy: supId,
      });
      addToast("Advance request submitted for admin approval", "success");
    } else {
      attendanceStorage.updateAttendanceAdvance(
        advEmpId,
        monthKey,
        amount,
        supId,
      );
      addToast("Advance recorded directly", "success");
    }
    setAdvOpen(false);
    setAdvEmpId("");
    setAdvAmount("");
    setAdvReason("");
    loadRequests();
    setAdvSaving(false);
  }, [
    advEmpId,
    advMonth,
    advAmount,
    advReason,
    permissions.advance.requireApproval,
    assignedSite,
    supervisor,
    addToast,
    loadRequests,
  ]);

  const handleSubmitReg = useCallback(() => {
    if (!regEmpId || !regReason.trim()) {
      addToast("Fill required regularization fields", "warning");
      return;
    }
    setRegSaving(true);
    const dateKey = regDate.replace(/-/g, "");
    const supId = supervisor?.phone ?? supervisor?.username ?? "supervisor";
    regularizationStorage.createRegularizationRequest(
      regEmpId,
      dateKey,
      regType === "ot" ? "" : regOldStatus,
      regType === "ot" ? "" : regNewStatus,
      regReason,
      supId,
      {
        requestType: regType,
        oldOtHours: regOldOT ? Number.parseFloat(regOldOT) : undefined,
        newOtHours: regNewOT ? Number.parseFloat(regNewOT) : undefined,
        oldAdvance: regOldAdv ? Number.parseFloat(regOldAdv) : undefined,
        newAdvance: regNewAdv ? Number.parseFloat(regNewAdv) : undefined,
        siteId: assignedSite?.id ?? supervisor?.siteId ?? "",
      },
    );
    addToast("Regularization request submitted", "success");
    setRegOpen(false);
    setRegEmpId("");
    setRegReason("");
    loadRequests();
    setRegSaving(false);
  }, [
    regEmpId,
    regDate,
    regType,
    regOldStatus,
    regNewStatus,
    regOldOT,
    regNewOT,
    regOldAdv,
    regNewAdv,
    regReason,
    assignedSite,
    supervisor,
    addToast,
    loadRequests,
  ]);

  const markedToday = useMemo(() => todayAtt.length, [todayAtt]);
  const leaveAbsentToday = useMemo(
    () =>
      todayAtt.filter((a) => a.status === "Absent" || a.status === "Leave")
        .length,
    [todayAtt],
  );
  const pendingOT = useMemo(
    () => otRequests.filter((r) => r.status === "pending").length,
    [otRequests],
  );
  const pendingAdv = useMemo(
    () => advRequests.filter((r) => r.status === "pending").length,
    [advRequests],
  );
  const pendingReg = useMemo(
    () => regRequests.filter((r) => r.approvalStatus === "pending").length,
    [regRequests],
  );

  const empMap = useMemo(
    () => Object.fromEntries(employees.map((e) => [e.id, e])),
    [employees],
  );

  // Attendance filter
  const [attFilter, setAttFilter] = useState<
    "all" | "present" | "absent" | "unmarked"
  >("all");
  const filteredEmps = useMemo(() => {
    if (attFilter === "all") return employees;
    if (attFilter === "present")
      return employees.filter((e) =>
        todayAttendance.some(
          (a) =>
            a.employeeId === e.id &&
            (a.status === "Present" || a.status === "Half Day"),
        ),
      );
    if (attFilter === "absent")
      return employees.filter((e) =>
        todayAttendance.some(
          (a) =>
            a.employeeId === e.id &&
            (a.status === "Absent" || a.status === "Leave"),
        ),
      );
    return employees.filter(
      (e) => !todayAttendance.some((a) => a.employeeId === e.id),
    );
  }, [employees, todayAttendance, attFilter]);

  // LOGIN SCREEN
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

  // PORTAL
  return (
    <div className="min-h-screen bg-gray-50">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
            <HardHat className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900">{supervisor.name}</p>
            <p className="text-xs text-gray-500">
              {assignedSite?.name ?? supervisor.siteId} —{" "}
              {new Date().toLocaleDateString("en-IN")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSupervisor(null)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </div>

      <div className="p-5 max-w-5xl mx-auto space-y-5">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: "Employees",
              value: employees.length,
              color: "text-gray-800",
            },
            {
              label: "Marked Today",
              value: markedToday,
              color: "text-blue-700",
            },
            {
              label: "Pending",
              value: Math.max(0, employees.length - markedToday),
              color: "text-orange-600",
            },
            {
              label: "Leave / Absent",
              value: leaveAbsentToday,
              color: "text-red-600",
            },
            { label: "OT Pending", value: pendingOT, color: "text-purple-600" },
            {
              label: "Advance Pending",
              value: pendingAdv,
              color: "text-yellow-600",
            },
            {
              label: "Reg. Pending",
              value: pendingReg,
              color: "text-indigo-600",
            },
            {
              label: "Site Employees",
              value: employees.length,
              color: "text-teal-600",
            },
          ].map((c) => (
            <div
              key={c.label}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-3"
            >
              <p className="text-xs text-gray-500 mb-0.5">{c.label}</p>
              <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 flex-wrap">
          {[
            {
              key: "attendance" as const,
              label: "Attendance",
              show: permissions.attendance.view,
            },
            {
              key: "ot" as const,
              label: "OT Requests",
              show: permissions.ot.view,
            },
            {
              key: "advance" as const,
              label: "Advance",
              show: permissions.advance.view,
            },
            {
              key: "regularization" as const,
              label: "Regularization",
              show: permissions.regularization.raise,
            },
            {
              key: "salary" as const,
              label: "Salary",
              show: permissions.payroll.viewSummary,
            },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === t.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              } ${!t.show ? "opacity-50" : ""}`}
            >
              {t.label}
              {!t.show && (
                <Lock className="w-3 h-3 inline ml-1 text-gray-400" />
              )}
            </button>
          ))}
        </div>

        {/* ATTENDANCE TAB */}
        {activeTab === "attendance" && (
          <PermissionBlock
            allowed={permissions.attendance.view}
            label="Attendance view not permitted"
          >
            <div className="space-y-3">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap items-center gap-3 justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Date</p>
                    <input
                      type="date"
                      value={attDate}
                      onChange={(e) => setAttDate(e.target.value)}
                      className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-1">
                    {(["all", "present", "absent", "unmarked"] as const).map(
                      (f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setAttFilter(f)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                            attFilter === f
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                      ),
                    )}
                  </div>
                </div>
                {permissions.attendance.bulk && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBulkPresent}
                  >
                    <Users className="w-3.5 h-3.5 mr-1.5" /> Bulk Mark Present
                  </Button>
                )}
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {employees.length === 0 ? (
                  <div
                    className="py-12 text-center text-gray-400 text-sm"
                    data-ocid="supervisor.empty_state"
                  >
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    No employees found for your assigned site.
                    <br />
                    <span className="text-xs mt-1 block text-gray-300">
                      Site: {assignedSite?.name ?? supervisor.siteId}
                    </span>
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
                      {filteredEmps.map((emp, idx) => {
                        const att = getEmpAttendance(emp.id);
                        return (
                          <tr
                            key={emp.id}
                            className="hover:bg-gray-50"
                            data-ocid={`supervisor.item.${idx + 1}`}
                          >
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
                              ) : permissions.attendance.mark ? (
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
                                            : s === "Half Day"
                                              ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                      }`}
                                    >
                                      {s === "Half Day" ? "Half" : s}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">
                                  View only
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </PermissionBlock>
        )}

        {/* OT TAB */}
        {activeTab === "ot" && (
          <PermissionBlock
            allowed={permissions.ot.view}
            label="OT view not permitted"
          >
            <div className="space-y-3">
              {permissions.ot.add && (
                <div className="flex justify-end">
                  <Button onClick={() => setOtOpen(true)}>
                    <PlusCircle className="w-4 h-4 mr-2" /> Add OT Request
                  </Button>
                </div>
              )}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {otRequests.length === 0 ? (
                  <div
                    className="py-10 text-center text-gray-400 text-sm"
                    data-ocid="supervisor.ot.empty_state"
                  >
                    No OT requests yet.
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-4 py-3 font-medium text-gray-500">
                          Employee
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">
                          Date
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">
                          OT Hours
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">
                          Reason
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {otRequests.map((req, idx) => (
                        <tr
                          key={req.id}
                          className="hover:bg-gray-50"
                          data-ocid={`supervisor.ot.item.${idx + 1}`}
                        >
                          <td className="px-4 py-3 text-gray-900">
                            {empMap[req.employeeId]?.name ?? req.employeeId}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {req.date.slice(0, 4)}-{req.date.slice(4, 6)}-
                            {req.date.slice(6, 8)}
                          </td>
                          <td className="px-4 py-3 text-gray-700 font-medium">
                            {String(req.newValue.otHours ?? 0)}h
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs max-w-[140px] truncate">
                            {req.reason}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                                req.status === "pending"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : req.status === "approved"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-red-100 text-red-600"
                              }`}
                            >
                              {req.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </PermissionBlock>
        )}

        {/* ADVANCE TAB */}
        {activeTab === "advance" && (
          <PermissionBlock
            allowed={permissions.advance.view}
            label="Advance view not permitted"
          >
            <div className="space-y-3">
              {permissions.advance.add && (
                <div className="flex justify-end">
                  <Button onClick={() => setAdvOpen(true)}>
                    <PlusCircle className="w-4 h-4 mr-2" /> Add Advance Request
                  </Button>
                </div>
              )}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {advRequests.length === 0 ? (
                  <div
                    className="py-10 text-center text-gray-400 text-sm"
                    data-ocid="supervisor.advance.empty_state"
                  >
                    No advance requests yet.
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-4 py-3 font-medium text-gray-500">
                          Employee
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">
                          Month
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">
                          Amount
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">
                          Reason
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {advRequests.map((req, idx) => (
                        <tr
                          key={req.id}
                          className="hover:bg-gray-50"
                          data-ocid={`supervisor.advance.item.${idx + 1}`}
                        >
                          <td className="px-4 py-3 text-gray-900">
                            {empMap[req.employeeId]?.name ?? req.employeeId}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {req.monthRef.slice(0, 4)}-
                            {req.monthRef.slice(4, 6)}
                          </td>
                          <td className="px-4 py-3 text-gray-700 font-medium">
                            ₹{String(req.newValue.advance ?? 0)}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs max-w-[140px] truncate">
                            {req.reason}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                                req.status === "pending"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : req.status === "approved"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-red-100 text-red-600"
                              }`}
                            >
                              {req.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </PermissionBlock>
        )}

        {/* REGULARIZATION TAB */}
        {activeTab === "regularization" && (
          <PermissionBlock
            allowed={permissions.regularization.raise}
            label="Regularization not permitted"
          >
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button onClick={() => setRegOpen(true)}>
                  <PlusCircle className="w-4 h-4 mr-2" /> Raise Regularization
                </Button>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {regRequests.length === 0 ? (
                  <div
                    className="py-10 text-center text-gray-400 text-sm"
                    data-ocid="supervisor.reg.empty_state"
                  >
                    No regularization requests yet.
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-4 py-3 font-medium text-gray-500">
                          Employee
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">
                          Date
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">
                          Type
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">
                          Reason
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {regRequests.map((req, idx) => (
                        <tr
                          key={req.id}
                          className="hover:bg-gray-50"
                          data-ocid={`supervisor.reg.item.${idx + 1}`}
                        >
                          <td className="px-4 py-3 text-gray-900">
                            {empMap[req.employeeId]?.name ?? req.employeeId}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {req.date.slice(0, 4)}-{req.date.slice(4, 6)}-
                            {req.date.slice(6, 8)}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            {req.requestType ?? "status"}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs max-w-[140px] truncate">
                            {req.reason}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                                req.approvalStatus === "pending"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : req.approvalStatus === "approved"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-red-100 text-red-600"
                              }`}
                            >
                              {req.approvalStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </PermissionBlock>
        )}

        {/* SALARY TAB */}
        {activeTab === "salary" && (
          <PermissionBlock
            allowed={permissions.payroll.viewSummary}
            label="Salary access not permitted"
          >
            <div className="space-y-3">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <p className="text-xs text-gray-500 mb-3 font-medium">
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
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-4 py-3 font-medium text-gray-500">
                          Employee
                        </th>
                        {permissions.payroll.viewRows && (
                          <>
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
                          </>
                        )}
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
                            {permissions.payroll.viewRows && (
                              <>
                                <td className="px-4 py-3 text-right text-gray-600">
                                  ₹
                                  {Number(b.record.basicSalary).toLocaleString(
                                    "en-IN",
                                    { maximumFractionDigits: 0 },
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right text-gray-700">
                                  ₹
                                  {Number(b.record.grossPay).toLocaleString(
                                    "en-IN",
                                    { maximumFractionDigits: 0 },
                                  )}
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
                              </>
                            )}
                            <td className="px-4 py-3 text-right text-green-700 font-bold">
                              <IndianRupee className="w-3.5 h-3.5 inline" />
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
          </PermissionBlock>
        )}
      </div>

      {/* OT Dialog */}
      <Dialog open={otOpen} onOpenChange={(o) => !o && setOtOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add OT Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {permissions.ot.requireApproval && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700">
                This request requires admin approval before it affects payroll.
              </div>
            )}
            <div>
              <Label>Employee *</Label>
              <select
                value={otEmpId}
                onChange={(e) => setOtEmpId(e.target.value)}
                className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"
                data-ocid="supervisor.ot.select"
              >
                <option value="">Select employee</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.employeeId})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Date *</Label>
              <Input
                type="date"
                value={otDate}
                onChange={(e) => setOtDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>OT Hours *</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={otHours}
                onChange={(e) => setOtHours(e.target.value)}
                className="mt-1"
                placeholder="e.g. 2.5"
                data-ocid="supervisor.ot.input"
              />
            </div>
            <div>
              <Label>Reason *</Label>
              <textarea
                value={otReason}
                onChange={(e) => setOtReason(e.target.value)}
                placeholder="Reason for OT..."
                className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 h-16 resize-none focus:outline-none"
                data-ocid="supervisor.ot.textarea"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setOtOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmitOT}
                disabled={otSaving}
                data-ocid="supervisor.ot.submit_button"
              >
                {otSaving ? "Submitting..." : "Submit OT Request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Advance Dialog */}
      <Dialog open={advOpen} onOpenChange={(o) => !o && setAdvOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Advance Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {permissions.advance.requireApproval && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700">
                This request requires admin approval before it affects payroll.
              </div>
            )}
            <div>
              <Label>Employee *</Label>
              <select
                value={advEmpId}
                onChange={(e) => setAdvEmpId(e.target.value)}
                className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"
                data-ocid="supervisor.advance.select"
              >
                <option value="">Select employee</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.employeeId})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Month Reference *</Label>
              <Input
                type="month"
                value={advMonth}
                onChange={(e) => setAdvMonth(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Amount (₹) *</Label>
              <Input
                type="number"
                min="0"
                value={advAmount}
                onChange={(e) => setAdvAmount(e.target.value)}
                className="mt-1"
                placeholder="e.g. 5000"
                data-ocid="supervisor.advance.input"
              />
            </div>
            <div>
              <Label>Reason *</Label>
              <textarea
                value={advReason}
                onChange={(e) => setAdvReason(e.target.value)}
                placeholder="Reason for advance..."
                className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 h-16 resize-none focus:outline-none"
                data-ocid="supervisor.advance.textarea"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setAdvOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmitAdvance}
                disabled={advSaving}
                data-ocid="supervisor.advance.submit_button"
              >
                {advSaving ? "Submitting..." : "Submit Advance Request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Regularization Dialog */}
      <Dialog open={regOpen} onOpenChange={(o) => !o && setRegOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Raise Regularization Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
              All regularization requests require admin approval.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Employee *</Label>
                <select
                  value={regEmpId}
                  onChange={(e) => setRegEmpId(e.target.value)}
                  className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"
                >
                  <option value="">Select employee</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.employeeId})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={regDate}
                  onChange={(e) => setRegDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Request Type</Label>
              <select
                value={regType}
                onChange={(e) => setRegType(e.target.value as typeof regType)}
                className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"
              >
                <option value="status">Status Correction</option>
                <option value="ot">OT Correction</option>
                <option value="advance">Advance Correction</option>
                <option value="combined">Combined</option>
              </select>
            </div>
            {(regType === "status" || regType === "combined") && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Old Status</Label>
                  <select
                    value={regOldStatus}
                    onChange={(e) => setRegOldStatus(e.target.value)}
                    className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2"
                  >
                    {STATUS_VALUES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>New Status</Label>
                  <select
                    value={regNewStatus}
                    onChange={(e) => setRegNewStatus(e.target.value)}
                    className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2"
                  >
                    {STATUS_VALUES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            {(regType === "ot" || regType === "combined") && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Old OT Hours</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={regOldOT}
                    onChange={(e) => setRegOldOT(e.target.value)}
                    className="mt-1"
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>New OT Hours</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={regNewOT}
                    onChange={(e) => setRegNewOT(e.target.value)}
                    className="mt-1"
                    placeholder="e.g. 2"
                  />
                </div>
              </div>
            )}
            {(regType === "advance" || regType === "combined") && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Old Advance (₹)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={regOldAdv}
                    onChange={(e) => setRegOldAdv(e.target.value)}
                    className="mt-1"
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>New Advance (₹)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={regNewAdv}
                    onChange={(e) => setRegNewAdv(e.target.value)}
                    className="mt-1"
                    placeholder="e.g. 500"
                  />
                </div>
              </div>
            )}
            <div>
              <Label>Reason *</Label>
              <textarea
                value={regReason}
                onChange={(e) => setRegReason(e.target.value)}
                placeholder="Justification for regularization..."
                className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 h-16 resize-none focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setRegOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmitReg} disabled={regSaving}>
                {regSaving ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
