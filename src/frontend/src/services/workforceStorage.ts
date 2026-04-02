/**
 * workforceStorage.ts
 * localStorage-backed CRUD for Employees and Supervisors.
 * Tenant-aware: all keys are prefixed with the active company ID.
 * Supervisors also write to canister KV store for cross-browser persistence.
 */
import type { Employee, Supervisor } from "../types";
import { pushModuleToCanister } from "./syncAllModulesFromCanister";
import { getActiveCompanyId, getTenantKey } from "./tenantStorage";

function getKeys() {
  const cid = getActiveCompanyId();
  return {
    employees: getTenantKey(cid, "clf_employees"),
    supervisors: getTenantKey(cid, "clf_supervisors"),
    counter: getTenantKey(cid, "clf_workforce_counter"),
  };
}

function getCounter(): number {
  return Number.parseInt(localStorage.getItem(getKeys().counter) || "0", 10);
}

function nextId(): string {
  const c = getCounter() + 1;
  localStorage.setItem(getKeys().counter, String(c));
  return `emp-${c}-${Date.now()}`;
}

function load<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function save<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

type RawEmployee = Omit<Employee, "createdAt"> & { createdAt: number };

// ── Employees ────────────────────────────────────────────────

export function getEmployees(): {
  allEmployees: Employee[];
  activeEmployees: Employee[];
} {
  const raw = load<RawEmployee>(getKeys().employees);
  const all: Employee[] = raw.map((r) => ({
    ...r,
    createdAt: BigInt(r.createdAt),
  }));
  return {
    allEmployees: all,
    activeEmployees: all.filter((e) => e.status === "active"),
  };
}

export function createEmployee(
  emp: Omit<Employee, "id"> & { id?: string },
): boolean {
  const raw = load<RawEmployee>(getKeys().employees);
  if (
    raw.some((e) => e.employeeId.toLowerCase() === emp.employeeId.toLowerCase())
  ) {
    return false;
  }
  const newEmp: RawEmployee = {
    ...emp,
    id: nextId(),
    createdAt: Date.now(),
  };
  raw.push(newEmp);
  save(getKeys().employees, raw);
  return true;
}

export function updateEmployee(id: string, emp: Partial<Employee>): boolean {
  const raw = load<RawEmployee>(getKeys().employees);
  const idx = raw.findIndex((e) => e.id === id);
  if (idx === -1) return false;
  raw[idx] = { ...raw[idx], ...emp, id, createdAt: raw[idx].createdAt };
  save(getKeys().employees, raw);
  return true;
}

export function getEmployeesBySite(siteId: string): {
  allEmployees: Employee[];
  activeEmployees: Employee[];
} {
  const raw = load<RawEmployee>(getKeys().employees);
  const all: Employee[] = raw
    .filter((e) => e.site === siteId)
    .map((r) => ({ ...r, createdAt: BigInt(r.createdAt) }));
  return {
    allEmployees: all,
    activeEmployees: all.filter((e) => e.status === "active"),
  };
}

// ── Supervisors ────────────────────────────────────────────────

function saveSupervisors(data: Supervisor[]): void {
  save(getKeys().supervisors, data);
  pushModuleToCanister("clf_supervisors");
}

export function getSupervisors(): Supervisor[] {
  return load<Supervisor>(getKeys().supervisors);
}

export function createSupervisor(sup: Supervisor): boolean {
  const raw = load<Supervisor>(getKeys().supervisors);
  if (raw.some((s) => s.phone === sup.phone)) return false;
  if (sup.username && raw.some((s) => s.username === sup.username))
    return false;
  raw.push(sup);
  saveSupervisors(raw);
  return true;
}

export function updateSupervisor(
  phone: string,
  sup: Partial<Supervisor>,
): boolean {
  const raw = load<Supervisor>(getKeys().supervisors);
  const idx = raw.findIndex((s) => s.phone === phone);
  if (idx === -1) return false;
  raw[idx] = { ...raw[idx], ...sup, phone };
  saveSupervisors(raw);
  return true;
}

export function deleteSupervisor(phone: string): boolean {
  const raw = load<Supervisor>(getKeys().supervisors);
  const filtered = raw.filter((s) => s.phone !== phone);
  if (filtered.length === raw.length) return false;
  saveSupervisors(filtered);
  return true;
}

export function verifySupervisorPin(phone: string, pin: string): boolean {
  const raw = load<Supervisor>(getKeys().supervisors);
  const sup = raw.find((s) => s.phone === phone && s.active);
  return sup?.pin === pin;
}

export function loginSupervisorByCredentials(
  username: string,
  password: string,
): Supervisor | null {
  const raw = load<Supervisor>(getKeys().supervisors);
  const sup = raw.find(
    (s) =>
      s.active &&
      s.username &&
      s.username.toLowerCase() === username.toLowerCase() &&
      s.password === password,
  );
  return sup ?? null;
}

export function resetSupervisorPassword(
  phone: string,
  newPassword: string,
): boolean {
  return updateSupervisor(phone, { password: newPassword });
}
