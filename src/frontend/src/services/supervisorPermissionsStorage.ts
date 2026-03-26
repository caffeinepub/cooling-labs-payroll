/**
 * supervisorPermissionsStorage.ts — tenant-aware supervisor permissions.
 */
import type { SupervisorPermissions } from "../types";
import { getActiveCompanyId, getTenantKey } from "./tenantStorage";

function getStorageKeys() {
  const cid = getActiveCompanyId();
  return {
    global: getTenantKey(cid, "clf_supervisor_permissions_global"),
    per: getTenantKey(cid, "clf_supervisor_permissions"),
  };
}

export const DEFAULT_PERMISSIONS: SupervisorPermissions = {
  attendance: {
    view: true,
    mark: true,
    bulk: true,
    dateRange: false,
    requestCorrectionOnly: false,
  },
  ot: {
    view: true,
    add: true,
    requireApproval: true,
  },
  advance: {
    view: true,
    add: true,
    requireApproval: true,
  },
  payroll: {
    viewSummary: true,
    viewRows: false,
    downloadPayslip: false,
  },
  import: {
    viewHistory: true,
    upload: false,
    requireApproval: true,
  },
  regularization: {
    raise: true,
    approve: false,
  },
};

export function getGlobalDefaults(): SupervisorPermissions {
  try {
    const raw = localStorage.getItem(getStorageKeys().global);
    if (!raw) return { ...DEFAULT_PERMISSIONS };
    return JSON.parse(raw) as SupervisorPermissions;
  } catch {
    return { ...DEFAULT_PERMISSIONS };
  }
}

export function saveGlobalDefaults(p: SupervisorPermissions): void {
  localStorage.setItem(getStorageKeys().global, JSON.stringify(p));
}

export function getPermissionsForSupervisor(
  phone: string,
): SupervisorPermissions {
  try {
    const raw = localStorage.getItem(getStorageKeys().per);
    if (!raw) return getGlobalDefaults();
    const all = JSON.parse(raw) as Record<string, SupervisorPermissions>;
    return all[phone] ?? getGlobalDefaults();
  } catch {
    return getGlobalDefaults();
  }
}

export function savePermissionsForSupervisor(
  phone: string,
  p: SupervisorPermissions,
): void {
  try {
    const raw = localStorage.getItem(getStorageKeys().per);
    const all: Record<string, SupervisorPermissions> = raw
      ? JSON.parse(raw)
      : {};
    all[phone] = p;
    localStorage.setItem(getStorageKeys().per, JSON.stringify(all));
  } catch {}
}
