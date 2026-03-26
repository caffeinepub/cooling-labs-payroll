/**
 * attendanceImportStorage.ts — tenant-aware attendance import settings and history.
 */
import { getActiveCompanyId, getTenantKey } from "./tenantStorage";

function getKeys() {
  const cid = getActiveCompanyId();
  return {
    settings: getTenantKey(cid, "clf_import_settings"),
    history: getTenantKey(cid, "clf_import_history"),
  };
}

export type ImportMode = "smartMerge" | "skip" | "overwrite";
export type SiteMismatchRule = "warning" | "error";
export type NameMismatchRule = "warn" | "block";

export interface ImportSettings {
  defaultMode: ImportMode;
  supervisorCanUpload: boolean;
  siteMismatchRule: SiteMismatchRule;
  nameMismatchRule: NameMismatchRule;
}

export interface ImportHistoryRecord {
  importId: string;
  fileName: string;
  fileType: string;
  uploadedBy: string;
  uploadedAt: number;
  importMode: ImportMode;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  failedRows: number;
  status: "completed" | "partial" | "failed";
  siteIds: string[];
}

const DEFAULT_SETTINGS: ImportSettings = {
  defaultMode: "smartMerge",
  supervisorCanUpload: false,
  siteMismatchRule: "warning",
  nameMismatchRule: "warn",
};

export function getImportSettings(): ImportSettings {
  try {
    const raw = localStorage.getItem(getKeys().settings);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveImportSettings(s: Partial<ImportSettings>): void {
  const current = getImportSettings();
  localStorage.setItem(
    getKeys().settings,
    JSON.stringify({ ...current, ...s }),
  );
}

export function getImportHistory(): ImportHistoryRecord[] {
  try {
    const raw = localStorage.getItem(getKeys().history);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function addImportHistory(record: ImportHistoryRecord): void {
  const history = getImportHistory();
  history.unshift(record);
  if (history.length > 200) history.splice(200);
  localStorage.setItem(getKeys().history, JSON.stringify(history));
}

export function getImportHistoryBySites(
  siteIds: string[],
): ImportHistoryRecord[] {
  const siteSet = new Set(siteIds);
  return getImportHistory().filter((r) =>
    r.siteIds.some((s) => siteSet.has(s)),
  );
}
