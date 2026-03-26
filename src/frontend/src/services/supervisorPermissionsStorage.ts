/**
 * supervisorPermissionsStorage.ts
 * Global default permissions template + per-supervisor overrides.
 * Logic: per-supervisor permissions override global defaults.
 */
import type { SupervisorPermissions } from "../types";

const GLOBAL_KEY = "clf_supervisor_permissions_global";
const PER_KEY = "clf_supervisor_permissions";

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
    const raw = localStorage.getItem(GLOBAL_KEY);
    if (!raw) return { ...DEFAULT_PERMISSIONS };
    return JSON.parse(raw) as SupervisorPermissions;
  } catch {
    return { ...DEFAULT_PERMISSIONS };
  }
}

export function saveGlobalDefaults(p: SupervisorPermissions): void {
  localStorage.setItem(GLOBAL_KEY, JSON.stringify(p));
}

export function getPermissionsForSupervisor(
  phone: string,
): SupervisorPermissions {
  try {
    const raw = localStorage.getItem(PER_KEY);
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
    const raw = localStorage.getItem(PER_KEY);
    const all: Record<string, SupervisorPermissions> = raw
      ? JSON.parse(raw)
      : {};
    all[phone] = p;
    localStorage.setItem(PER_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}
