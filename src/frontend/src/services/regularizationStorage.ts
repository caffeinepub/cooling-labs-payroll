/**
 * regularizationStorage.ts
 * localStorage-backed regularization requests and audit logs.
 */
import type { AuditLog, RegularizationRequest } from "../types";
import {
  getAttendanceByMonth,
  regularizeAttendance,
} from "./attendanceStorage";

const KEYS = {
  requests: "clf_reg_requests",
  auditLogs: "clf_audit_logs",
};

type RawRequest = Omit<RegularizationRequest, "approvedAt" | "createdAt"> & {
  approvedAt: number;
  createdAt: number;
};

type RawLog = Omit<AuditLog, "timestamp"> & { timestamp: number };

function loadRequests(): RawRequest[] {
  try {
    const raw = localStorage.getItem(KEYS.requests);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveRequests(data: RawRequest[]): void {
  localStorage.setItem(KEYS.requests, JSON.stringify(data));
}

function loadLogs(): RawLog[] {
  try {
    const raw = localStorage.getItem(KEYS.auditLogs);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLogs(data: RawLog[]): void {
  localStorage.setItem(KEYS.auditLogs, JSON.stringify(data));
}

function toRequest(r: RawRequest): RegularizationRequest {
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

export function getRegularizationRequests(): RegularizationRequest[] {
  return loadRequests().map(toRequest);
}

export function createRegularizationRequest(
  empId: string,
  dateStr: string,
  oldStatus: string,
  newStatus: string,
  reason: string,
  requestedBy: string,
): boolean {
  const requests = loadRequests();
  requests.push({
    id: genId(),
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
  });
  saveRequests(requests);
  return true;
}

export function approveRegularizationRequest(
  id: string,
  approvedBy: string,
): boolean {
  const requests = loadRequests();
  const idx = requests.findIndex((r) => r.id === id);
  if (idx === -1) return false;
  const req = requests[idx];
  req.approvalStatus = "approved";
  req.approvedBy = approvedBy;
  req.approvedAt = Date.now();
  saveRequests(requests);

  // Update matching attendance record
  const m = req.date.slice(4, 6);
  const y = req.date.slice(0, 4);
  const recs = getAttendanceByMonth(m, y);
  const attRec = recs.find(
    (r) => r.employeeId === req.employeeId && r.date === req.date,
  );
  if (attRec) {
    regularizeAttendance(
      attRec.id,
      req.requestedStatus,
      attRec.otHours,
      req.reason,
      approvedBy,
    );
  }

  addAuditLog(
    "regularization",
    id,
    req.oldStatus,
    req.requestedStatus,
    approvedBy,
    req.reason,
  );
  return true;
}

export function rejectRegularizationRequest(
  id: string,
  rejectedBy: string,
): boolean {
  const requests = loadRequests();
  const idx = requests.findIndex((r) => r.id === id);
  if (idx === -1) return false;
  const req = requests[idx];
  req.approvalStatus = "rejected";
  req.approvedBy = rejectedBy;
  req.approvedAt = Date.now();
  saveRequests(requests);
  addAuditLog(
    "regularization",
    id,
    req.oldStatus,
    "rejected",
    rejectedBy,
    "Request rejected",
  );
  return true;
}

export function getAuditLogs(): AuditLog[] {
  return loadLogs().map(toLog);
}
