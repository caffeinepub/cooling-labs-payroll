/**
 * workforceStorage.ts
 * localStorage-backed CRUD for Employees and Supervisors.
 * Bypasses the ICP canister entirely.
 */
import type { Employee, Supervisor } from "../types";

const KEYS = {
  employees: "clf_employees",
  supervisors: "clf_supervisors",
  counter: "clf_workforce_counter",
};

function getCounter(): number {
  return Number.parseInt(localStorage.getItem(KEYS.counter) || "0", 10);
}

function nextId(): string {
  const c = getCounter() + 1;
  localStorage.setItem(KEYS.counter, String(c));
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

// ── Employees ────────────────────────────────────────────────────────────

export function getEmployees(): {
  allEmployees: Employee[];
  activeEmployees: Employee[];
} {
  const raw = load<RawEmployee>(KEYS.employees);
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
  const raw = load<RawEmployee>(KEYS.employees);
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
  save(KEYS.employees, raw);
  return true;
}

export function updateEmployee(id: string, emp: Partial<Employee>): boolean {
  const raw = load<RawEmployee>(KEYS.employees);
  const idx = raw.findIndex((e) => e.id === id);
  if (idx === -1) return false;
  raw[idx] = { ...raw[idx], ...emp, id, createdAt: raw[idx].createdAt };
  save(KEYS.employees, raw);
  return true;
}

export function getEmployeesBySite(siteId: string): {
  allEmployees: Employee[];
  activeEmployees: Employee[];
} {
  const raw = load<RawEmployee>(KEYS.employees);
  const all: Employee[] = raw
    .filter((e) => e.site === siteId)
    .map((r) => ({ ...r, createdAt: BigInt(r.createdAt) }));
  return {
    allEmployees: all,
    activeEmployees: all.filter((e) => e.status === "active"),
  };
}

// ── Supervisors ──────────────────────────────────────────────────────────

export function getSupervisors(): Supervisor[] {
  return load<Supervisor>(KEYS.supervisors);
}

export function createSupervisor(sup: Supervisor): boolean {
  const raw = load<Supervisor>(KEYS.supervisors);
  // Check duplicate phone
  if (raw.some((s) => s.phone === sup.phone)) return false;
  // Check duplicate username if provided
  if (sup.username && raw.some((s) => s.username === sup.username))
    return false;
  raw.push(sup);
  save(KEYS.supervisors, raw);
  return true;
}

export function updateSupervisor(
  phone: string,
  sup: Partial<Supervisor>,
): boolean {
  const raw = load<Supervisor>(KEYS.supervisors);
  const idx = raw.findIndex((s) => s.phone === phone);
  if (idx === -1) return false;
  raw[idx] = { ...raw[idx], ...sup, phone };
  save(KEYS.supervisors, raw);
  return true;
}

export function deleteSupervisor(phone: string): boolean {
  const raw = load<Supervisor>(KEYS.supervisors);
  const filtered = raw.filter((s) => s.phone !== phone);
  if (filtered.length === raw.length) return false;
  save(KEYS.supervisors, filtered);
  return true;
}

export function verifySupervisorPin(phone: string, pin: string): boolean {
  const raw = load<Supervisor>(KEYS.supervisors);
  const sup = raw.find((s) => s.phone === phone && s.active);
  return sup?.pin === pin;
}

/**
 * Login supervisor by username + password (credential-based, works across browsers
 * as long as the same localStorage is present, or supervisor was created on this device).
 * Returns the matched supervisor or null.
 */
export function loginSupervisorByCredentials(
  username: string,
  password: string,
): Supervisor | null {
  const raw = load<Supervisor>(KEYS.supervisors);
  const sup = raw.find(
    (s) =>
      s.active &&
      s.username &&
      s.username.toLowerCase() === username.toLowerCase() &&
      s.password === password,
  );
  return sup ?? null;
}

/**
 * Reset a supervisor's password by admin.
 */
export function resetSupervisorPassword(
  phone: string,
  newPassword: string,
): boolean {
  return updateSupervisor(phone, { password: newPassword });
}
