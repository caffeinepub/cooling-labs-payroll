/**
 * attendanceStorage.ts
 * localStorage-backed attendance CRUD.
 * Bypasses ICP canister entirely.
 *
 * Canonical data store for ALL attendance sources:
 * Single Entry | Bulk | Import | WhatsApp | Regularization
 */
import type { AttendanceRecord } from "../types";

const KEY = "clf_attendance";

type RawRecord = Omit<AttendanceRecord, "updatedAt" | "createdAt"> & {
  updatedAt: number;
  createdAt: number;
  advanceAmount?: number;
  source?: string;
};

function load(): RawRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function save(data: RawRecord[]): void {
  localStorage.setItem(KEY, JSON.stringify(data));
  // Notify same-tab listeners (storage event only fires across tabs)
  try {
    window.dispatchEvent(new CustomEvent("clf:attendance-updated"));
  } catch {
    // ignore in SSR/test environments
  }
}

function toRecord(r: RawRecord): AttendanceRecord {
  return {
    ...r,
    advanceAmount: r.advanceAmount ?? 0,
    source: r.source ?? r.changedBy,
    updatedAt: BigInt(r.updatedAt),
    createdAt: BigInt(r.createdAt),
  };
}

function genId(): string {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Mark attendance for empId on dateStr.
 * Returns false (and does NOT write) if a record already exists.
 * advanceAmount — optional advance for this entry (from import / WhatsApp ADV)
 */
export function markAttendance(
  empId: string,
  dateStr: string,
  status: string,
  otHours: number,
  punchIn: string,
  punchOut: string,
  lat: number,
  lng: number,
  source: string,
  advanceAmount = 0,
): boolean {
  const records = load();
  const exists = records.some(
    (r) => r.employeeId === empId && r.date === dateStr,
  );
  if (exists) return false;
  const now = Date.now();
  records.push({
    id: genId(),
    employeeId: empId,
    date: dateStr,
    status,
    otHours,
    advanceAmount,
    source,
    punchIn,
    punchOut,
    lat,
    lng,
    isFlagged: false,
    flagReason: "",
    isRegularized: false,
    regularizationReason: "",
    changedBy: source,
    updatedAt: now,
    createdAt: now,
  });
  save(records);
  console.debug(
    `[AttendanceStorage] Created: ${empId} ${dateStr} ${status} OT=${otHours} Adv=${advanceAmount}`,
  );
  return true;
}

/**
 * Create or replace attendance for empId on dateStr (overwrite mode).
 * advanceAmount — optional advance for this entry
 */
export function markAttendanceOverwrite(
  empId: string,
  dateStr: string,
  status: string,
  otHours: number,
  punchIn: string,
  punchOut: string,
  lat: number,
  lng: number,
  source: string,
  advanceAmount = 0,
): void {
  const records = load();
  const now = Date.now();
  const idx = records.findIndex(
    (r) => r.employeeId === empId && r.date === dateStr,
  );
  const entry: RawRecord = {
    id: idx >= 0 ? records[idx].id : genId(),
    employeeId: empId,
    date: dateStr,
    status,
    otHours,
    advanceAmount,
    source,
    punchIn,
    punchOut,
    lat,
    lng,
    isFlagged: false,
    flagReason: "",
    isRegularized: false,
    regularizationReason: "",
    changedBy: source,
    updatedAt: now,
    createdAt: idx >= 0 ? records[idx].createdAt : now,
  };
  if (idx >= 0) {
    records[idx] = entry;
  } else {
    records.push(entry);
  }
  save(records);
  console.debug(
    `[AttendanceStorage] Overwrite: ${empId} ${dateStr} ${status} OT=${otHours} Adv=${advanceAmount}`,
  );
}

/**
 * Update (or create) advance amount for a specific empId + date.
 * Used by WhatsApp ADV command.
 */
export function updateAttendanceAdvance(
  empId: string,
  dateStr: string,
  advanceAmount: number,
  source: string,
): boolean {
  const records = load();
  const idx = records.findIndex(
    (r) => r.employeeId === empId && r.date === dateStr,
  );
  if (idx >= 0) {
    records[idx].advanceAmount =
      (records[idx].advanceAmount ?? 0) + advanceAmount;
    records[idx].changedBy = source;
    records[idx].updatedAt = Date.now();
    save(records);
    console.debug(
      `[AttendanceStorage] Advance updated: ${empId} ${dateStr} adv=${advanceAmount}`,
    );
    return true;
  }
  // No record for today — create one with Present status and advance
  const now = Date.now();
  records.push({
    id: genId(),
    employeeId: empId,
    date: dateStr,
    status: "Present",
    otHours: 0,
    advanceAmount,
    source,
    punchIn: "",
    punchOut: "",
    lat: 0,
    lng: 0,
    isFlagged: false,
    flagReason: "",
    isRegularized: false,
    regularizationReason: "",
    changedBy: source,
    updatedAt: now,
    createdAt: now,
  });
  save(records);
  console.debug(
    `[AttendanceStorage] Advance created: ${empId} ${dateStr} adv=${advanceAmount}`,
  );
  return true;
}

/** Return set of "empId_dateStr" keys that already exist (uses internal empId / UUID) */
export function getExistingKeys(keys: string[]): Set<string> {
  const records = load();
  // Keys are built with internal emp.id (UUID), same as stored in employeeId field
  const existing = new Set(records.map((r) => `${r.employeeId}_${r.date}`));
  const result = new Set<string>();
  for (const k of keys) {
    if (existing.has(k)) result.add(k);
  }
  return result;
}

export function bulkMarkAttendance(
  entries: [string, string, string, number][],
  source: string,
): { successCount: bigint; skippedCount: bigint; errors: string[] } {
  const records = load();
  let successCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];
  const now = Date.now();

  for (const [empId, dateStr, status, otHours] of entries) {
    const exists = records.some(
      (r) => r.employeeId === empId && r.date === dateStr,
    );
    if (exists) {
      skippedCount++;
      continue;
    }
    records.push({
      id: genId(),
      employeeId: empId,
      date: dateStr,
      status,
      otHours,
      advanceAmount: 0,
      source,
      punchIn: "",
      punchOut: "",
      lat: 0,
      lng: 0,
      isFlagged: false,
      flagReason: "",
      isRegularized: false,
      regularizationReason: "",
      changedBy: source,
      updatedAt: now,
      createdAt: now,
    });
    successCount++;
  }
  save(records);
  return {
    successCount: BigInt(successCount),
    skippedCount: BigInt(skippedCount),
    errors,
  };
}

