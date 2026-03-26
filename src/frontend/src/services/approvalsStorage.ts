/**
 * approvalsStorage.ts — tenant-aware unified approval request store.
 */
import type { ApprovalRequest } from "../types";
import {
  getAttendanceByMonth,
  regularizeAttendance,
  updateAttendanceAdvance,
  updateAttendanceOT,
} from "./attendanceStorage";
import { getActiveCompanyId, getTenantKey } from "./tenantStorage";

function getKey(): string {
  return getTenantKey(getActiveCompanyId(), "clf_approval_requests");
}

function load(): ApprovalRequest[] {
  try {
    const raw = localStorage.getItem(getKey());
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function save(data: ApprovalRequest[]): void {
  localStorage.setItem(getKey(), JSON.stringify(data));
  try {
    window.dispatchEvent(new CustomEvent("clf:attendance-updated"));
  } catch {}
}

function genId(): string {
  return `apr-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function findAttRecord(employeeId: string, dateStr: string) {
  const m = dateStr.slice(4, 6);
  const y = dateStr.slice(0, 4);
  const recs = getAttendanceByMonth(m, y);
  return (
    recs.find((r) => r.employeeId === employeeId && r.date === dateStr) ?? null
  );
}

export function getApprovalRequests(): ApprovalRequest[] {
  return load();
}

export function getPendingCount(): number {
  return load().filter((r) => r.status === "pending").length;
}

export function createApprovalRequest(
  req: Omit<
    ApprovalRequest,
    | "id"
    | "status"
    | "approvedBy"
    | "approvedAt"
    | "approvalRemark"
    | "createdAt"
  >,
): string {
  const requests = load();
  const id = genId();
  requests.push({
    ...req,
    id,
    status: "pending",
    approvedBy: "",
    approvedAt: 0,
    approvalRemark: "",
    createdAt: Date.now(),
  });
  save(requests);
  return id;
}

export function approveRequest(
  id: string,
  approvedBy: string,
  remark: string,
): boolean {
  const requests = load();
  const idx = requests.findIndex((r) => r.id === id);
  if (idx === -1) return false;
  const req = requests[idx];

  const attRec = findAttRecord(req.employeeId, req.date);

  if (
    req.requestType === "attendance_correction" ||
    req.requestType === "regularization"
  ) {
    const newStatus = (req.newValue.status as string) ?? "Present";
    const newOT = (req.newValue.otHours as number) ?? 0;
    const newAdv =
      (req.newValue.advance as number) ??
      (req.newValue.advanceAmount as number) ??
      0;
    if (attRec) {
      regularizeAttendance(attRec.id, newStatus, newOT, req.reason, approvedBy);
      if (newAdv > 0) {
        updateAttendanceAdvance(req.employeeId, req.date, newAdv, approvedBy);
      }
    }
  } else if (req.requestType === "ot_request") {
    const newOT = (req.newValue.otHours as number) ?? 0;
    if (attRec) {
      updateAttendanceOT(req.employeeId, req.date, newOT, approvedBy);
    }
  } else if (req.requestType === "advance_request") {
    const newAdv =
      (req.newValue.advance as number) ??
      (req.newValue.advanceAmount as number) ??
      0;
    updateAttendanceAdvance(req.employeeId, req.date, newAdv, approvedBy);
  }

  requests[idx] = {
    ...req,
    status: "approved",
    approvedBy,
    approvedAt: Date.now(),
    approvalRemark: remark,
  };
  save(requests);
  return true;
}

export function rejectRequest(
  id: string,
  approvedBy: string,
  remark: string,
): boolean {
  const requests = load();
  const idx = requests.findIndex((r) => r.id === id);
  if (idx === -1) return false;
  requests[idx] = {
    ...requests[idx],
    status: "rejected",
    approvedBy,
    approvedAt: Date.now(),
    approvalRemark: remark,
  };
  save(requests);
  return true;
}

export function cancelRequest(id: string, cancelledBy: string): boolean {
  const requests = load();
  const idx = requests.findIndex((r) => r.id === id);
  if (idx === -1) return false;
  requests[idx] = {
    ...requests[idx],
    status: "cancelled",
    approvedBy: cancelledBy,
    approvedAt: Date.now(),
    approvalRemark: "Cancelled",
  };
  save(requests);
  return true;
}

export function getRequestsByEmployee(employeeId: string): ApprovalRequest[] {
  return load().filter((r) => r.employeeId === employeeId);
}

export function getRequestsBySite(siteId: string): ApprovalRequest[] {
  return load().filter((r) => r.siteId === siteId);
}
