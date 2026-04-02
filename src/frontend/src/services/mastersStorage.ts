/**
 * mastersStorage.ts
 * localStorage-backed CRUD for Trade, Department, Site masters.
 * Tenant-aware: all keys are prefixed with the active company ID.
 * Canister-backed: every write also pushes to the ICP canister KV store.
 */
import type { Department, Site, Trade } from "../types";
import { pushModuleToCanister } from "./syncAllModulesFromCanister";
import { getActiveCompanyId, getTenantKey } from "./tenantStorage";

function getKeys() {
  const cid = getActiveCompanyId();
  return {
    trades: getTenantKey(cid, "clf_trades"),
    departments: getTenantKey(cid, "clf_departments"),
    sites: getTenantKey(cid, "clf_sites"),
    counter: getTenantKey(cid, "clf_master_counter"),
  };
}

function getCounter(): number {
  return Number.parseInt(localStorage.getItem(getKeys().counter) || "0", 10);
}

function nextId(): string {
  const c = getCounter() + 1;
  localStorage.setItem(getKeys().counter, String(c));
  pushModuleToCanister("clf_master_counter");
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

function save<T>(key: string, baseKey: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
  pushModuleToCanister(baseKey);
}

function toLower(s: string): string {
  return s.toLowerCase().trim();
}

// ── Trades ──────────────────────────────────────────────────────

export function getTrades(): { trades: Trade[]; activeTrades: Trade[] } {
  const raw = load<{
    id: string;
    name: string;
    status: string;
    createdAt: number;
  }>(getKeys().trades);
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
  }>(getKeys().trades);
  if (raw.some((t) => toLower(t.name) === toLower(name))) return false;
  raw.push({
    id: nextId(),
    name: name.trim(),
    status: "active",
    createdAt: Date.now(),
  });
  save(getKeys().trades, "clf_trades", raw);
  return true;
}

export function updateTrade(id: string, name: string, status: string): boolean {
  const raw = load<{
    id: string;
    name: string;
    status: string;
    createdAt: number;
  }>(getKeys().trades);
  const idx = raw.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  raw[idx] = { ...raw[idx], name: name.trim(), status };
  save(getKeys().trades, "clf_trades", raw);
  return true;
}

// ── Departments ────────────────────────────────────────────────

export function getDepartments(): {
  departments: Department[];
  activeDepartments: Department[];
} {
  const raw = load<{
    id: string;
    name: string;
    status: string;
    createdAt: number;
  }>(getKeys().departments);
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
  }>(getKeys().departments);
  if (raw.some((d) => toLower(d.name) === toLower(name))) return false;
  raw.push({
    id: nextId(),
    name: name.trim(),
    status: "active",
    createdAt: Date.now(),
  });
  save(getKeys().departments, "clf_departments", raw);
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
  }>(getKeys().departments);
  const idx = raw.findIndex((d) => d.id === id);
  if (idx === -1) return false;
  raw[idx] = { ...raw[idx], name: name.trim(), status };
  save(getKeys().departments, "clf_departments", raw);
  return true;
}

// ── Sites ─────────────────────────────────────────────────────────

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
  const raw = load<RawSite>(getKeys().sites);
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
  const raw = load<RawSite>(getKeys().sites);
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
  save(getKeys().sites, "clf_sites", raw);
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
  const raw = load<RawSite>(getKeys().sites);
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
  save(getKeys().sites, "clf_sites", raw);
  return true;
}
