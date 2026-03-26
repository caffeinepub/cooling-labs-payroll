import {
  CheckCircle,
  Clock,
  DollarSign,
  History,
  PlusCircle,
  ShieldX,
  XCircle,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageLoader } from "../../components/ui/LoadingSpinner";
import { ToastContainer } from "../../components/ui/ToastContainer";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { useAppContext } from "../../context/AppContext";
import { useToast } from "../../hooks/useToast";
import * as attendanceStorage from "../../services/attendanceStorage";
import * as regularizationStorage from "../../services/regularizationStorage";
import type { AuditLog, RegularizationRequest } from "../../types";

const STATUS_VALUES = [
  "Present",
  "Absent",
  "HalfDay",
  "Leave",
  "Weekly Off",
  "Holiday",
];

type RequestType = "status" | "ot" | "advance" | "combined";

type RegRequest = RegularizationRequest & { payrollRecalculated?: boolean };

function TypeBadge({ type }: { type?: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    status: { label: "Status", cls: "bg-blue-100 text-blue-700" },
    ot: { label: "OT", cls: "bg-purple-100 text-purple-700" },
    advance: { label: "Advance", cls: "bg-orange-100 text-orange-700" },
    combined: { label: "Combined", cls: "bg-indigo-100 text-indigo-700" },
  };
  const c = config[type ?? "status"] ?? config.status;
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${c.cls}`}
    >
      {c.label}
    </span>
  );
}

function ApprovalBadge({ status }: { status: string }) {
  const cls =
    status === "approved"
      ? "bg-green-100 text-green-700"
      : status === "rejected"
        ? "bg-red-100 text-red-700"
        : status === "cancelled"
          ? "bg-gray-100 text-gray-500"
          : "bg-yellow-100 text-yellow-700";
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}
    >
      {status}
    </span>
  );
}

function formatDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 8) return dateStr;
  return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
}

function parseAuditValue(
  val: string,
): { status?: string; otHours?: number; advance?: number } | null {
  try {
    return JSON.parse(val);
  } catch {
    return null;
  }
}

export function Regularization() {
  const { isAdmin, employees } = useAppContext();
  const { toasts, addToast, removeToast } = useToast();
  const [regRequests, setRegRequests] = useState<RegRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Form state ─────────────────────────────────────────────
  const [reqType, setReqType] = useState<RequestType>("combined");
  const [reqEmpId, setReqEmpId] = useState("");
  const [reqDate, setReqDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [reqReason, setReqReason] = useState("");
  const [reqRemarks, setReqRemarks] = useState("");
  const [reqSaving, setReqSaving] = useState(false);

  // Old values (auto-fetched)
  const [oldStatus, setOldStatus] = useState("Not Marked");
  const [oldOT, setOldOT] = useState(0);
  const [oldAdvance, setOldAdvance] = useState(0);

  // New values (user enters)
  const [newStatus, setNewStatus] = useState("Present");
  const [newOT, setNewOT] = useState("");
  const [newAdvance, setNewAdvance] = useState("");

  // ── Approve/Reject dialogs ──────────────────────────────────
  const [approveDialog, setApproveDialog] = useState<{ id: string } | null>(
    null,
  );
  const [rejectDialog, setRejectDialog] = useState<{ id: string } | null>(null);
  const [approveRemark, setApproveRemark] = useState("");
  const [rejectRemark, setRejectRemark] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // ── Audit dialog ────────────────────────────────────────────
  const [auditOpen, setAuditOpen] = useState(false);

  const empMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of employees) m[e.id] = `${e.name} (${e.employeeId})`;
    return m;
  }, [employees]);

  const load = useCallback(() => {
    setLoading(true);
    setRegRequests(
      regularizationStorage.getRegularizationRequests() as RegRequest[],
    );
    setAuditLogs(regularizationStorage.getAuditLogs());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-fetch existing attendance record when employee + date change
  useEffect(() => {
    if (!reqEmpId || !reqDate) return;
    const dateStr = reqDate.replace(/-/g, "");
    const m = dateStr.slice(4, 6);
    const y = dateStr.slice(0, 4);
    const recs = attendanceStorage.getAttendanceByMonth(m, y);
    const found = recs.find(
      (r) => r.employeeId === reqEmpId && r.date === dateStr,
    );
    if (found) {
      setOldStatus(found.status);
      setOldOT(found.otHours ?? 0);
      setOldAdvance(found.advanceAmount ?? 0);
      setNewStatus(found.status);
      setNewOT(String(found.otHours ?? 0));
      setNewAdvance(String(found.advanceAmount ?? 0));
    } else {
      setOldStatus("Not Marked");
      setOldOT(0);
      setOldAdvance(0);
      setNewStatus("Present");
      setNewOT("0");
      setNewAdvance("0");
    }
  }, [reqEmpId, reqDate]);

  const showStatus = reqType === "status" || reqType === "combined";
  const showOT = reqType === "ot" || reqType === "combined";
  const showAdvance = reqType === "advance" || reqType === "combined";

  const handleCreateRequest = useCallback(() => {
    if (!reqEmpId) {
      addToast("Select an employee", "warning");
      return;
    }
    if (!reqReason.trim()) {
      addToast("Reason is required", "warning");
      return;
    }

    const parsedOT = Number.parseFloat(newOT);
    const parsedAdv = Number.parseFloat(newAdvance);

    // Validate at least one change
    let hasChange = false;
    if (showStatus && newStatus !== oldStatus) hasChange = true;
    if (showOT && !Number.isNaN(parsedOT) && parsedOT !== oldOT)
      hasChange = true;
    if (showAdvance && !Number.isNaN(parsedAdv) && parsedAdv !== oldAdvance)
      hasChange = true;

    if (!hasChange) {
      addToast(
        "No actual change detected. Please update at least one value.",
        "warning",
      );
      return;
    }

    // OT validation
    if (showOT && (Number.isNaN(parsedOT) || parsedOT < 0)) {
      addToast("OT Hours must be a valid non-negative number", "warning");
      return;
    }

    // Advance validation
    if (showAdvance && (Number.isNaN(parsedAdv) || parsedAdv < 0)) {
      addToast("Advance amount must be 0 or greater", "warning");
      return;
    }

    const dateStr = reqDate.replace(/-/g, "");

    // Duplicate check: block if a pending request exists for same emp + date + same type
    const hasDuplicate = regRequests.some(
      (r) =>
        r.employeeId === reqEmpId &&
        r.date === dateStr &&
        r.requestType === reqType &&
        r.approvalStatus === "pending",
    );
    if (hasDuplicate) {
      addToast(
        "A pending request already exists for this employee/date/type. Please resolve it first.",
        "warning",
      );
      return;
    }

    setReqSaving(true);
    const ok = regularizationStorage.createRegularizationRequest(
      reqEmpId,
      dateStr,
      showStatus ? oldStatus : "",
      showStatus ? newStatus : "",
      reqReason,
      "admin",
      {
        requestType: reqType,
        oldOtHours: showOT ? oldOT : undefined,
        newOtHours: showOT ? parsedOT : undefined,
        oldAdvance: showAdvance ? oldAdvance : undefined,
        newAdvance: showAdvance ? parsedAdv : undefined,
        approvalRemark: reqRemarks || undefined,
      },
    );
    if (ok) {
      addToast("Regularization request created", "success");
      setReqEmpId("");
      setReqReason("");
      setReqRemarks("");
      setReqDate(new Date().toISOString().split("T")[0]);
      load();
    } else {
      addToast("Failed to create request", "error");
    }
    setReqSaving(false);
  }, [
    reqEmpId,
    reqDate,
    reqType,
    reqReason,
    reqRemarks,
    oldStatus,
    newStatus,
    oldOT,
    newOT,
    oldAdvance,
    newAdvance,
    showStatus,
    showOT,
    showAdvance,
    regRequests,
    addToast,
    load,
  ]);

  const handleApproveConfirm = useCallback(() => {
    if (!approveDialog) return;
    setActionLoading(true);
    const result = regularizationStorage.approveRegularizationRequest(
      approveDialog.id,
      "admin",
      approveRemark || undefined,
    );
    if (result.ok) {
      if (result.payrollRecalculated) {
        addToast(
          "Request approved. Payroll recalculated for this month.",
          "success",
        );
      } else {
        addToast(
          "Request approved. Run Generate Payroll to reflect changes.",
          "success",
        );
      }
      setApproveDialog(null);
      setApproveRemark("");
      load();
    } else {
      addToast("Failed to approve request", "error");
    }
    setActionLoading(false);
  }, [approveDialog, approveRemark, addToast, load]);

  const handleRejectConfirm = useCallback(() => {
    if (!rejectDialog) return;
    if (!rejectRemark.trim()) {
      addToast("Rejection reason is required", "warning");
      return;
    }
    setActionLoading(true);
    const ok = regularizationStorage.rejectRegularizationRequest(
      rejectDialog.id,
      "admin",
      rejectRemark,
    );
    if (ok) {
      addToast("Request rejected", "success");
      setRejectDialog(null);
      setRejectRemark("");
      load();
    } else {
      addToast("Failed to reject request", "error");
    }
    setActionLoading(false);
  }, [rejectDialog, rejectRemark, addToast, load]);

  const regAuditLogs = useMemo(
    () => auditLogs.filter((l) => l.entityType === "regularization"),
    [auditLogs],
  );
  const pendingCount = useMemo(
    () => regRequests.filter((r) => r.approvalStatus === "pending").length,
    [regRequests],
  );

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ShieldX className="w-12 h-12 text-gray-300 mb-3" />
        <h3 className="text-lg font-semibold text-gray-700">Access Denied</h3>
        <p className="text-sm text-gray-500">
          This section is restricted to administrators.
        </p>
        <a href="/admin/login" className="mt-3 text-sm text-blue-600 underline">
          Login as Admin
        </a>
      </div>
    );
  }

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* ── Create Regularization Request ─────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <PlusCircle className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-700">
            Create Correction Request
          </h3>
        </div>

        {/* Request type selector */}
        <div className="mb-4">
          <Label className="text-xs text-gray-500 mb-1.5 block">
            Correction Type
          </Label>
          <div className="flex flex-wrap gap-2" data-ocid="regularization.tab">
            {(
              [
                {
                  value: "status",
                  label: "Status Correction",
                  icon: <CheckCircle className="w-3.5 h-3.5" />,
                },
                {
                  value: "ot",
                  label: "OT Correction",
                  icon: <Clock className="w-3.5 h-3.5" />,
                },
                {
                  value: "advance",
                  label: "Advance Correction",
                  icon: <DollarSign className="w-3.5 h-3.5" />,
                },
                {
                  value: "combined",
                  label: "Combined",
                  icon: <PlusCircle className="w-3.5 h-3.5" />,
                },
              ] as {
                value: RequestType;
                label: string;
                icon: React.ReactNode;
              }[]
            ).map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setReqType(t.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  reqType === t.value
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Employee + Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <Label htmlFor="req-emp">Employee *</Label>
            <select
              id="req-emp"
              value={reqEmpId}
              onChange={(e) => setReqEmpId(e.target.value)}
              data-ocid="regularization.select"
              className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select employee...</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.employeeId})
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="req-date">Date *</Label>
            <Input
              id="req-date"
              type="date"
              value={reqDate}
              onChange={(e) => setReqDate(e.target.value)}
              data-ocid="regularization.input"
              className="mt-1"
            />
          </div>
        </div>

        {/* Current Values (read-only) */}
        {reqEmpId && (
          <div className="bg-gray-50 rounded-lg p-3 mb-3 border border-gray-100">
            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
              Current Values (Auto-fetched)
            </p>
            <div className="flex flex-wrap gap-4 text-xs text-gray-600">
              {showStatus && (
                <div>
                  <span className="text-gray-400">Status:</span>{" "}
                  <span className="font-medium text-gray-700">{oldStatus}</span>
                </div>
              )}
              {showOT && (
                <div>
                  <span className="text-gray-400">OT Hours:</span>{" "}
                  <span className="font-medium text-gray-700">{oldOT}h</span>
                </div>
              )}
              {showAdvance && (
                <div>
                  <span className="text-gray-400">Advance:</span>{" "}
                  <span className="font-medium text-gray-700">
                    ₹{oldAdvance}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* New Values */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          {showStatus && (
            <div>
              <Label htmlFor="req-new-status">New Status</Label>
              <select
                id="req-new-status"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUS_VALUES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}
          {showOT && (
            <div>
              <Label htmlFor="req-new-ot">New OT Hours</Label>
              <Input
                id="req-new-ot"
                type="number"
                min="0"
                step="0.5"
                value={newOT}
                onChange={(e) => setNewOT(e.target.value)}
                placeholder="e.g. 2"
                className="mt-1"
              />
              <p className="text-xs text-gray-400 mt-0.5">Current: {oldOT}h</p>
            </div>
          )}
          {showAdvance && (
            <div>
              <Label htmlFor="req-new-advance">New Advance (₹)</Label>
              <Input
                id="req-new-advance"
                type="number"
                min="0"
                value={newAdvance}
                onChange={(e) => setNewAdvance(e.target.value)}
                placeholder="e.g. 500"
                className="mt-1"
              />
              <p className="text-xs text-gray-400 mt-0.5">
                Current: ₹{oldAdvance}
              </p>
            </div>
          )}
        </div>

        {/* Reason + Remarks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <Label htmlFor="req-reason">Reason *</Label>
            <Textarea
              id="req-reason"
              value={reqReason}
              onChange={(e) => setReqReason(e.target.value)}
              placeholder="Reason for correction request..."
              data-ocid="regularization.textarea"
              className="mt-1 h-16 resize-none"
            />
          </div>
          <div>
            <Label htmlFor="req-remarks">Remarks / Justification</Label>
            <Textarea
              id="req-remarks"
              value={reqRemarks}
              onChange={(e) => setReqRemarks(e.target.value)}
              placeholder="Additional context (optional)..."
              className="mt-1 h-16 resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleCreateRequest}
            disabled={reqSaving}
            data-ocid="regularization.submit_button"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            {reqSaving ? "Submitting..." : "Submit Correction Request"}
          </Button>
        </div>
      </div>

      {/* ── Regularization Requests Table ─────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold text-gray-700">
              Correction Requests
            </p>
            {pendingCount > 0 && (
              <span className="bg-yellow-100 text-yellow-700 text-xs font-medium px-2 py-0.5 rounded-full">
                {pendingCount} pending
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setAuditOpen(true)}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700"
          >
            <History className="w-3.5 h-3.5" /> Audit Log ({regAuditLogs.length}
            )
          </button>
        </div>

        {regRequests.length === 0 ? (
          <div
            className="py-12 text-center"
            data-ocid="regularization.empty_state"
          >
            <PlusCircle className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No correction requests yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
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
                    Changes
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Reason
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
                {regRequests.map((req, idx) => (
                  <tr
                    key={req.id}
                    className="hover:bg-gray-50"
                    data-ocid={`regularization.item.${idx + 1}`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {empMap[req.employeeId] ?? req.employeeId}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDate(req.date)}
                    </td>
                    <td className="px-4 py-3">
                      <TypeBadge type={req.requestType} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        {(req.requestType === "status" ||
                          req.requestType === "combined") &&
                          req.oldStatus && (
                            <div className="text-xs">
                              <span className="text-gray-400">Status: </span>
                              <span className="text-gray-500">
                                {req.oldStatus}
                              </span>
                              <span className="mx-1 text-gray-300">→</span>
                              <span className="text-blue-600 font-medium">
                                {req.requestedStatus}
                              </span>
                            </div>
                          )}
                        {(req.requestType === "ot" ||
                          req.requestType === "combined") &&
                          req.newOtHours !== undefined && (
                            <div className="text-xs">
                              <span className="text-gray-400">OT: </span>
                              <span className="text-gray-500">
                                {req.oldOtHours ?? 0}h
                              </span>
                              <span className="mx-1 text-gray-300">→</span>
                              <span className="text-purple-600 font-medium">
                                {req.newOtHours}h
                              </span>
                            </div>
                          )}
                        {(req.requestType === "advance" ||
                          req.requestType === "combined") &&
                          req.newAdvance !== undefined && (
                            <div className="text-xs">
                              <span className="text-gray-400">Advance: </span>
                              <span className="text-gray-500">
                                ₹{req.oldAdvance ?? 0}
                              </span>
                              <span className="mx-1 text-gray-300">→</span>
                              <span className="text-orange-600 font-medium">
                                ₹{req.newAdvance}
                              </span>
                            </div>
                          )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs">
                      <p className="truncate">{req.reason}</p>
                      {req.approvalRemark &&
                        req.approvalStatus !== "pending" && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate italic">
                            Remark: {req.approvalRemark}
                          </p>
                        )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <ApprovalBadge status={req.approvalStatus} />
                        {req.approvalStatus === "approved" &&
                          req.payrollRecalculated && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-green-50 text-green-600">
                              <CheckCircle className="w-3 h-3" /> Payroll
                              Updated
                            </span>
                          )}
                        {req.approvalStatus === "approved" &&
                          !req.payrollRecalculated && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-600">
                              Recalc Needed
                            </span>
                          )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {req.approvalStatus === "pending" ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setApproveRemark("");
                              setApproveDialog({ id: req.id });
                            }}
                            data-ocid={`regularization.edit_button.${idx + 1}`}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejectRemark("");
                              setRejectDialog({ id: req.id });
                            }}
                            data-ocid={`regularization.delete_button.${idx + 1}`}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">
                          by {req.approvedBy}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Approve Dialog ─────────────────────────────────────────── */}
      <Dialog
        open={!!approveDialog}
        onOpenChange={(open) => !open && setApproveDialog(null)}
      >
        <DialogContent data-ocid="regularization.dialog">
          <DialogHeader>
            <DialogTitle>Approve Correction Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-500">
              Approving this request will update attendance records and trigger
              payroll recalculation if payroll already exists for this month.
            </p>
            <div>
              <Label htmlFor="approve-remark">Admin Remark (optional)</Label>
              <Textarea
                id="approve-remark"
                value={approveRemark}
                onChange={(e) => setApproveRemark(e.target.value)}
                placeholder="Add a note for this approval..."
                className="mt-1 h-16 resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setApproveDialog(null)}
                data-ocid="regularization.cancel_button"
              >
                Cancel
              </Button>
              <Button
                onClick={handleApproveConfirm}
                disabled={actionLoading}
                className="bg-green-600 hover:bg-green-700 text-white"
                data-ocid="regularization.confirm_button"
              >
                <CheckCircle className="w-4 h-4 mr-1.5" />
                {actionLoading ? "Approving..." : "Confirm Approve"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Reject Dialog ──────────────────────────────────────────── */}
      <Dialog
        open={!!rejectDialog}
        onOpenChange={(open) => !open && setRejectDialog(null)}
      >
        <DialogContent data-ocid="regularization.dialog">
          <DialogHeader>
            <DialogTitle>Reject Correction Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-500">
              Rejection will leave all live attendance and payroll records
              unchanged. No data will be modified.
            </p>
            <div>
              <Label htmlFor="reject-remark">
                Rejection Reason <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="reject-remark"
                value={rejectRemark}
                onChange={(e) => setRejectRemark(e.target.value)}
                placeholder="Explain why this request is being rejected..."
                data-ocid="regularization.textarea"
                className="mt-1 h-16 resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setRejectDialog(null)}
                data-ocid="regularization.cancel_button"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRejectConfirm}
                disabled={actionLoading}
                variant="destructive"
                data-ocid="regularization.confirm_button"
              >
                <XCircle className="w-4 h-4 mr-1.5" />
                {actionLoading ? "Rejecting..." : "Confirm Reject"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Audit Log Dialog ───────────────────────────────────────── */}
      <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Regularization Audit Log</DialogTitle>
          </DialogHeader>
          {regAuditLogs.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">
              No audit entries yet.
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-2">
              {[...regAuditLogs].reverse().map((log) => {
                const oldVal = parseAuditValue(log.oldValue);
                const newVal = parseAuditValue(log.newValue);
                return (
                  <div
                    key={log.id}
                    className="p-3 rounded-lg border border-gray-100 bg-gray-50 text-xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-gray-700">
                        {log.entityId}
                      </span>
                      <span className="text-gray-400">
                        {new Date(Number(log.timestamp)).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-gray-600">
                      {oldVal && newVal ? (
                        <>
                          {oldVal.status !== undefined && (
                            <span>
                              Status:{" "}
                              <span className="text-gray-400">
                                {oldVal.status || "—"}
                              </span>
                              {" → "}
                              <span className="text-blue-600">
                                {newVal.status || "—"}
                              </span>
                            </span>
                          )}
                          {oldVal.otHours !== undefined && (
                            <span>
                              OT:{" "}
                              <span className="text-gray-400">
                                {oldVal.otHours}h
                              </span>
                              {" → "}
                              <span className="text-purple-600">
                                {newVal.otHours}h
                              </span>
                            </span>
                          )}
                          {oldVal.advance !== undefined && (
                            <span>
                              Advance:{" "}
                              <span className="text-gray-400">
                                ₹{oldVal.advance}
                              </span>
                              {" → "}
                              <span className="text-orange-600">
                                ₹{newVal.advance}
                              </span>
                            </span>
                          )}
                        </>
                      ) : (
                        <span>
                          {log.oldValue} → {log.newValue}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-gray-500">
                      By <strong>{log.changedBy}</strong> · {log.reason}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
