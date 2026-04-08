import { Edit2, Plus, Search, UserCheck, UserX } from "lucide-react";
import React, { useState, useMemo, useCallback } from "react";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { EmptyState } from "../components/ui/EmptyState";
import { StatusBadge } from "../components/ui/StatusBadge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { useAppContext } from "../context/AppContext";
import { useToast } from "../hooks/useToast";
import {
  createEmployeeInCanister,
  updateEmployeeInCanister,
} from "../services/canisterEmployeeService";
import * as workforceStorage from "../services/workforceStorage";
import type { Employee } from "../types";

const EMPTY_EMP: Employee = {
  id: "",
  employeeId: "",
  name: "",
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
  date_of_birth: "",
  work_email: "",
  createdAt: BigInt(0),
};

function calcGross(emp: Employee): number {
  const basic = emp.basicSalary || 0;
  let hra = emp.hra || 0;
  if (emp.salaryMode === "auto") {
    hra = basic * (emp.cityType === "metro" ? 0.5 : 0.4);
  }
  return (
    basic +
    hra +
    (emp.conveyance || 0) +
    (emp.specialAllowance || 0) +
    (emp.otherAllowance || 0)
  );
}

export function Employees() {
  const {
    employees,
    activeTrades,
    activeDepartments,
    activeSites,
    refreshEmployees,
  } = useAppContext();
  const { toasts, addToast, removeToast } = useToast();
  const [search, setSearch] = useState("");
  const [filterSite, setFilterSite] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee>(EMPTY_EMP);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Employee | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [ifscFetching, setIfscFetching] = useState(false);
  const [ifscFetchError, setIfscFetchError] = useState("");

  const siteOptions = useMemo(
    () => [
      ...new Set([
        ...activeSites.map((s) => s.name),
        ...employees.map((e) => e.site).filter(Boolean),
      ]),
    ],
    [activeSites, employees],
  );

  const filtered = useMemo(
    () =>
      employees.filter((e) => {
        if (
          search &&
          !e.name.toLowerCase().includes(search.toLowerCase()) &&
          !e.employeeId.toLowerCase().includes(search.toLowerCase())
        )
          return false;
        if (filterSite !== "all" && e.site !== filterSite) return false;
        if (filterStatus !== "all" && e.status !== filterStatus) return false;
        return true;
      }),
    [employees, search, filterSite, filterStatus],
  );

  const autoHra = useMemo(() => {
    if (editing.salaryMode !== "auto") return 0;
    return editing.basicSalary * (editing.cityType === "metro" ? 0.5 : 0.4);
  }, [editing.salaryMode, editing.basicSalary, editing.cityType]);

  const grossPreview = useMemo(
    () =>
      calcGross({
        ...editing,
        hra: editing.salaryMode === "auto" ? autoHra : editing.hra,
      }),
    [editing, autoHra],
  );

  const openAdd = useCallback(() => {
    setEditing(EMPTY_EMP);
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((emp: Employee) => {
    setEditing({ ...emp });
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const validate = useCallback(() => {
    const errs: Record<string, string> = {};
    if (!editing.name.trim()) errs.name = "Full name is required";
    if (!editing.employeeId.trim()) errs.employeeId = "Employee ID is required";
    if (!editing.site.trim()) errs.site = "Site is required";
    if (!editing.tradeId) errs.tradeId = "Trade is required";
    if (!editing.departmentId) errs.departmentId = "Department is required";
    if (!editing.basicSalary || editing.basicSalary <= 0)
      errs.basicSalary = "Basic salary must be greater than 0";
    if (editing.aadhaarNumber && !/^\d{12}$/.test(editing.aadhaarNumber))
      errs.aadhaarNumber = "Aadhaar must be 12 digits";
    if (
      editing.panNumber &&
      !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(editing.panNumber.toUpperCase())
    )
      errs.panNumber = "PAN format: AAAAA9999A (e.g. ABCDE1234F)";
    if (editing.uanNumber && !/^\d+$/.test(editing.uanNumber))
      errs.uanNumber = "UAN must be numeric";
    if (
      editing.ifscCode &&
      !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(editing.ifscCode.toUpperCase())
    )
      errs.ifscCode = "Invalid IFSC format (e.g. SBIN0001234)";
    if (
      editing.bankAccountNumber &&
      !/^[a-zA-Z0-9]+$/.test(editing.bankAccountNumber)
    )
      errs.bankAccountNumber = "Account number should be alphanumeric";
    if (
      editing.work_email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editing.work_email)
    )
      errs.work_email = "Enter a valid email address";
    if (editing.date_of_birth) {
      const dob = new Date(editing.date_of_birth);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dob > today)
        errs.date_of_birth = "Date of Birth cannot be a future date";
    }
    return errs;
  }, [editing]);

  const fetchBankDetails = useCallback(async (ifsc: string) => {
    const clean = ifsc.toUpperCase().trim();
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(clean)) return;
    setIfscFetching(true);
    setIfscFetchError("");
    try {
      const res = await fetch(`https://ifsc.razorpay.com/${clean}`);
      if (res.ok) {
        const data = await res.json();
        setEditing((p) => ({
          ...p,
          bankName: data.BANK || p.bankName,
          branchAddress: data.ADDRESS || p.branchAddress,
        }));
        setIfscFetchError("");
      } else {
        setIfscFetchError("Bank details not found. Please enter manually.");
      }
    } catch {
      setIfscFetchError(
        "Auto-fetch failed. Please enter bank details manually.",
      );
    } finally {
      setIfscFetching(false);
    }
  }, []);

  const handleSave = useCallback(async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }
    setSaving(true);
    const empToSave = {
      ...editing,
      hra: editing.salaryMode === "auto" ? autoHra : editing.hra || 0,
      panNumber: editing.panNumber?.toUpperCase() || "",
      ifscCode: editing.ifscCode?.toUpperCase() || "",
    };
    try {
      let ok: boolean;
      if (editing.id) {
        const updateResult = await updateEmployeeInCanister(
          editing.id,
          empToSave,
        );
        ok = updateResult.success;
        if (!ok) {
          addToast("Update failed — employee not found", "error");
          return;
        }
      } else {
        const createResult = await createEmployeeInCanister({
          ...empToSave,
          id: "",
          createdAt: BigInt(Date.now()),
        });
        ok = createResult.success;
        if (!ok) {
          addToast(
            `Employee ID "${editing.employeeId}" already exists. Use a unique ID.`,
            "error",
          );
          setFormErrors({ employeeId: "This Employee ID is already taken" });
          return;
        }
      }
      addToast(
        editing.id
          ? "Employee updated successfully"
          : "Employee created successfully",
        "success",
      );
      setModalOpen(false);
      await refreshEmployees();
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Save failed — please try again";
      addToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }, [editing, autoHra, validate, addToast, refreshEmployees]);

  const handleToggleStatus = useCallback(async () => {
    if (!confirmTarget) return;
    setConfirmLoading(true);
    try {
      const newStatus =
        confirmTarget.status === "active" ? "inactive" : "active";
      const { success: ok } = await updateEmployeeInCanister(confirmTarget.id, {
        ...confirmTarget,
        status: newStatus,
      });
      if (ok) {
        addToast(
          `Employee ${newStatus === "active" ? "activated" : "deactivated"}`,
          "success",
        );
        await refreshEmployees();
      }
    } finally {
      setConfirmLoading(false);
      setConfirmOpen(false);
      setConfirmTarget(null);
    }
  }, [confirmTarget, addToast, refreshEmployees]);

  const tradeName = useCallback(
    (id: string) => activeTrades.find((t) => t.id === id)?.name ?? id,
    [activeTrades],
  );
  const deptName = useCallback(
    (id: string) => activeDepartments.find((d) => d.id === id)?.name ?? id,
    [activeDepartments],
  );

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{filtered.length} employees</p>
        <Button onClick={openAdd} size="sm">
          <Plus className="w-4 h-4 mr-1.5" /> Add Employee
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or ID..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterSite}
            onChange={(e) => setFilterSite(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">All Sites</option>
            {siteOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            title="No employees found"
            subtitle={
              employees.length === 0
                ? "Add your first employee to get started"
                : "Adjust your search or filters"
            }
            action={{ label: "Add Employee", onClick: openAdd }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Name
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Emp ID
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Mobile
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Site
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Trade
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Dept
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">
                    Gross
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Status
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {emp.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {emp.employeeId}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {emp.mobile || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{emp.site}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {tradeName(emp.tradeId)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {deptName(emp.departmentId)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 font-medium">
                      ₹{calcGross(emp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        variant={
                          emp.status === "active" ? "active" : "inactive"
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(emp)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmTarget(emp);
                            setConfirmOpen(true);
                          }}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                          title={
                            emp.status === "active" ? "Deactivate" : "Activate"
                          }
                        >
                          {emp.status === "active" ? (
                            <UserX className="w-3.5 h-3.5" />
                          ) : (
                            <UserCheck className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={(o) => !o && setModalOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing.id ? "Edit Employee" : "Add New Employee"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Personal Info */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Personal Information
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="emp-name">Full Name *</Label>
                  <Input
                    id="emp-name"
                    value={editing.name}
                    onChange={(e) =>
                      setEditing((p) => ({ ...p, name: e.target.value }))
                    }
                    className={formErrors.name ? "border-red-400" : ""}
                    placeholder="e.g. Ramesh Kumar"
                  />
                  {formErrors.name && (
                    <p className="text-xs text-red-500">{formErrors.name}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="emp-id">Employee ID *</Label>
                  <Input
                    id="emp-id"
                    value={editing.employeeId}
                    onChange={(e) =>
                      setEditing((p) => ({ ...p, employeeId: e.target.value }))
                    }
                    className={formErrors.employeeId ? "border-red-400" : ""}
                    placeholder="e.g. EMP001"
                    disabled={!!editing.id}
                  />
                  {formErrors.employeeId && (
                    <p className="text-xs text-red-500">
                      {formErrors.employeeId}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="emp-mobile">Mobile</Label>
                  <Input
                    id="emp-mobile"
                    value={editing.mobile}
                    onChange={(e) =>
                      setEditing((p) => ({ ...p, mobile: e.target.value }))
                    }
                    placeholder="e.g. 9876543210"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="emp-work-email">Work Email</Label>
                  <Input
                    id="emp-work-email"
                    type="email"
                    value={editing.work_email || ""}
                    onChange={(e) =>
                      setEditing((p) => ({ ...p, work_email: e.target.value }))
                    }
                    placeholder="e.g. employee@company.com"
                    className={formErrors.work_email ? "border-red-400" : ""}
                  />
                  {formErrors.work_email && (
                    <p className="text-xs text-red-500">
                      {formErrors.work_email}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="emp-doj">Date of Joining</Label>
                  <Input
                    id="emp-doj"
                    type="date"
                    value={editing.dateOfJoining || ""}
                    onChange={(e) =>
                      setEditing((p) => ({
                        ...p,
                        dateOfJoining: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="emp-dob">Date of Birth</Label>
                  <Input
                    id="emp-dob"
                    type="date"
                    value={editing.date_of_birth || ""}
                    max={new Date().toISOString().split("T")[0]}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditing((p) => ({ ...p, date_of_birth: val }));
                    }}
                    className={formErrors.date_of_birth ? "border-red-400" : ""}
                  />
                  {formErrors.date_of_birth && (
                    <p className="text-xs text-red-500">
                      {formErrors.date_of_birth}
                    </p>
                  )}
                  {editing.date_of_birth &&
                    !formErrors.date_of_birth &&
                    (() => {
                      const dob = new Date(editing.date_of_birth);
                      const now = new Date();
                      let years = now.getFullYear() - dob.getFullYear();
                      let months = now.getMonth() - dob.getMonth();
                      let days = now.getDate() - dob.getDate();
                      if (days < 0) {
                        months -= 1;
                        days += new Date(
                          now.getFullYear(),
                          now.getMonth(),
                          0,
                        ).getDate();
                      }
                      if (months < 0) {
                        years -= 1;
                        months += 12;
                      }
                      return (
                        <p className="text-xs text-muted-foreground">
                          {years} Years, {months} Months, {days} Days
                        </p>
                      );
                    })()}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="emp-status">Status</Label>
                  <Select
                    value={editing.status}
                    onValueChange={(v) =>
                      setEditing((p) => ({ ...p, status: v }))
                    }
                  >
                    <SelectTrigger id="emp-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Assignment */}
            <div className="border-t pt-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Assignment
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="emp-site">Site *</Label>
                  {siteOptions.length > 0 ? (
                    <Select
                      value={editing.site}
                      onValueChange={(v) =>
                        setEditing((p) => ({ ...p, site: v }))
                      }
                    >
                      <SelectTrigger
                        id="emp-site"
                        className={formErrors.site ? "border-red-400" : ""}
                      >
                        <SelectValue placeholder="Select site" />
                      </SelectTrigger>
                      <SelectContent>
                        {siteOptions.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="space-y-1">
                      <Input
                        id="emp-site"
                        value={editing.site}
                        onChange={(e) =>
                          setEditing((p) => ({ ...p, site: e.target.value }))
                        }
                        placeholder="Add sites in Masters first"
                        className={formErrors.site ? "border-red-400" : ""}
                      />
                      <p className="text-xs text-amber-600">
                        Tip: Add sites in Masters → Site Master for dropdown
                        selection
                      </p>
                    </div>
                  )}
                  {formErrors.site && (
                    <p className="text-xs text-red-500">{formErrors.site}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="emp-trade">Trade *</Label>
                  {activeTrades.length > 0 ? (
                    <Select
                      value={editing.tradeId}
                      onValueChange={(v) =>
                        setEditing((p) => ({ ...p, tradeId: v }))
                      }
                    >
                      <SelectTrigger
                        id="emp-trade"
                        className={formErrors.tradeId ? "border-red-400" : ""}
                      >
                        <SelectValue placeholder="Select trade" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeTrades.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="space-y-1">
                      <Input
                        id="emp-trade"
                        value={editing.tradeId}
                        onChange={(e) =>
                          setEditing((p) => ({ ...p, tradeId: e.target.value }))
                        }
                        placeholder="No trades in Masters — type a trade name"
                        className={formErrors.tradeId ? "border-red-400" : ""}
                      />
                      <p className="text-xs text-amber-600">
                        Tip: Add trades in Masters → Trade Master for dropdown
                        selection
                      </p>
                    </div>
                  )}
                  {formErrors.tradeId && (
                    <p className="text-xs text-red-500">{formErrors.tradeId}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="emp-dept">Department *</Label>
                  {activeDepartments.length > 0 ? (
                    <Select
                      value={editing.departmentId}
                      onValueChange={(v) =>
                        setEditing((p) => ({ ...p, departmentId: v }))
                      }
                    >
                      <SelectTrigger
                        id="emp-dept"
                        className={
                          formErrors.departmentId ? "border-red-400" : ""
                        }
                      >
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeDepartments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="space-y-1">
                      <Input
                        id="emp-dept"
                        value={editing.departmentId}
                        onChange={(e) =>
                          setEditing((p) => ({
                            ...p,
                            departmentId: e.target.value,
                          }))
                        }
                        placeholder="No departments in Masters — type a dept name"
                        className={
                          formErrors.departmentId ? "border-red-400" : ""
                        }
                      />
                      <p className="text-xs text-amber-600">
                        Tip: Add departments in Masters → Department Master for
                        dropdown selection
                      </p>
                    </div>
                  )}
                  {formErrors.departmentId && (
                    <p className="text-xs text-red-500">
                      {formErrors.departmentId}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Salary */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Salary Details
                </p>
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                  {(["auto", "manual"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() =>
                        setEditing((p) => ({ ...p, salaryMode: m }))
                      }
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                        editing.salaryMode === m
                          ? "bg-white shadow-sm text-blue-700"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {m === "auto" ? "Auto" : "Manual"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="emp-salary">Basic Salary (₹) *</Label>
                  <Input
                    id="emp-salary"
                    type="number"
                    min="0"
                    step="100"
                    value={editing.basicSalary || ""}
                    onChange={(e) =>
                      setEditing((p) => ({
                        ...p,
                        basicSalary: Number.parseFloat(e.target.value) || 0,
                      }))
                    }
                    className={formErrors.basicSalary ? "border-red-400" : ""}
                    placeholder="e.g. 15000"
                  />
                  {formErrors.basicSalary && (
                    <p className="text-xs text-red-500">
                      {formErrors.basicSalary}
                    </p>
                  )}
                </div>

                {editing.salaryMode === "auto" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="emp-city">City Type</Label>
                    <Select
                      value={editing.cityType}
                      onValueChange={(v) =>
                        setEditing((p) => ({ ...p, cityType: v }))
                      }
                    >
                      <SelectTrigger id="emp-city">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="metro">Metro (HRA 50%)</SelectItem>
                        <SelectItem value="non-metro">
                          Non-Metro (HRA 40%)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-400">
                      HRA auto = ₹{autoHra.toLocaleString()}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="emp-hra">HRA (₹)</Label>
                    <Input
                      id="emp-hra"
                      type="number"
                      min="0"
                      step="100"
                      value={editing.hra || ""}
                      onChange={(e) =>
                        setEditing((p) => ({
                          ...p,
                          hra: Number.parseFloat(e.target.value) || 0,
                        }))
                      }
                      placeholder="e.g. 6000"
                    />
                  </div>
                )}

                {editing.salaryMode === "manual" && (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="emp-conv">Conveyance (₹)</Label>
                      <Input
                        id="emp-conv"
                        type="number"
                        min="0"
                        step="100"
                        value={editing.conveyance || ""}
                        onChange={(e) =>
                          setEditing((p) => ({
                            ...p,
                            conveyance: Number.parseFloat(e.target.value) || 0,
                          }))
                        }
                        placeholder="e.g. 1600"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="emp-special">Special Allowance (₹)</Label>
                      <Input
                        id="emp-special"
                        type="number"
                        min="0"
                        step="100"
                        value={editing.specialAllowance || ""}
                        onChange={(e) =>
                          setEditing((p) => ({
                            ...p,
                            specialAllowance:
                              Number.parseFloat(e.target.value) || 0,
                          }))
                        }
                        placeholder="e.g. 2000"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="emp-other">Other Allowance (₹)</Label>
                      <Input
                        id="emp-other"
                        type="number"
                        min="0"
                        step="100"
                        value={editing.otherAllowance || ""}
                        onChange={(e) =>
                          setEditing((p) => ({
                            ...p,
                            otherAllowance:
                              Number.parseFloat(e.target.value) || 0,
                          }))
                        }
                        placeholder="e.g. 500"
                      />
                    </div>
                  </>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="emp-ot">OT Rate (₹/hr)</Label>
                  <Input
                    id="emp-ot"
                    type="number"
                    min="0"
                    step="10"
                    value={editing.otRate || ""}
                    onChange={(e) =>
                      setEditing((p) => ({
                        ...p,
                        otRate: Number.parseFloat(e.target.value) || 0,
                      }))
                    }
                    placeholder="e.g. 150"
                  />
                </div>

                <div className="flex items-center gap-3 py-2">
                  <input
                    type="checkbox"
                    id="emp-pf"
                    checked={editing.pfApplicable}
                    onChange={(e) =>
                      setEditing((p) => ({
                        ...p,
                        pfApplicable: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                  <Label htmlFor="emp-pf" className="cursor-pointer">
                    PF Applicable{" "}
                    <span className="text-gray-400 font-normal">
                      (12% of Basic)
                    </span>
                  </Label>
                </div>
                <div className="flex items-center gap-3 py-2">
                  <input
                    type="checkbox"
                    id="emp-esi"
                    checked={editing.esiApplicable}
                    onChange={(e) =>
                      setEditing((p) => ({
                        ...p,
                        esiApplicable: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                  <Label htmlFor="emp-esi" className="cursor-pointer">
                    ESI Applicable{" "}
                    <span className="text-gray-400 font-normal">
                      (0.75% of Gross)
                    </span>
                  </Label>
                </div>
              </div>

              <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 text-sm">
                <span className="text-gray-500">Gross Salary Preview: </span>
                <span className="font-bold text-blue-700">
                  ₹{grossPreview.toLocaleString()}
                </span>
                {editing.salaryMode === "auto" && (
                  <span className="text-xs text-gray-400 ml-2">
                    (Basic ₹{(editing.basicSalary || 0).toLocaleString()} + HRA
                    ₹{autoHra.toLocaleString()})
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              KYC / Statutory Details
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="emp-aadhaar">Aadhaar Number</Label>
                <Input
                  id="emp-aadhaar"
                  value={editing.aadhaarNumber || ""}
                  onChange={(e) =>
                    setEditing((p) => ({ ...p, aadhaarNumber: e.target.value }))
                  }
                  className={formErrors.aadhaarNumber ? "border-red-400" : ""}
                  placeholder="12-digit Aadhaar number"
                  maxLength={12}
                />
                {formErrors.aadhaarNumber && (
                  <p className="text-xs text-red-500">
                    {formErrors.aadhaarNumber}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emp-pan">PAN Number</Label>
                <Input
                  id="emp-pan"
                  value={editing.panNumber || ""}
                  onChange={(e) =>
                    setEditing((p) => ({
                      ...p,
                      panNumber: e.target.value.toUpperCase(),
                    }))
                  }
                  className={formErrors.panNumber ? "border-red-400" : ""}
                  placeholder="e.g. ABCDE1234F"
                  maxLength={10}
                />
                {formErrors.panNumber && (
                  <p className="text-xs text-red-500">{formErrors.panNumber}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emp-uan">UAN Number</Label>
                <Input
                  id="emp-uan"
                  value={editing.uanNumber || ""}
                  onChange={(e) =>
                    setEditing((p) => ({ ...p, uanNumber: e.target.value }))
                  }
                  className={formErrors.uanNumber ? "border-red-400" : ""}
                  placeholder="Universal Account Number"
                />
                {formErrors.uanNumber && (
                  <p className="text-xs text-red-500">{formErrors.uanNumber}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emp-esi-no">ESI Number</Label>
                <Input
                  id="emp-esi-no"
                  value={editing.esiNumber || ""}
                  onChange={(e) =>
                    setEditing((p) => ({ ...p, esiNumber: e.target.value }))
                  }
                  placeholder="ESI registration number"
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Bank Details
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="emp-accholder">Account Holder Name</Label>
                <Input
                  id="emp-accholder"
                  value={editing.bankAccountHolderName || ""}
                  onChange={(e) =>
                    setEditing((p) => ({
                      ...p,
                      bankAccountHolderName: e.target.value,
                    }))
                  }
                  placeholder="As per bank records"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emp-accno">Account Number</Label>
                <Input
                  id="emp-accno"
                  value={editing.bankAccountNumber || ""}
                  onChange={(e) =>
                    setEditing((p) => ({
                      ...p,
                      bankAccountNumber: e.target.value,
                    }))
                  }
                  className={
                    formErrors.bankAccountNumber ? "border-red-400" : ""
                  }
                  placeholder="Do not truncate leading zeros"
                />
                {formErrors.bankAccountNumber && (
                  <p className="text-xs text-red-500">
                    {formErrors.bankAccountNumber}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emp-ifsc">IFSC Code</Label>
                <div className="flex gap-2">
                  <Input
                    id="emp-ifsc"
                    value={editing.ifscCode || ""}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setEditing((p) => ({ ...p, ifscCode: val }));
                      setIfscFetchError("");
                    }}
                    onBlur={(e) => fetchBankDetails(e.target.value)}
                    className={formErrors.ifscCode ? "border-red-400" : ""}
                    placeholder="e.g. SBIN0001234"
                    maxLength={11}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fetchBankDetails(editing.ifscCode || "")}
                    disabled={ifscFetching}
                    className="whitespace-nowrap"
                  >
                    {ifscFetching ? "Fetching..." : "Fetch"}
                  </Button>
                </div>
                {formErrors.ifscCode && (
                  <p className="text-xs text-red-500">{formErrors.ifscCode}</p>
                )}
                {ifscFetchError && (
                  <p className="text-xs text-amber-600">{ifscFetchError}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emp-bankname">Bank Name</Label>
                <Input
                  id="emp-bankname"
                  value={editing.bankName || ""}
                  onChange={(e) =>
                    setEditing((p) => ({ ...p, bankName: e.target.value }))
                  }
                  placeholder="Auto-filled from IFSC or enter manually"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="emp-branch">Branch Address</Label>
                <Input
                  id="emp-branch"
                  value={editing.branchAddress || ""}
                  onChange={(e) =>
                    setEditing((p) => ({ ...p, branchAddress: e.target.value }))
                  }
                  placeholder="Auto-filled from IFSC or enter manually"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving
                ? "Saving..."
                : editing.id
                  ? "Update Employee"
                  : "Create Employee"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          setConfirmTarget(null);
        }}
        onConfirm={handleToggleStatus}
        title={
          confirmTarget?.status === "active"
            ? "Deactivate Employee"
            : "Activate Employee"
        }
        message={`Are you sure you want to ${confirmTarget?.status === "active" ? "deactivate" : "activate"} ${confirmTarget?.name ?? ""}?`}
        confirmLabel={
          confirmTarget?.status === "active" ? "Deactivate" : "Activate"
        }
        danger={confirmTarget?.status === "active"}
        loading={confirmLoading}
      />
    </div>
  );
}
