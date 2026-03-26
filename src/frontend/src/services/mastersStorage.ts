/**
 * mastersStorage.ts
 * localStorage-backed CRUD for Trade, Department, Site masters.
 * Completely independent of the ICP canister so it never fails with IC0508.
 */
import type { Department, Site, Trade } from "../types";

const KEYS = {
  trades: "clf_trades",
  departments: "clf_departments",
  sites: "clf_sites",
  counter: "clf_master_counter",
};

function getCounter(): number {
  return Number.parseInt(localStorage.getItem(KEYS.counter) || "0", 10);
}

function nextId(): string {
  const c = getCounter() + 1;
  localStorage.setItem(KEYS.counter, String(c));
  return `local-${c}-${Date.now()}`;
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

function toLower(s: string): string {
  return s.toLowerCase().trim();
}

// ── Trades ────────────────────────────────────────────────────────────────

export function getTrades(): { trades: Trade[]; activeTrades: Trade[] } {
  const raw = load<{
    id: string;
    name: string;
    status: string;
    createdAt: number;
  }>(KEYS.trades);
  const trades: Trade[] = raw.map((r) => ({
    ...r,
    createdAt: BigInt(r.createdAt),
  }));
  return { trades, activeTrades: trades.filter((t) => t.status === "active") };
}

export function createTrade(name: string): boolean {
  const raw = load<{
    id: string;
    name: string;
    status: string;
    createdAt: number;
  }>(KEYS.trades);
  if (raw.some((t) => toLower(t.name) === toLower(name))) return false;
  raw.push({
    id: nextId(),
    name: name.trim(),
    status: "active",
    createdAt: Date.now(),
  });
  save(KEYS.trades, raw);
  return true;
}

export function updateTrade(id: string, name: string, status: string): boolean {
  const raw = load<{
    id: string;
    name: string;
    status: string;
    createdAt: number;
  }>(KEYS.trades);
  const idx = raw.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  raw[idx] = { ...raw[idx], name: name.trim(), status };
  save(KEYS.trades, raw);
  return true;
}

// ── Departments ───────────────────────────────────────────────────────────

export function getDepartments(): {
  departments: Department[];
  activeDepartments: Department[];
} {
  const raw = load<{
    id: string;
    name: string;
    status: string;
    createdAt: number;
  }>(KEYS.departments);
  const departments: Department[] = raw.map((r) => ({
    ...r,
    createdAt: BigInt(r.createdAt),
  }));
  return {
    departments,
    activeDepartments: departments.filter((d) => d.status === "active"),
  };
}

export function createDepartment(name: string): boolean {
  const raw = load<{
    id: string;
    name: string;
    status: string;
    createdAt: number;
  }>(KEYS.departments);
  if (raw.some((d) => toLower(d.name) === toLower(name))) return false;
  raw.push({
    id: nextId(),
    name: name.trim(),
    status: "active",
    createdAt: Date.now(),
  });
  save(KEYS.departments, raw);
  return true;
}

export function updateDepartment(
  id: string,
  name: string,
  status: string,
): boolean {
  const raw = load<{
    id: string;
    name: string;
    status: string;
    createdAt: number;
  }>(KEYS.departments);
  const idx = raw.findIndex((d) => d.id === id);
  if (idx === -1) return false;
  raw[idx] = { ...raw[idx], name: name.trim(), status };
  save(KEYS.departments, raw);
  return true;
}

// ── Sites ─────────────────────────────────────────────────────────────────

type RawSite = {
  id: string;
  siteCode: string;
  name: string;
  status: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  createdAt: number;
};

export function getSites(): { sites: Site[]; activeSites: Site[] } {
  const raw = load<RawSite>(KEYS.sites);
  const sites: Site[] = raw.map((r) => ({
    ...r,
    siteCode: r.siteCode || "",
    createdAt: BigInt(r.createdAt),
  }));
  return { sites, activeSites: sites.filter((s) => s.status === "active") };
}

export function createSite(
  siteCode: string,
  name: string,
  lat: number,
  lng: number,
  radiusMeters: number,
): boolean {
  const raw = load<RawSite>(KEYS.sites);
  if (raw.some((s) => toLower(s.name) === toLower(name))) return false;
  raw.push({
    id: nextId(),
    siteCode: siteCode.trim(),
    name: name.trim(),
    status: "active",
    lat,
    lng,
    radiusMeters,
    createdAt: Date.now(),
  });
  save(KEYS.sites, raw);
  return true;
}

export function updateSite(
  id: string,
  siteCode: string,
  name: string,
  status: string,
  lat: number,
  lng: number,
  radiusMeters: number,
): boolean {
  const raw = load<RawSite>(KEYS.sites);
  const idx = raw.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  raw[idx] = {
    ...raw[idx],
    siteCode: siteCode.trim(),
    name: name.trim(),
    status,
    lat,
    lng,
    radiusMeters,
  };
  save(KEYS.sites, raw);
  return true;
}
