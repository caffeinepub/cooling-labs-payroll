import {
  Bell,
  CheckCircle,
  Clock,
  FileText,
  IndianRupee,
  TrendingUp,
  XCircle,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ToastContainer } from "../components/ui/ToastContainer";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { useAppContext } from "../context/AppContext";
import { useToast } from "../hooks/useToast";
import * as approvalsStorage from "../services/approvalsStorage";
import type { ApprovalRequest } from "../types";

const TYPE_LABELS: Record<string, string> = {
  attendance_correction: "Attendance",
  ot_request: "OT Request",
  advance_request: "Advance",
  regularization: "Regularization",
  leave_request: "Leave",
};

const TYPE_COLORS: Record<string, string> = {
  attendance_correction: "bg-blue-100 text-blue-700",
  ot_request: "bg-purple-100 text-purple-700",
  advance_request: "bg-orange-100 text-orange-700",
  regularization: "bg-yellow-100 text-yellow-700",
  leave_request: "bg-gray-100 text-gray-600",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};

function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
        TYPE_COLORS[type] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
        STATUS_COLORS[status] ?? "bg-gray-100 text-gray-500"
      }`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function formatDateStr(dateStr: string) {
  if (!dateStr || dateStr.length < 8) return dateStr;
  return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
}

function compactValue(val: Record<string, unknown>) {
  const parts: string[] = [];
  if (val.status) parts.push(`Status: ${val.status}`);
  if (val.otHours) parts.push(`OT: ${val.otHours}h`);
  if (val.advance) parts.push(`Adv: ₹${val.advance}`);
  if (val.advanceAmount) parts.push(`Adv: ₹${val.advanceAmount}`);
  return parts.length > 0 ? parts.join(" | ") : JSON.stringify(val);
}

const todayStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

type TabKey =
  | "all"
  | "attendance_correction"
  | "ot_request"
  | "advance_request"
  | "regularization"
  | "leave_request";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "attendance_correction", label: "Attendance" },
  { key: "ot_request", label: "OT Requests" },
  { key: "advance_request", label: "Advance" },
  { key: "regularization", label: "Regularization" },
  { key: "leave_request", label: "Leave" },
];

export function ApprovalsCenter() {
  const { employees, isAdmin } = useAppContext();
  const { toasts, addToast, removeToast } = useToast();
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [actionReq, setActionReq] = useState<ApprovalRequest | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject">("approve");
  const [remark, setRemark] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const empMap = useMemo(
    () => Object.fromEntries(employees.map((e) => [e.id, e.name])),
    [employees],
  );

  const load = useCallback(() => {
    setRequests(approvalsStorage.getApprovalRequests());
  }, []);

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("clf:attendance-updated", handler);
    return () => window.removeEventListener("clf:attendance-updated", handler);
  }, [load]);

  const filtered = useMemo(() => {
    if (activeTab === "all") return requests;
    return requests.filter((r) => r.requestType === activeTab);
  }, [requests, activeTab]);

  const pendingCount = useMemo(
    () => requests.filter((r) => r.status === "pending").length,
    [requests],
  );

  const todayTs = todayStart();
  const approvedToday = useMemo(
    () =>
      requests.filter((r) => r.status === "approved" && r.approvedAt >= todayTs)
        .length,
    [requests, todayTs],
  );
  const rejectedToday = useMemo(
    () =>
      requests.filter((r) => r.status === "rejected" && r.approvedAt >= todayTs)
        .length,
    [requests, todayTs],
  );

  const openApprove = useCallback((req: ApprovalRequest) => {
    setActionReq(req);
    setActionType("approve");
    setRemark("");
  }, []);

  const openReject = useCallback((req: ApprovalRequest) => {
    setActionReq(req);
    setActionType("reject");
    setRemark("");
  }, []);

  const handleSubmitAction = useCallback(() => {
    if (!actionReq) return;
    if (actionType === "reject" && !remark.trim()) {
      addToast("Rejection reason is required", "warning");
      return;
    }
    setSubmitting(true);
    const adminName = "admin";
    let ok: boolean;
    if (actionType === "approve") {
      ok = approvalsStorage.approveRequest(actionReq.id, adminName, remark);
    } else {
      ok = approvalsStorage.rejectRequest(actionReq.id, adminName, remark);
    }
    if (ok) {
      addToast(
        actionType === "approve" ? "Request approved" : "Request rejected",
        actionType === "approve" ? "success" : "success",
      );
      setActionReq(null);
      load();
    } else {
      addToast("Action failed", "error");
    }
    setSubmitting(false);
  }, [actionReq, actionType, remark, addToast, load]);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Bell className="w-12 h-12 text-gray-300 mb-3" />
        <h3 className="text-lg font-semibold text-gray-700">Access Denied</h3>
        <p className="text-sm text-gray-500">
          This section is for administrators only.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Approvals Center
            </h2>
            <p className="text-sm text-gray-500">
              Review and action supervisor-submitted requests
            </p>
          </div>
          {pendingCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
              {pendingCount} pending
            </span>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: "Pending Approvals",
            value: pendingCount,
            icon: <Clock className="w-5 h-5 text-yellow-500" />,
            color: "text-yellow-600",
          },
          {
            label: "Approved Today",
            value: approvedToday,
            icon: <CheckCircle className="w-5 h-5 text-green-500" />,
            color: "text-green-600",
          },
          {
            label: "Rejected Today",
            value: rejectedToday,
            icon: <XCircle className="w-5 h-5 text-red-400" />,
            color: "text-red-500",
          },
        ].map((c) => (
          <div
            key={c.label}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-3"
          >
            {c.icon}
            <div>
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
        <TabsList className="bg-gray-100">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key} className="text-xs">
              {t.label}
              {t.key === "all" && pendingCount > 0 && (
                <span className="ml-1.5 bg-yellow-400 text-white text-xs font-bold px-1.5 rounded-full">
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((t) => (
          <TabsContent key={t.key} value={t.key}>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {filtered.length === 0 ? (
                <div
                  className="py-14 text-center text-gray-400 text-sm"
                  data-ocid="approvals.empty_state"
                >
                  <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  No requests found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left px-4 py-3 font-medium text-gray-500">
                          Type
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">
                          Employee
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">
                          Date
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">
                          Old Value
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">
                          New Value
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">
                          Reason
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">
                          By
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
                      {filtered.map((req, idx) => (
                        <tr
                          key={req.id}
                          className="hover:bg-gray-50"
                          data-ocid={`approvals.item.${idx + 1}`}
                        >
                          <td className="px-4 py-3">
                            <TypeBadge type={req.requestType} />
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {empMap[req.employeeId] ?? req.employeeId}
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs">
                            {formatDateStr(req.date)}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 max-w-[120px]">
                            <span className="text-red-500">
                              {compactValue(req.oldValue)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-700 max-w-[120px]">
                            <span className="text-green-700 font-medium">
                              {compactValue(req.newValue)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 max-w-[150px] truncate text-xs">
                            {req.reason}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {req.requestedBy}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={req.status} />
                            {req.status !== "pending" && req.approvedBy && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                by {req.approvedBy}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {req.status === "pending" ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openApprove(req)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100"
                                  data-ocid="approvals.confirm_button"
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />{" "}
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openReject(req)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100"
                                  data-ocid="approvals.cancel_button"
                                >
                                  <XCircle className="w-3.5 h-3.5" /> Reject
                                </button>
                              </div>
                            ) : (
                              <div className="text-xs text-gray-400">
                                {req.approvalRemark && (
                                  <span
                                    title={req.approvalRemark}
                                    className="truncate block max-w-[100px]"
                                  >
                                    {req.approvalRemark}
                                  </span>
                                )}
                                {req.approvedAt > 0 && (
                                  <span>
                                    {new Date(
                                      req.approvedAt,
                                    ).toLocaleDateString("en-IN")}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Approve / Reject Dialog */}
      <Dialog open={!!actionReq} onOpenChange={(o) => !o && setActionReq(null)}>
        <DialogContent className="max-w-md" data-ocid="approvals.dialog">
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" ? "Approve Request" : "Reject Request"}
            </DialogTitle>
          </DialogHeader>
          {actionReq && (
            <div className="space-y-4 py-2">
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <TypeBadge type={actionReq.requestType} />
                  <span className="text-xs text-gray-400">
                    {formatDateStr(actionReq.date)}
                  </span>
                </div>
                <p className="text-gray-700 font-medium mt-1">
                  {empMap[actionReq.employeeId] ?? actionReq.employeeId}
                </p>
                <p className="text-xs text-gray-500">
                  <span className="text-red-500">
                    {compactValue(actionReq.oldValue)}
                  </span>
                  {" → "}
                  <span className="text-green-700 font-medium">
                    {compactValue(actionReq.newValue)}
                  </span>
                </p>
                <p className="text-xs text-gray-500">
                  Reason: {actionReq.reason}
                </p>
              </div>
              <div>
                <Label htmlFor="approval-remark">
                  {actionType === "reject"
                    ? "Rejection Reason *"
                    : "Approval Remark (optional)"}
                </Label>
                <textarea
                  id="approval-remark"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder={
                    actionType === "reject"
                      ? "State reason for rejection..."
                      : "Optional note..."
                  }
                  className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 h-20 resize-none focus:outline-none"
                  data-ocid="approvals.textarea"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setActionReq(null)}
                  data-ocid="approvals.close_button"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitAction}
                  disabled={submitting}
                  className={
                    actionType === "approve"
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-red-500 hover:bg-red-600"
                  }
                  data-ocid={
                    actionType === "approve"
                      ? "approvals.confirm_button"
                      : "approvals.delete_button"
                  }
                >
                  {submitting
                    ? "Processing..."
                    : actionType === "approve"
                      ? "Confirm Approve"
                      : "Confirm Reject"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Legend */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">
          Request Types
        </p>
        <div className="flex flex-wrap gap-3">
          {[
            {
              icon: <FileText className="w-3.5 h-3.5" />,
              label: "Attendance Correction",
              color: "text-blue-600",
            },
            {
              icon: <TrendingUp className="w-3.5 h-3.5" />,
              label: "OT Request",
              color: "text-purple-600",
            },
            {
              icon: <IndianRupee className="w-3.5 h-3.5" />,
              label: "Advance Request",
              color: "text-orange-600",
            },
          ].map((item) => (
            <span
              key={item.label}
              className={`flex items-center gap-1.5 text-xs ${item.color}`}
            >
              {item.icon} {item.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
