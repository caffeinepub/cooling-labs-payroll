import {
  CheckCircle,
  Flag,
  History,
  PlusCircle,
  ShieldX,
  XCircle,
} from "lucide-react";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { PageLoader } from "../../components/ui/LoadingSpinner";
import { AttendanceBadge, StatusBadge } from "../../components/ui/StatusBadge";
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
import { useAppContext } from "../../context/AppContext";
import { useToast } from "../../hooks/useToast";
import * as attendanceStorage from "../../services/attendanceStorage";
import * as regularizationStorage from "../../services/regularizationStorage";
import type {
  AttendanceRecord,
  AuditLog,
  RegularizationRequest,
} from "../../types";

const STATUS_VALUES = ["Present", "Absent", "HalfDay", "Leave"];

function ApprovalBadge({ status }: { status: string }) {
  const cls =
    status === "approved"
      ? "bg-green-100 text-green-700"
      : status === "rejected"
        ? "bg-red-100 text-red-700"
        : "bg-yellow-100 text-yellow-700";
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}
    >
      {status}
    </span>
  );
}

export function Regularization() {
  const { isAdmin, employees } = useAppContext();
  const { toasts, addToast, removeToast } = useToast();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [regRequests, setRegRequests] = useState<RegularizationRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState(
    String(new Date().getMonth() + 1),
  );
  const [filterYear, setFilterYear] = useState(
    String(new Date().getFullYear()),
  );
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editOT, setEditOT] = useState("");
  const [editReason, setEditReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [flagRecord, setFlagRecord] = useState<AttendanceRecord | null>(null);
  const [flagReason, setFlagReason] = useState("");
  const [flagging, setFlagging] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [reqEmpId, setReqEmpId] = useState("");
  const [reqDate, setReqDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [reqOldStatus, setReqOldStatus] = useState("Absent");
  const [reqNewStatus, setReqNewStatus] = useState("Present");
  const [reqReason, setReqReason] = useState("");
  const [reqSaving, setReqSaving] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);

  const empMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of employees) m[e.id] = `${e.name} (${e.employeeId})`;
    return m;
  }, [employees]);

  const load = useCallback(() => {
    setLoading(true);
    const paddedMonth = filterMonth.padStart(2, "0");
    setRecords(attendanceStorage.getAttendanceByMonth(paddedMonth, filterYear));
    setRegRequests(regularizationStorage.getRegularizationRequests());
    setAuditLogs(regularizationStorage.getAuditLogs());
    setLoading(false);
  }, [filterMonth, filterYear]);

  useEffect(() => {
    load();
  }, [load]);

  const handleEdit = useCallback(() => {
    if (!editRecord) return;
    if (!editReason.trim()) {
      addToast("Reason is required", "warning");
      return;
    }
    setSaving(true);
    const ok = attendanceStorage.regularizeAttendance(
      editRecord.id,
      editStatus,
      Number.parseFloat(editOT) || 0,
      editReason,
      "admin",
    );
    if (ok) {
      addToast("Attendance regularized", "success");
      setEditRecord(null);
      load();
    } else {
      addToast("Failed to regularize", "error");
    }
    setSaving(false);
  }, [editRecord, editStatus, editOT, editReason, addToast, load]);

  const handleFlag = useCallback(() => {
    if (!flagRecord || !flagReason.trim()) {
      addToast("Flag reason is required", "warning");
      return;
    }
    setFlagging(true);
    const ok = attendanceStorage.flagAttendance(flagRecord.id, flagReason);
    if (ok) {
      addToast("Record flagged", "success");
      setFlagRecord(null);
      setFlagReason("");
      load();
    } else {
      addToast("Failed to flag", "error");
    }
    setFlagging(false);
  }, [flagRecord, flagReason, addToast, load]);

  const handleCreateRequest = useCallback(() => {
    if (!reqEmpId) {
      addToast("Select an employee", "warning");
      return;
    }
    if (!reqReason.trim()) {
      addToast("Reason is required", "warning");
      return;
    }
    setReqSaving(true);
    const dateStr = reqDate.replace(/-/g, "");
    const ok = regularizationStorage.createRegularizationRequest(
      reqEmpId,
      dateStr,
      reqOldStatus,
      reqNewStatus,
      reqReason,
      "admin",
    );
    if (ok) {
      addToast("Regularization request created", "success");
      setReqEmpId("");
      setReqReason("");
      setReqDate(new Date().toISOString().split("T")[0]);
      load();
    } else {
      addToast("Failed to create request", "error");
    }
    setReqSaving(false);
  }, [
    reqEmpId,
    reqDate,
    reqOldStatus,
    reqNewStatus,
    reqReason,
    addToast,
    load,
  ]);

  const handleApprove = useCallback(
    (id: string) => {
      setApproving(id);
      const ok = regularizationStorage.approveRegularizationRequest(
        id,
        "admin",
      );
      if (ok) {
        addToast("Request approved", "success");
        load();
      } else {
        addToast("Failed to approve", "error");
      }
      setApproving(null);
    },
    [addToast, load],
  );

  const handleReject = useCallback(
    (id: string) => {
      setApproving(id);
      const ok = regularizationStorage.rejectRegularizationRequest(id, "admin");
      if (ok) {
        addToast("Request rejected", "success");
        load();
      } else {
        addToast("Failed to reject", "error");
      }
      setApproving(null);
    },
    [addToast, load],
  );

  const attAuditLogs = useMemo(
    () => auditLogs.filter((l) => l.entityType === "attendance"),
    [auditLogs],
  );
  const pendingRequests = useMemo(
    () => regRequests.filter((r) => r.approvalStatus === "pending"),
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

      {/* Create Regularization Request */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <PlusCircle className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-700">
            Create Regularization Request
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="req-emp">Employee *</Label>
            <select
              id="req-emp"
              value={reqEmpId}
              onChange={(e) => setReqEmpId(e.target.value)}
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
            <Label htmlFor="req-date">Date *</Label>
            <Input
              id="req-date"
              type="date"
              value={reqDate}
              onChange={(e) => setReqDate(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Old Status</Label>
              <select
                value={reqOldStatus}
                onChange={(e) => setReqOldStatus(e.target.value)}
                className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"
              >
                {STATUS_VALUES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>New Status *</Label>
              <select
                value={reqNewStatus}
                onChange={(e) => setReqNewStatus(e.target.value)}
                className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"
              >
                {STATUS_VALUES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="mt-3">
          <Label htmlFor="req-reason">Reason *</Label>
          <textarea
            id="req-reason"
            value={reqReason}
            onChange={(e) => setReqReason(e.target.value)}
            placeholder="Reason for regularization request..."
            className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 h-16 resize-none focus:outline-none"
          />
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={handleCreateRequest} disabled={reqSaving}>
            <PlusCircle className="w-4 h-4 mr-2" />
            {reqSaving ? "Submitting..." : "Submit Request"}
          </Button>
        </div>
      </div>

      {/* Pending Requests Approval */}
      {regRequests.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">
              Regularization Requests
            </p>
            {pendingRequests.length > 0 && (
              <span className="bg-yellow-100 text-yellow-700 text-xs font-medium px-2 py-0.5 rounded-full">
                {pendingRequests.length} pending
              </span>
            )}
          </div>
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
                    Old → New
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
                {regRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {empMap[req.employeeId] ?? req.employeeId}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {req.date.slice(0, 4)}-{req.date.slice(4, 6)}-
                      {req.date.slice(6, 8)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-500">{req.oldStatus}</span>
                      <span className="mx-1 text-gray-400">→</span>
                      <span className="text-blue-600 font-medium">
                        {req.requestedStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                      {req.reason}
                    </td>
                    <td className="px-4 py-3">
                      <ApprovalBadge status={req.approvalStatus} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {req.approvalStatus === "pending" && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleApprove(req.id)}
                            disabled={approving === req.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100 disabled:opacity-50"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(req.id)}
                            disabled={approving === req.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                        </div>
                      )}
                      {req.approvalStatus !== "pending" && (
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
        </div>
      )}

      {/* Attendance Records for Direct Regularization */}
      <div>
        <div className="flex flex-wrap gap-3 items-end justify-between mb-3">
          <div className="flex gap-3">
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1">Month</p>
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="block text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={String(m)}>
                    {new Date(2000, m - 1).toLocaleString("default", {
                      month: "long",
                    })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1">Year</p>
              <Input
                type="number"
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="w-24"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAuditOpen(true)}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
          >
            <History className="w-4 h-4" /> Audit Log ({attAuditLogs.length})
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {records.length === 0 ? (
            <div className="py-12 text-center text-gray-500 text-sm">
              No attendance records for this period.
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
                      Status
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">
                      OT Hrs
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">
                      Flags
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {records.map((rec) => (
                    <tr
                      key={rec.id}
                      className={`hover:bg-gray-50 ${rec.isFlagged ? "bg-orange-50" : ""}`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {empMap[rec.employeeId] ?? rec.employeeId}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {rec.date.slice(0, 4)}-{rec.date.slice(4, 6)}-
                        {rec.date.slice(6, 8)}
                      </td>
                      <td className="px-4 py-3">
                        <AttendanceBadge status={rec.status} />
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {rec.otHours}h
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {rec.isRegularized && (
                            <StatusBadge variant="regularized" />
                          )}
                          {rec.isFlagged && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700"
                              title={rec.flagReason}
                            >
                              <Flag className="w-3 h-3" /> Flagged
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!rec.isFlagged && (
                            <button
                              type="button"
                              onClick={() => {
                                setFlagRecord(rec);
                                setFlagReason("");
                              }}
                              className="text-xs px-2.5 py-1.5 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 flex items-center gap-1"
                            >
                              <Flag className="w-3 h-3" /> Flag
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setEditRecord(rec);
                              setEditStatus(rec.status);
                              setEditOT(String(rec.otHours));
                              setEditReason("");
                            }}
                            className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                          >
                            Edit
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
      </div>

      {/* Edit Dialog */}
      <Dialog
        open={!!editRecord}
        onOpenChange={(o) => !o && setEditRecord(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Regularize Attendance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">
                New Status *
              </p>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
              >
                {STATUS_VALUES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="edit-ot">OT Hours</Label>
              <Input
                id="edit-ot"
                type="number"
                min="0"
                step="0.5"
                value={editOT}
                onChange={(e) => setEditOT(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="edit-reason">
                Reason *{" "}
                <span className="text-gray-400 font-normal">(audit trail)</span>
              </Label>
              <textarea
                id="edit-reason"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Reason for regularization..."
                className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 h-20 resize-none focus:outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditRecord(null)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving ? "Saving..." : "Regularize"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Flag Dialog */}
      <Dialog
        open={!!flagRecord}
        onOpenChange={(o) => !o && setFlagRecord(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Flag Attendance Record</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">
              Flag:{" "}
              <strong>
                {flagRecord
                  ? `${empMap[flagRecord.employeeId] ?? flagRecord.employeeId} on ${flagRecord.date}`
                  : ""}
              </strong>
            </p>
            <div>
              <Label htmlFor="flag-reason">Reason *</Label>
              <textarea
                id="flag-reason"
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                placeholder="e.g. Location mismatch..."
                className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 h-20 resize-none focus:outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setFlagRecord(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleFlag}
              disabled={flagging}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {flagging ? "Flagging..." : "Flag Record"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Audit Dialog */}
      <Dialog open={auditOpen} onOpenChange={(o) => !o && setAuditOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Attendance Audit Log</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {attAuditLogs.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">
                No audit records yet
              </p>
            ) : (
              attAuditLogs.map((log) => (
                <div
                  key={log.id}
                  className="border border-gray-100 rounded-lg px-4 py-3 text-sm"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-800">
                      {log.entityType} / {log.entityId}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(
                        Number(log.timestamp) / 1_000_000,
                      ).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    <strong>By:</strong> {log.changedBy} &nbsp;
                    <strong>Reason:</strong> {log.reason}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {log.oldValue} → {log.newValue}
                  </p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
