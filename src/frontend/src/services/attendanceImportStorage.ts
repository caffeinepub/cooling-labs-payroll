/**
 * attendanceImportStorage.ts
 * Manages import history and settings for the Attendance Import module.
 */

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
  fileType: string; // "xlsx" or "csv"
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

const SETTINGS_KEY = "clf_import_settings";
const HISTORY_KEY = "clf_import_history";

const DEFAULT_SETTINGS: ImportSettings = {
  defaultMode: "smartMerge",
  supervisorCanUpload: false,
  siteMismatchRule: "warning",
  nameMismatchRule: "warn",
};

export function getImportSettings(): ImportSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveImportSettings(s: Partial<ImportSettings>): void {
  const current = getImportSettings();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...s }));
}

export function getImportHistory(): ImportHistoryRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function addImportHistory(record: ImportHistoryRecord): void {
  const history = getImportHistory();
  history.unshift(record);
  // Keep latest 200 records
  if (history.length > 200) history.splice(200);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function getImportHistoryBySites(
  siteIds: string[],
): ImportHistoryRecord[] {
  const siteSet = new Set(siteIds);
  return getImportHistory().filter((r) =>
    r.siteIds.some((s) => siteSet.has(s)),
  );
}