export function bulkMarkAttendanceOverwrite(
  entries: [string, string, string, number][],
  source: string,
): { successCount: bigint; skippedCount: bigint; errors: string[] } {
  const records = load();
  let successCount = 0;
  const now = Date.now();

  for (const [empId, dateStr, status, otHours] of entries) {
    const idx = records.findIndex(
      (r) => r.employeeId === empId && r.date === dateStr,
    );
    if (idx >= 0) {
      records[idx] = {
        ...records[idx],
        status,
        otHours,
        changedBy: source,
        updatedAt: now,
      };
    } else {
      records.push({
        id: genId(),
        employeeId: empId,
        date: dateStr,
        status,
        otHours,
        advanceAmount: 0,
        source,
        punchIn: "",
        punchOut: "",
        lat: 0,
        lng: 0,
        isFlagged: false,
        flagReason: "",
        isRegularized: false,
        regularizationReason: "",
        changedBy: source,
        updatedAt: now,
        createdAt: now,
      });
    }
    successCount++;
  }
  save(records);
  return {
    successCount: BigInt(successCount),
    skippedCount: BigInt(0),
    errors: [],
  };
}

export function getAttendanceByMonth(
  month: string,
  year: string,
): AttendanceRecord[] {
  const prefix = `${year}${month.padStart(2, "0")}`;
  return load()
    .filter((r) => r.date.startsWith(prefix))
    .map(toRecord);
}

export function getAttendanceBySite(
  _siteId: string,
  month: string,
  year: string,
  empIdsBySite: string[],
): AttendanceRecord[] {
  const siteSet = new Set(empIdsBySite);
  const prefix = `${year}${month.padStart(2, "0")}`;
  return load()
    .filter((r) => r.date.startsWith(prefix) && siteSet.has(r.employeeId))
    .map(toRecord);
}

export function updateAttendanceOT(
  empId: string,
  dateStr: string,
  otHours: number,
  source: string,
): boolean {
  const records = load();
  const idx = records.findIndex(
    (r) => r.employeeId === empId && r.date === dateStr,
  );
  if (idx === -1) return false;
  records[idx].otHours = otHours;
  records[idx].changedBy = source;
  records[idx].updatedAt = Date.now();
  save(records);
  return true;
}

export function flagAttendance(id: string, reason: string): boolean {
  const records = load();
  const idx = records.findIndex((r) => r.id === id);
  if (idx === -1) return false;
  records[idx].isFlagged = true;
  records[idx].flagReason = reason;
  records[idx].updatedAt = Date.now();
  save(records);
  return true;
}

export function regularizeAttendance(
  id: string,
  newStatus: string,
  otHours: number,
  reason: string,
  changedBy: string,
): boolean {
  const records = load();
  const idx = records.findIndex((r) => r.id === id);
  if (idx === -1) return false;
  records[idx].status = newStatus;
  records[idx].otHours = otHours;
  records[idx].isRegularized = true;
  records[idx].regularizationReason = reason;
  records[idx].changedBy = changedBy;
  records[idx].updatedAt = Date.now();
  save(records);
  return true;
}

export function deleteAttendance(employeeId: string, date: string): boolean {
  const records = load();
  const before = records.length;
  const filtered = records.filter(
    (r) => !(r.employeeId === employeeId && r.date === date),
  );
  if (filtered.length === before) return false;
  save(filtered);
  return true;
}
