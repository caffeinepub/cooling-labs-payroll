/**
 * regularizationStorage.ts — tenant-aware regularization requests and audit logs.
 */
import type { AuditLog, RegularizationRequest } from "../types";
import { createApprovalRequest } from "./approvalsStorage";
import {
  getAttendanceByMonth,
  regularizeAttendance,
  updateAttendanceAdvance,
  updateAttendanceOT,
} from "./attendanceStorage";
import { getPayrollWithBreakdown, overwritePayroll } from "./payrollStorage";
import { pushModuleToCanister } from "./syncAllModulesFromCanister";
import { getActiveCompanyId, getTenantKey } from "./tenantStorage";

function getKeys() {
  const cid = getActiveCompanyId();
  return {
    requests: getTenantKey(cid, "clf_reg_requests"),
    auditLogs: getTenantKey(cid, "clf_audit_logs"),
  };
}

type RawRequest = Omit<RegularizationRequest, "approvedAt" | "createdAt"> & {
  approvedAt: number;
  createdAt: number;
  payrollRecalculated?: boolean;
};

type RawLog = Omit<AuditLog, "timestamp"> & { timestamp: number };

function loadRequests(): RawRequest[] {
  try {
    const raw = localStorage.getItem(getKeys().requests);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveRequests(data: RawRequest[]): void {
  localStorage.setItem(getKeys().requests, JSON.stringify(data));
  pushModuleToCanister("clf_reg_requests");
}

function loadLogs(): RawLog[] {
  try {
    const raw = localStorage.getItem(getKeys().auditLogs);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLogs(data: RawLog[]): void {
  localStorage.setItem(getKeys().auditLogs, JSON.stringify(data));
  pushModuleToCanister("clf_audit_logs");
}

function toRequest(
  r: RawRequest,
): RegularizationRequest & { payrollRecalculated?: boolean } {
  return {
    ...r,
    approvedAt: BigInt(r.approvedAt),
    createdAt: BigInt(r.createdAt),
  };
}

function toLog(l: RawLog): AuditLog {
  return { ...l, timestamp: BigInt(l.timestamp) };
}

function genId(): string {
  return `reg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function syncPayrollAfterApproval(
  _employeeId: string,
  date: string,
): boolean {
  try {
    const year = Number.parseInt(date.slice(0, 4), 10);
    const month = Number.parseInt(date.slice(4, 6), 10);
    if (Number.isNaN(month) || Number.isNaN(year)) return false;
    const existing = getPayrollWithBreakdown(BigInt(month), BigInt(year));
    if (existing.length === 0) return false;
    overwritePayroll(BigInt(month), BigInt(year), "regularization");
    return true;
  } catch {
    return false;
  }
}

export function addAuditLog(
  entityType: string,
  entityId: string,
  oldValue: string,
  newValue: string,
  changedBy: string,
  reason: string,
): void {
  const logs = loadLogs();
  logs.push({
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    entityType,
    entityId,
    oldValue,
    newValue,
    changedBy,
    timestamp: Date.now(),
    reason,
  });
  saveLogs(logs);
}

export function getRegularizationRequests(): (RegularizationRequest & {
  payrollRecalculated?: boolean;
})[] {
  return loadRequests().map(toRequest);
}

export function createRegularizationRequest(
  empId: string,
  dateStr: string,
  oldStatus: string,
  newStatus: string,
  reason: string,
  requestedBy: string,
  opts?: {
    oldOtHours?: number;
    newOtHours?: number;
    oldAdvance?: number;
    newAdvance?: number;
    requestType?: "status" | "ot" | "advance" | "combined";
    siteId?: string;
    approvalRemark?: string;
  },
): boolean {
  const requests = loadRequests();
  const id = genId();
  requests.push({
    id,
    employeeId: empId,
    date: dateStr,
    oldStatus,
    requestedStatus: newStatus,
    reason,
    requestedBy,
    approvalStatus: "pending",
    approvedBy: "",
    approvedAt: 0,
    createdAt: Date.now(),
    oldOtHours: opts?.oldOtHours,
    newOtHours: opts?.newOtHours,
    oldAdvance: opts?.oldAdvance,
    newAdvance: opts?.newAdvance,
    requestType: opts?.requestType,
    siteId: opts?.siteId,
    approvalRemark: opts?.approvalRemark,
    payrollRecalculated: false,
  });
  saveRequests(requests);

  const monthRef = dateStr.slice(0, 6);
  const reqType = opts?.requestType;
  let approvalReqType:
    | "attendance_correction"
    | "ot_request"
    | "advance_request"
    | "regularization" = "regularization";
  if (reqType === "ot") approvalReqType = "ot_request";
  else if (reqType === "advance") approvalReqType = "advance_request";
  else if (reqType === "status") approvalReqType = "attendance_correction";

  createApprovalRequest({
    requestType: approvalReqType,
    employeeId: empId,
    siteId: opts?.siteId ?? "",
    date: dateStr,
    monthRef,
    oldValue: {
      status: oldStatus,
      otHours: opts?.oldOtHours ?? 0,
      advance: opts?.oldAdvance ?? 0,
    },
    newValue: {
      status: newStatus,
      otHours: opts?.newOtHours ?? 0,
      advance: opts?.newAdvance ?? 0,
    },
    reason,
    requestedBy,
  });

  return true;
}

export function approveRegularizationRequest(
  id: string,
  approvedBy: string,
  remark?: string,
): { ok: boolean; payrollRecalculated: boolean } {
  const requests = loadRequests();
  const idx = requests.findIndex((r) => r.id === id);
  if (idx === -1) return { ok: false, payrollRecalculated: false };
  const req = requests[idx];
  req.approvalStatus = "approved";
  req.approvedBy = approvedBy;
  req.approvedAt = Date.now();
  if (remark) req.approvalRemark = remark;

  const m = req.date.slice(4, 6);
  const y = req.date.slice(0, 4);
  const recs = getAttendanceByMonth(m, y);
  const attRec = recs.find(
    (r) => r.employeeId === req.employeeId && r.date === req.date,
  );

  if (attRec) {
    const reqType = req.requestType ?? "status";
    if (reqType === "status" || reqType === "combined") {
      const newOT =
        reqType === "combined" && req.newOtHours !== undefined
          ? req.newOtHours
          : attRec.otHours;
      regularizeAttendance(
        attRec.id,
        req.requestedStatus || attRec.status,
        newOT,
        req.reason,
        approvedBy,
      );
    }
    if (reqType === "ot" || reqType === "combined") {
      if (req.newOtHours !== undefined) {
        updateAttendanceOT(
          req.employeeId,
          req.date,
          req.newOtHours,
          approvedBy,
        );
      }
    }
    if (reqType === "advance" || reqType === "combined") {
      if (req.newAdvance !== undefined && req.newAdvance >= 0) {
        updateAttendanceAdvance(
          req.employeeId,
          req.date,
          req.newAdvance,
          approvedBy,
        );
      }
    }
  } else {
    if (req.newAdvance !== undefined && req.newAdvance >= 0) {
      updateAttendanceAdvance(
        req.employeeId,
        req.date,
        req.newAdvance,
        approvedBy,
      );
    }
    if (req.newOtHours !== undefined) {
      updateAttendanceOT(req.employeeId, req.date, req.newOtHours, approvedBy);
    }
  }

  const payrollRecalculated = syncPayrollAfterApproval(
    req.employeeId,
    req.date,
  );
  req.payrollRecalculated = payrollRecalculated;
  saveRequests(requests);

  addAuditLog(
    "regularization",
    id,
    JSON.stringify({
      status: req.oldStatus,
      otHours: req.oldOtHours,
      advance: req.oldAdvance,
    }),
    JSON.stringify({
      status: req.requestedStatus,
      otHours: req.newOtHours,
      advance: req.newAdvance,
    }),
    approvedBy,
    req.reason,
  );

  return { ok: true, payrollRecalculated };
}

export function rejectRegularizationRequest(
  id: string,
  rejectedBy: string,
  remark?: string,
): boolean {
  const requests = loadRequests();
  const idx = requests.findIndex((r) => r.id === id);
  if (idx === -1) return false;
  const req = requests[idx];
  req.approvalStatus = "rejected";
  req.approvedBy = rejectedBy;
  req.approvedAt = Date.now();
  if (remark) req.approvalRemark = remark;
  saveRequests(requests);
  addAuditLog(
    "regularization",
    id,
    JSON.stringify({ status: req.oldStatus }),
    "rejected",
    rejectedBy,
    remark ?? "Request rejected",
  );
  return true;
}

export function getAuditLogs(): AuditLog[] {
  return loadLogs().map(toLog);
}
