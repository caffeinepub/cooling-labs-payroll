import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  History,
  Info,
  Upload,
  X,
} from "lucide-react";
import React, { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { useAppContext } from "../../context/AppContext";
import {
  type ImportHistoryRecord,
  type ImportMode,
  addImportHistory,
  getImportHistory,
  getImportHistoryBySites,
  getImportSettings,
} from "../../services/attendanceImportStorage";
import {
  getExistingKeys,
  markAttendance,
  markAttendanceOverwrite,
} from "../../services/attendanceStorage";
import type { Employee, Site } from "../../types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ParsedRow {
  rowNum: number;
  rawDate: unknown;
  normalizedDate: string | null;
  siteCode: string;
  siteName: string;
  employeeId: string;
  employeeName: string;
  rawStatus: string;
  normalizedStatus: string | null;
  otHours: number;
  advance: number;
  remarks: string;
  validationStatus: "valid" | "warning" | "error";
  validationNotes: string[];
  importAction: "import" | "skip" | "overwrite" | "merge" | "error";
  isDuplicateInFile: boolean;
  existsInSystem: boolean;
  resolvedEmployee: Employee | null;
  resolvedSiteId: string | null;
}

const VALID_STATUSES = [
  "Present",
  "Absent",
  "Half Day",
  "Leave",
  "Weekly Off",
  "Holiday",
];

const STATUS_ALIASES: Record<string, string> = {
  present: "Present",
  p: "Present",
  absent: "Absent",
  a: "Absent",
  "half day": "Half Day",
  halfday: "Half Day",
  hd: "Half Day",
  half: "Half Day",
  leave: "Leave",
  l: "Leave",
  "weekly off": "Weekly Off",
  weeklyoff: "Weekly Off",
  wo: "Weekly Off",
  holiday: "Holiday",
  h: "Holiday",
};

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------
function normalizeDate(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;

  // Excel serial date (number)
  if (typeof raw === "number") {
    const excelEpoch = new Date(1899, 11, 30);
    const d = new Date(excelEpoch.getTime() + raw * 86400000);
    if (Number.isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}${m}${dd}`;
  }

  const s = String(raw).trim();
  if (!s) return null;

  // DD-MM-YYYY or DD/MM/YYYY
  const dmy4 = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (dmy4) {
    const [, d, m, y] = dmy4;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    if (Number.isNaN(date.getTime()) || date.getDate() !== Number(d))
      return null;
    return `${y}${m.padStart(2, "0")}${d.padStart(2, "0")}`;
  }

  // YYYY-MM-DD
  const ymd = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (ymd) {
    const [, y, m, d] = ymd;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    if (Number.isNaN(date.getTime()) || date.getDate() !== Number(d))
      return null;
    return `${y}${m.padStart(2, "0")}${d.padStart(2, "0")}`;
  }

  // DD-MM-YY (2-digit year -> 2000+)
  const dmy2 = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2})$/);
  if (dmy2) {
    const [, d, m, yy] = dmy2;
    const y = 2000 + Number(yy);
    const date = new Date(y, Number(m) - 1, Number(d));
    if (Number.isNaN(date.getTime()) || date.getDate() !== Number(d))
      return null;
    return `${y}${m.padStart(2, "0")}${d.padStart(2, "0")}`;
  }

  return null;
}

function normalizeStatus(raw: unknown): string | null {
  if (!raw) return null;
  const key = String(raw).trim().toLowerCase();
  return STATUS_ALIASES[key] ?? null;
}

function parseNumeric(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return 0;
  const n = Number(raw);
  if (Number.isNaN(n)) return null;
  return n;
}

function formatDate(yyyymmdd: string): string {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd;
  return `${yyyymmdd.slice(6, 8)}/${yyyymmdd.slice(4, 6)}/${yyyymmdd.slice(0, 4)}`;
}

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("en-IN");
}

function shortId(id: string): string {
  return id.slice(-8).toUpperCase();
}

// ---------------------------------------------------------------------------
// Header mapping
// ---------------------------------------------------------------------------
const HEADER_ALIASES: Record<string, string[]> = {
  date: ["date"],
  siteCode: ["site code", "sitecode", "site_code", "site id", "siteid"],
  siteName: ["site name", "sitename", "site_name"],
  employeeId: [
    "employee id",
    "employeeid",
    "emp id",
    "empid",
    "employee_id",
    "emp_id",
  ],
  employeeName: [
    "employee name",
    "employeename",
    "emp name",
    "empname",
    "name",
    "employee_name",
  ],
  status: ["status"],
  otHours: ["ot hours", "othours", "ot", "overtime", "ot hrs", "ot_hours"],
  advance: ["advance", "advance amount", "advance_amount"],
  remarks: ["remarks", "remark", "notes", "note"],
};

function mapHeaders(headerRow: (string | number)[]): Record<string, number> {
  const result: Record<string, number> = {};
  const normalized = headerRow.map((h) =>
    String(h ?? "")
      .trim()
      .toLowerCase(),
  );
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      const idx = normalized.indexOf(alias);
      if (idx !== -1) {
        result[field] = idx;
        break;
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function escapeCsv(val: unknown): string {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ---------------------------------------------------------------------------
// Template download — Excel
// ---------------------------------------------------------------------------
function downloadExcelTemplate() {
  const headers = [
    "Date",
    "Site Code",
    "Site Name",
    "Employee ID",
    "Employee Name",
    "Status",
    "OT Hours",
    "Advance",
    "Remarks",
  ];
  const sampleRows = [
    [
      "25-03-2026",
      "CL001",
      "Cooling Labs Gurgaon",
      "CLE001",
      "Siddhant Kumar",
      "Present",
      2,
      0,
      "-",
    ],
    [
      "25-03-2026",
      "CL001",
      "Cooling Labs Gurgaon",
      "CLE002",
      "Vikalp Kumar",
      "Leave",
      0,
      0,
      "Sick leave",
    ],
    [
      "25-03-2026",
      "CL001",
      "Cooling Labs Gurgaon",
      "CLE003",
      "Deepal Arora",
      "Present",
      1.5,
      500,
      "Advance paid",
    ],
  ];

  const data = [headers, ...sampleRows];
  const ws1 = XLSX.utils.aoa_to_sheet(data);

  // Column widths
  ws1["!cols"] = [
    { wch: 14 },
    { wch: 12 },
    { wch: 22 },
    { wch: 14 },
    { wch: 20 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 20 },
  ];

  // Freeze top row
  ws1["!sheetViews"] = [{ state: "frozen", ySplit: 1 }];

  // Bold header cells
  for (let c = 0; c < headers.length; c++) {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws1[cellAddr]) {
      ws1[cellAddr].s = { font: { bold: true } };
    }
  }

  // Instructions sheet
  const instructionRows = [
    ["ATTENDANCE IMPORT - INSTRUCTIONS"],
    [""],
    ["1. Do not change column headers"],
    ["2. One row = one employee for one date"],
    ["3. Use Employee ID exactly as shown in the system"],
    [
      "4. Allowed Status values: Present, Absent, Half Day, Leave, Weekly Off, Holiday",
    ],
    ["5. Also accepted: P, A, HD, Half, L, WO, H"],
    ["6. Leave OT Hours blank or 0 if not applicable"],
    ["7. Leave Advance blank or 0 if not applicable"],
    ["8. Save and upload as .xlsx (recommended) or .csv"],
    [""],
    ["SAMPLE ROWS:"],
    [
      "Date",
      "Site Code",
      "Site Name",
      "Employee ID",
      "Employee Name",
      "Status",
      "OT Hours",
      "Advance",
      "Remarks",
    ],
    [
      "25-03-2026",
      "CL001",
      "Cooling Labs Gurgaon",
      "CLE001",
      "Siddhant Kumar",
      "Present",
      "2",
      "0",
      "-",
    ],
    [
      "25-03-2026",
      "CL001",
      "Cooling Labs Gurgaon",
      "CLE002",
      "Vikalp Kumar",
      "Leave",
      "0",
      "0",
      "Sick leave",
    ],
    [
      "25-03-2026",
      "CL001",
      "Cooling Labs Gurgaon",
      "CLE003",
      "Deepal Arora",
      "Present",
      "1.5",
      "500",
      "Advance paid",
    ],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(instructionRows);
  ws2["!cols"] = [{ wch: 60 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, "Attendance Import");
  XLSX.utils.book_append_sheet(wb, ws2, "Instructions");
  XLSX.writeFile(wb, "HumanskeyAI_Attendance_Template.xlsx");
}

// ---------------------------------------------------------------------------
// Template download — CSV
// ---------------------------------------------------------------------------
function downloadCsvTemplate() {
  const headers = [
    "Date",
    "Site Code",
    "Site Name",
    "Employee ID",
    "Employee Name",
    "Status",
    "OT Hours",
    "Advance",
    "Remarks",
  ];
  const samples = [
    [
      "25-03-2026",
      "CL001",
      "Cooling Labs Gurgaon",
      "CLE001",
      "Siddhant Kumar",
      "Present",
      "2",
      "0",
      "-",
    ],
    [
      "25-03-2026",
      "CL001",
      "Cooling Labs Gurgaon",
      "CLE002",
      "Vikalp Kumar",
      "Leave",
      "0",
      "0",
      "Sick leave",
    ],
    [
      "25-03-2026",
      "CL001",
      "Cooling Labs Gurgaon",
      "CLE003",
      "Deepal Arora",
      "Present",
      "1.5",
      "500",
      "Advance paid",
    ],
  ];
  const rows = [headers, ...samples]
    .map((r) => r.map(escapeCsv).join(","))
    .join("\r\n");
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + rows], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "HumanskeyAI_Attendance_Template.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Error report download
// ---------------------------------------------------------------------------
function downloadErrorReport(rows: ParsedRow[]) {
  const headers = [
    "Row No.",
    "Date",
    "Employee ID",
    "Employee Name",
    "Status",
    "OT Hours",
    "Advance",
    "Validation Result",
    "Reason",
  ];
  const dataRows = rows.map((r) => [
    r.rowNum,
    r.normalizedDate ? formatDate(r.normalizedDate) : String(r.rawDate ?? ""),
    r.employeeId,
    r.resolvedEmployee?.name ?? r.employeeName,
    r.normalizedStatus ?? r.rawStatus,
    r.otHours,
    r.advance,
    r.validationStatus,
    r.validationNotes.join("; "),
  ]);
  const csvRows = [headers, ...dataRows]
    .map((r) => r.map(escapeCsv).join(","))
    .join("\r\n");
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvRows], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "AttendanceImport_ErrorReport.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export function AttendanceImport() {
  const { employees, sites, isAdmin } = useAppContext();
  const { adminName } = useAdminAuth();

  const supervisorSession = React.useMemo(() => {
    try {
      const raw = localStorage.getItem("clf_supervisor_session");
      if (raw)
        return JSON.parse(raw) as {
          sites?: string[];
          siteIds?: string[];
          siteId?: string;
          name?: string;
          role?: string;
        };
    } catch {
      /* ignore */
    }
    try {
      const raw = localStorage.getItem("clf_session");
      if (raw) {
        const s = JSON.parse(raw);
        if (s.role === "supervisor") return s;
      }
    } catch {
      /* ignore */
    }
    return null;
  }, []);

  const supervisorSiteIds: string[] = React.useMemo(() => {
    if (!supervisorSession) return [];
    if (supervisorSession.sites?.length) return supervisorSession.sites;
    if (supervisorSession.siteIds?.length) return supervisorSession.siteIds;
    if (supervisorSession.siteId) return [supervisorSession.siteId];
    return [];
  }, [supervisorSession]);

  const isSupervisor = !isAdmin && supervisorSession !== null;
  const importSettings = React.useMemo(() => getImportSettings(), []);
  const canUpload =
    isAdmin || (isSupervisor && importSettings.supervisorCanUpload);

  const [selectedMode, setSelectedMode] = useState<ImportMode>(
    importSettings.defaultMode,
  );
  const [parsedRows, setParsedRows] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileExt, setFileExt] = useState("csv");
  const [skipErrors, setSkipErrors] = useState(false);
  const [importing, setImporting] = useState(false);
  const [history, setHistory] = useState<ImportHistoryRecord[]>(() => {
    if (isAdmin) return getImportHistory();
    if (isSupervisor && supervisorSiteIds.length > 0)
      return getImportHistoryBySites(supervisorSiteIds);
    return getImportHistory();
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // File parsing
  // ---------------------------------------------------------------------------
  const parseFile = useCallback(
    async (file: File) => {
      setFileName(file.name);
      setParsedRows(null);
      setSkipErrors(false);

      const ext = (file.name.split(".").pop() ?? "csv").toLowerCase();
      setFileExt(ext);

      let rawRows: (string | number)[][];

      try {
        if (ext === "xlsx" || ext === "xls") {
          const buf = await file.arrayBuffer();
          const wb = XLSX.read(buf, { type: "array", cellDates: false });
          const wsName = wb.SheetNames[0];
          const ws = wb.Sheets[wsName];
          rawRows = XLSX.utils.sheet_to_json(ws, {
            header: 1,
            defval: "",
          }) as (string | number)[][];
        } else {
          // CSV — handle BOM and various line endings
          const text = await file.text();
          const cleaned = text.replace(/^\uFEFF/, "");
          rawRows = cleaned
            .split(/\r?\n/)
            .filter((l) => l.trim())
            .map(parseCsvLine);
        }
      } catch {
        toast.error(
          "Could not read file. Please upload a valid .xlsx or .csv file.",
        );
        return;
      }

      if (rawRows.length < 2) {
        toast.error("File appears to be empty or has only headers.");
        return;
      }

      const colMap = mapHeaders(rawRows[0]);

      const missing: string[] = [];
      if (colMap.date === undefined) missing.push("Date");
      if (colMap.employeeId === undefined) missing.push("Employee ID");
      if (colMap.status === undefined) missing.push("Status");

      if (missing.length > 0) {
        toast.error(
          `Missing required columns: ${missing.join(", ")}. Please use the correct template.`,
        );
        return;
      }

      const empById = new Map<string, Employee>();
      for (const e of employees)
        empById.set(e.employeeId.trim().toLowerCase(), e);

      const siteById = new Map<string, Site>();
      for (const s of sites) siteById.set(s.id, s);
      const siteByName = new Map<string, Site>();
      for (const s of sites) siteByName.set(s.name.trim().toLowerCase(), s);

      // Normalize a site code value for comparison
      const normalizeSiteCode = (val: unknown): string =>
        String(val ?? "")
          .replace(/\u00A0/g, " ")
          .replace(/[\r\n]/g, "")
          .trim()
          .toUpperCase();

      const findSite = (code: string): Site | null => {
        if (!code) return null;
        const norm = normalizeSiteCode(code);
        console.debug(
          "[AttendanceImport] findSite → raw:",
          JSON.stringify(code),
          "normalized:",
          norm,
        );
        // Match against siteCode field (primary), then name (fallback)
        for (const s of sites) {
          const masterCode = normalizeSiteCode(s.siteCode);
          console.debug(
            "[AttendanceImport] comparing with master siteCode:",
            JSON.stringify(s.siteCode),
            "→",
            masterCode,
          );
          if (masterCode && masterCode === norm) return s;
        }
        // Fallback: match by name
        const lower = norm.toLowerCase();
        for (const s of sites)
          if (
            s.name.toLowerCase().includes(lower) ||
            lower.includes(s.name.toLowerCase())
          )
            return s;
        return null;
      };

      const dataRows = rawRows.slice(1).filter((r) => r.some((c) => c !== ""));

      // Duplicate detection pass within file
      const fileDupTracker = new Map<string, number[]>();
      for (let i = 0; i < dataRows.length; i++) {
        const r = dataRows[i];
        const empId = String(r[colMap.employeeId] ?? "").trim();
        const nd = normalizeDate(r[colMap.date]);
        if (empId && nd) {
          const key = `${empId.toLowerCase()}_${nd}`;
          if (!fileDupTracker.has(key)) fileDupTracker.set(key, []);
          fileDupTracker.get(key)!.push(i);
        }
      }

      // Pre-collect system dup keys
      const allKeys: string[] = [];
      for (const r of dataRows) {
        const empId = String(r[colMap.employeeId] ?? "").trim();
        const nd = normalizeDate(r[colMap.date]);
        const resolvedEmp = empById.get(empId.toLowerCase());
        if (resolvedEmp && nd) allKeys.push(`${resolvedEmp.employeeId}_${nd}`);
      }
      const existingSet = getExistingKeys(allKeys);

      const rows: ParsedRow[] = [];

      for (let i = 0; i < dataRows.length; i++) {
        const r = dataRows[i];

        const rawDateCell = r[colMap.date];
        const rawSiteCodeVal =
          colMap.siteCode !== undefined ? r[colMap.siteCode] : "";
        const siteCode =
          colMap.siteCode !== undefined
            ? String(rawSiteCodeVal ?? "")
                .replace(/\u00A0/g, " ")
                .replace(/[\r\n]/g, "")
                .trim()
                .toUpperCase()
            : "";
        console.debug(
          "[AttendanceImport] Row",
          i + 1,
          "raw siteCode:",
          JSON.stringify(rawSiteCodeVal),
          "normalized:",
          siteCode,
        );
        const siteName =
          colMap.siteName !== undefined
            ? String(r[colMap.siteName] ?? "").trim()
            : "";
        const employeeId = String(r[colMap.employeeId] ?? "").trim();
        const employeeName =
          colMap.employeeName !== undefined
            ? String(r[colMap.employeeName] ?? "").trim()
            : "";
        const rawStatusVal = String(r[colMap.status] ?? "").trim();
        const rawOTCell =
          colMap.otHours !== undefined ? r[colMap.otHours] : undefined;
        const rawAdvCell =
          colMap.advance !== undefined ? r[colMap.advance] : undefined;
        const remarks =
          colMap.remarks !== undefined
            ? String(r[colMap.remarks] ?? "").trim()
            : "";

        const nd = normalizeDate(rawDateCell);
        const normStatus = normalizeStatus(rawStatusVal);
        const otResult = parseNumeric(rawOTCell !== undefined ? rawOTCell : "");
        const advResult = parseNumeric(
          rawAdvCell !== undefined ? rawAdvCell : "",
        );
        const otHours = otResult ?? -1;
        const advance = advResult ?? -1;

        const notes: string[] = [];
        let vStatus: "valid" | "warning" | "error" = "valid";

        const rawDateStr = String(rawDateCell ?? "").trim();
        if (!rawDateStr && rawDateCell === "") {
          notes.push("Missing Date");
          vStatus = "error";
        } else if (!nd) {
          notes.push(`Invalid date format: "${rawDateStr || rawDateCell}"`);
          vStatus = "error";
        }

        if (!employeeId) {
          notes.push("Missing Employee ID");
          vStatus = "error";
        }

        const resolvedEmp = employeeId
          ? (empById.get(employeeId.toLowerCase()) ?? null)
          : null;
        if (employeeId && !resolvedEmp) {
          notes.push(`Employee ID "${employeeId}" not found in master`);
          vStatus = "error";
        }

        if (
          resolvedEmp &&
          employeeName &&
          resolvedEmp.name.toLowerCase() !== employeeName.toLowerCase()
        ) {
          const mismatchAction =
            importSettings.nameMismatchRule === "block" ? "error" : "warning";
          notes.push(
            `Name mismatch: file has "${employeeName}", master has "${resolvedEmp.name}"`,
          );
          if (mismatchAction === "error") vStatus = "error";
          else if (vStatus === "valid") vStatus = "warning";
        }

        const resolvedSite = findSite(siteCode);
        const resolvedSiteId: string | null = resolvedSite?.id ?? null;

        if (siteCode && !resolvedSite) {
          notes.push(`Site code "${siteCode}" not found in Site Master`);
          console.debug(
            "[AttendanceImport] No site match found for:",
            siteCode,
            "| Available site codes:",
            sites.map((s) => s.siteCode),
          );
          if (importSettings.siteMismatchRule === "error") vStatus = "error";
          else if (vStatus === "valid") vStatus = "warning";
        } else {
          if (resolvedSite)
            console.debug(
              "[AttendanceImport] Site matched:",
              resolvedSite.siteCode,
              resolvedSite.name,
            );
        }
        if (siteCode && resolvedSite && resolvedEmp) {
          // Employee.site stores site NAME (not ID). Resolve employee's site by name.
          const empSiteName = resolvedEmp.site?.trim() ?? "";
          const fileSiteName = resolvedSite.name?.trim() ?? "";
          // Also resolve employee site via siteByName for canonical comparison
          const empSiteResolved = siteByName.get(empSiteName.toLowerCase());
          const empSiteCanonical = empSiteResolved
            ? empSiteResolved.id
            : empSiteName.toLowerCase();
          const fileSiteCanonical = resolvedSite.id;

          // Only warn if employee's site name differs from file's site name (case-insensitive)
          if (
            empSiteName &&
            fileSiteName &&
            empSiteName.toLowerCase() !== fileSiteName.toLowerCase() &&
            empSiteCanonical !== fileSiteCanonical
          ) {
            notes.push(
              `Site mismatch: employee assigned to "${empSiteName}", file says "${fileSiteName}"`,
            );
            if (importSettings.siteMismatchRule === "error") vStatus = "error";
            else if (vStatus === "valid") vStatus = "warning";
          }
        }

        if (!rawStatusVal) {
          notes.push("Missing Status");
          vStatus = "error";
        } else if (!normStatus) {
          notes.push(
            `Invalid status: "${rawStatusVal}". Use: ${VALID_STATUSES.join(", ")} (or aliases P, A, HD, L, WO, H)`,
          );
          vStatus = "error";
        }

        if (otHours < 0) {
          notes.push("OT Hours must be numeric");
          vStatus = "error";
        }
        if (advance < 0) {
          notes.push("Advance must be numeric");
          vStatus = "error";
        }

        const fileKey =
          employeeId && nd ? `${employeeId.toLowerCase()}_${nd}` : "";
        const isDuplicateInFile = fileKey
          ? (fileDupTracker.get(fileKey)?.length ?? 0) > 1
          : false;
        if (isDuplicateInFile) {
          notes.push(
            "Duplicate in uploaded file (same employee + date appears multiple times)",
          );
          if (vStatus === "valid") vStatus = "warning";
        }

        const systemKey =
          resolvedEmp && nd ? `${resolvedEmp.employeeId}_${nd}` : "";
        const existsInSystem = systemKey ? existingSet.has(systemKey) : false;
        if (existsInSystem) {
          notes.push(
            `Record already exists in system for ${formatDate(nd ?? "")}`,
          );
          if (vStatus === "valid") vStatus = "warning";
        }

        let importAction: ParsedRow["importAction"] = "import";
        if (vStatus === "error") {
          importAction = "error";
        } else if (existsInSystem) {
          if (selectedMode === "skip") importAction = "skip";
          else if (selectedMode === "overwrite") importAction = "overwrite";
          else importAction = "merge";
        }

        rows.push({
          rowNum: i + 2,
          rawDate: rawDateCell,
          normalizedDate: nd,
          siteCode,
          siteName,
          employeeId,
          employeeName,
          rawStatus: rawStatusVal,
          normalizedStatus: normStatus,
          otHours: otHours >= 0 ? otHours : 0,
          advance: advance >= 0 ? advance : 0,
          remarks,
          validationStatus: vStatus,
          validationNotes: notes,
          importAction,
          isDuplicateInFile,
          existsInSystem,
          resolvedEmployee: resolvedEmp,
          resolvedSiteId,
        });
      }

      setParsedRows(rows);
    },
    [employees, sites, importSettings, selectedMode],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) parseFile(file);
      e.target.value = "";
    },
    [parseFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) parseFile(file);
    },
    [parseFile],
  );

  const recomputedRows = React.useMemo(() => {
    if (!parsedRows) return null;
    return parsedRows.map((row) => {
      if (row.validationStatus === "error")
        return { ...row, importAction: "error" as const };
      if (row.existsInSystem) {
        const action =
          selectedMode === "skip"
            ? "skip"
            : selectedMode === "overwrite"
              ? "overwrite"
              : "merge";
        return { ...row, importAction: action as ParsedRow["importAction"] };
      }
      return { ...row, importAction: "import" as const };
    });
  }, [parsedRows, selectedMode]);

  const summary = React.useMemo(() => {
    if (!recomputedRows) return null;
    return {
      total: recomputedRows.length,
      valid: recomputedRows.filter((r) => r.validationStatus === "valid")
        .length,
      warnings: recomputedRows.filter((r) => r.validationStatus === "warning")
        .length,
      errors: recomputedRows.filter((r) => r.validationStatus === "error")
        .length,
      dupeInFile: recomputedRows.filter((r) => r.isDuplicateInFile).length,
      dupeInSystem: recomputedRows.filter((r) => r.existsInSystem).length,
    };
  }, [recomputedRows]);

  const hasErrors = (summary?.errors ?? 0) > 0;
  const canImport = recomputedRows !== null && (!hasErrors || skipErrors);
  const importableRows =
    recomputedRows?.filter(
      (r) => r.importAction !== "error" && r.importAction !== "skip",
    ) ?? [];

  const errorOrWarnRows =
    recomputedRows?.filter(
      (r) => r.validationStatus === "error" || r.validationStatus === "warning",
    ) ?? [];

  // ---------------------------------------------------------------------------
  // Import execution
  // ---------------------------------------------------------------------------
  const handleImport = useCallback(async () => {
    if (!recomputedRows || !canImport) return;
    setImporting(true);

    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const involvedSiteIds = new Set<string>();
    let advanceCount = 0;

    for (const row of recomputedRows) {
      if (row.importAction === "error") {
        failed++;
        continue;
      }
      if (row.importAction === "skip") {
        skipped++;
        continue;
      }

      const emp = row.resolvedEmployee;
      if (!emp || !row.normalizedDate || !row.normalizedStatus) {
        failed++;
        continue;
      }

      if (emp.site) {
        const empSite = sites.find(
          (s) => s.name.trim().toLowerCase() === emp.site!.trim().toLowerCase(),
        );
        if (empSite) involvedSiteIds.add(empSite.id);
      }
      if (row.resolvedSiteId) involvedSiteIds.add(row.resolvedSiteId);

      const source = row.advance > 0 ? `import|adv:${row.advance}` : "import";

      if (row.importAction === "import") {
        const ok = markAttendance(
          emp.id,
          row.normalizedDate,
          row.normalizedStatus,
          row.otHours,
          "",
          "",
          0,
          0,
          source,
        );
        if (ok) imported++;
        else skipped++;
      } else if (row.importAction === "overwrite") {
        markAttendanceOverwrite(
          emp.id,
          row.normalizedDate,
          row.normalizedStatus,
          row.otHours,
          "",
          "",
          0,
          0,
          source,
        );
        imported++;
      } else if (row.importAction === "merge") {
        const existingKey = `${emp.id}_${row.normalizedDate}`;
        const existingMergeSet = getExistingKeys([existingKey]);
        if (!existingMergeSet.has(existingKey)) {
          markAttendance(
            emp.id,
            row.normalizedDate,
            row.normalizedStatus,
            row.otHours,
            "",
            "",
            0,
            0,
            source,
          );
        } else {
          markAttendanceOverwrite(
            emp.id,
            row.normalizedDate,
            row.normalizedStatus,
            row.otHours,
            "",
            "",
            0,
            0,
            source,
          );
        }
        imported++;
      }

      if (row.advance > 0) advanceCount++;
    }

    const uploadedBy = isAdmin
      ? adminName
      : ((supervisorSession as { name?: string } | null)?.name ?? "Supervisor");
    const histRecord: ImportHistoryRecord = {
      importId: `imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      fileName,
      fileType: fileExt,
      uploadedBy,
      uploadedAt: Date.now(),
      importMode: selectedMode,
      totalRows: recomputedRows.length,
      importedRows: imported,
      skippedRows: skipped,
      failedRows: failed,
      status:
        failed === recomputedRows.length
          ? "failed"
          : failed > 0 || skipped > 0
            ? "partial"
            : "completed",
      siteIds: Array.from(involvedSiteIds),
    };
    addImportHistory(histRecord);
    setHistory(
      isAdmin ? getImportHistory() : getImportHistoryBySites(supervisorSiteIds),
    );

    toast.success(
      `Import complete: ${imported} imported, ${skipped} skipped, ${failed} failed.`,
    );
    if (advanceCount > 0) {
      toast.info(
        `${advanceCount} rows with Advance > 0 logged. Apply advance deductions manually in the Payroll module.`,
      );
    }

    setParsedRows(null);
    setFileName("");
    setSkipErrors(false);
    setImporting(false);
  }, [
    recomputedRows,
    canImport,
    fileName,
    fileExt,
    selectedMode,
    isAdmin,
    adminName,
    supervisorSession,
    supervisorSiteIds,
    sites,
  ]);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  const actionLabel = (action: ParsedRow["importAction"]) => {
    switch (action) {
      case "import":
        return <span className="text-green-600 font-medium">Import</span>;
      case "skip":
        return <span className="text-gray-500">Skip</span>;
      case "overwrite":
        return <span className="text-orange-600 font-medium">Overwrite</span>;
      case "merge":
        return <span className="text-blue-600 font-medium">Merge</span>;
      case "error":
        return <span className="text-red-600 font-medium">Blocked</span>;
    }
  };

  const statusBadge = (
    status: ParsedRow["validationStatus"],
    notes: string[],
  ) => {
    const label =
      status === "valid" ? "Valid" : status === "warning" ? "Warning" : "Error";
    const cls =
      status === "valid"
        ? "bg-green-100 text-green-700"
        : status === "warning"
          ? "bg-yellow-100 text-yellow-700"
          : "bg-red-100 text-red-700";
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${cls}`}
        title={notes.join("\n")}
      >
        {status === "valid" ? (
          <CheckCircle2 className="w-3 h-3" />
        ) : status === "warning" ? (
          <AlertTriangle className="w-3 h-3" />
        ) : (
          <AlertCircle className="w-3 h-3" />
        )}
        {label}
      </span>
    );
  };

  const rowBg = (status: ParsedRow["validationStatus"]) => {
    if (status === "error") return "bg-red-50";
    if (status === "warning") return "bg-yellow-50";
    return "";
  };

  const fileTypeBadge = (ft: string) => {
    const isXlsx = ft === "xlsx" || ft === "xls";
    return (
      <span
        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
          isXlsx ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
        }`}
      >
        {ft.toUpperCase()}
      </span>
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6" data-ocid="attendance_import.page">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <Upload className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Attendance Import
            </h2>
            <p className="text-sm text-gray-500">
              Import attendance from Excel (.xlsx) or CSV — Excel recommended
              for best compatibility
            </p>
          </div>
        </div>

        {/* Template download buttons */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={downloadExcelTemplate}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-ocid="attendance_import.primary_button"
            >
              <FileSpreadsheet className="w-4 h-4 mr-1.5" />
              Download Excel Template (.xlsx)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadCsvTemplate}
              data-ocid="attendance_import.secondary_button"
            >
              <Download className="w-4 h-4 mr-1.5" />
              Download CSV Template
            </Button>
          </div>
          <p className="text-[11px] text-gray-400">
            Use Excel (.xlsx) for best compatibility with Microsoft Office
          </p>
        </div>
      </div>

      {/* Upload Section */}
      {canUpload ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">
            Upload Attendance File
          </h3>
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: file upload dropzone */}
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            data-ocid="attendance_import.dropzone"
          >
            <Upload className="w-8 h-8 mx-auto mb-3 text-gray-400" />
            <p className="text-sm font-medium text-gray-700">
              Click or drag & drop to upload
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Drag & drop or click — accepts .xlsx (recommended) and .csv
            </p>
            {fileName && (
              <p className="mt-2 text-xs text-blue-600 font-medium">
                📄 {fileName}
              </p>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFileChange}
            data-ocid="attendance_import.upload_button"
          />

          {recomputedRows && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-700">Import Mode</p>
              <div className="flex flex-wrap gap-4">
                {(
                  [
                    {
                      value: "smartMerge",
                      label: "Smart Merge",
                      desc: "Create new, update OT/Advance/Remarks on existing",
                    },
                    {
                      value: "skip",
                      label: "Skip Existing",
                      desc: "Do not change already imported records",
                    },
                    {
                      value: "overwrite",
                      label: "Overwrite",
                      desc: "Replace existing records with uploaded values",
                    },
                  ] as { value: ImportMode; label: string; desc: string }[]
                ).map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-start gap-2 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="importMode"
                      value={opt.value}
                      checked={selectedMode === opt.value}
                      onChange={() => setSelectedMode(opt.value)}
                      className="mt-0.5"
                      data-ocid="attendance_import.radio"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-800">
                        {opt.label}
                      </span>
                      <p className="text-xs text-gray-500">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 flex items-start gap-3">
          <Info className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-yellow-800">
              Upload Restricted
            </p>
            <p className="text-xs text-yellow-700 mt-1">
              Attendance file upload is currently restricted to Admin/HR users.
              Contact your administrator to enable supervisor uploads.
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[
            {
              label: "Total Rows",
              value: summary.total,
              cls: "bg-gray-50 border-gray-200 text-gray-700",
            },
            {
              label: "Valid",
              value: summary.valid,
              cls: "bg-green-50 border-green-200 text-green-700",
            },
            {
              label: "Warnings",
              value: summary.warnings,
              cls: "bg-yellow-50 border-yellow-200 text-yellow-700",
            },
            {
              label: "Errors",
              value: summary.errors,
              cls: "bg-red-50 border-red-200 text-red-700",
            },
            {
              label: "Dup in File",
              value: summary.dupeInFile,
              cls: "bg-orange-50 border-orange-200 text-orange-700",
            },
            {
              label: "Exist in System",
              value: summary.dupeInSystem,
              cls: "bg-blue-50 border-blue-200 text-blue-700",
            },
          ].map((c) => (
            <div
              key={c.label}
              className={`rounded-lg border p-3 text-center ${c.cls}`}
            >
              <p className="text-xl font-bold">{c.value}</p>
              <p className="text-xs mt-0.5 font-medium opacity-80">{c.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Preview Table */}
      {recomputedRows && recomputedRows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">
              Parsed Preview ({recomputedRows.length} rows)
            </h3>
            <div className="flex gap-2 flex-wrap justify-end">
              {errorOrWarnRows.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadErrorReport(errorOrWarnRows)}
                  data-ocid="attendance_import.secondary_button"
                >
                  <Download className="w-3.5 h-3.5 mr-1" /> Download Error
                  Report
                </Button>
              )}
              {hasErrors && !skipErrors && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSkipErrors(true)}
                  data-ocid="attendance_import.secondary_button"
                >
                  <X className="w-3.5 h-3.5 mr-1" /> Skip Error Rows
                </Button>
              )}
              {canImport && (
                <Button
                  size="sm"
                  onClick={handleImport}
                  disabled={importing || importableRows.length === 0}
                  data-ocid="attendance_import.primary_button"
                >
                  {importing ? (
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 animate-spin" />{" "}
                      Importing...
                    </span>
                  ) : (
                    <span>Import {importableRows.length} Records</span>
                  )}
                </Button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {[
                    "Row",
                    "Date",
                    "Site",
                    "Emp ID",
                    "Emp Name",
                    "Status",
                    "OT Hrs",
                    "Advance",
                    "Remarks",
                    "Result",
                    "Reason",
                    "Action",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recomputedRows.map((row) => (
                  <tr
                    key={row.rowNum}
                    className={`border-b border-gray-100 ${rowBg(row.validationStatus)}`}
                    data-ocid="attendance_import.row"
                  >
                    <td className="px-3 py-2 text-gray-500">{row.rowNum}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {row.normalizedDate ? (
                        formatDate(row.normalizedDate)
                      ) : (
                        <span className="text-red-500">
                          {String(row.rawDate ?? "") || "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                      {row.siteCode || "—"}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {row.employeeId || "—"}
                    </td>
                    <td className="px-3 py-2">
                      {row.resolvedEmployee?.name ?? (row.employeeName || "—")}
                    </td>
                    <td className="px-3 py-2">
                      {row.normalizedStatus ?? (
                        <span className="text-red-500">
                          {row.rawStatus || "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">{row.otHours}</td>
                    <td className="px-3 py-2 text-right">
                      {row.advance > 0 ? `₹${row.advance}` : "—"}
                    </td>
                    <td
                      className="px-3 py-2 max-w-[120px] truncate text-gray-500"
                      title={row.remarks}
                    >
                      {row.remarks || "—"}
                    </td>
                    <td className="px-3 py-2">
                      {statusBadge(row.validationStatus, row.validationNotes)}
                    </td>
                    <td className="px-3 py-2 max-w-[180px]">
                      {row.validationNotes.length > 0 ? (
                        <div className="space-y-0.5">
                          {row.validationNotes.map((n) => (
                            <p
                              key={n}
                              className="text-[10px] text-gray-500 leading-tight"
                            >
                              {n}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {actionLabel(row.importAction)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Import History */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <History className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">
            Import History
          </h3>
          {isSupervisor && (
            <Badge variant="secondary" className="text-xs">
              Your Sites Only
            </Badge>
          )}
        </div>
        {history.length === 0 ? (
          <div
            className="py-12 text-center"
            data-ocid="attendance_import.empty_state"
          >
            <History className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-400">No import history yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {[
                    "Import ID",
                    "File Name",
                    "File Type",
                    "Uploaded By",
                    "Date/Time",
                    "Mode",
                    "Total",
                    "Imported",
                    "Skipped",
                    "Failed",
                    "Status",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((rec, idx) => (
                  <tr
                    key={rec.importId}
                    className="border-b border-gray-100 hover:bg-gray-50"
                    data-ocid={`attendance_import.item.${idx + 1}`}
                  >
                    <td className="px-3 py-2 font-mono text-gray-500">
                      {shortId(rec.importId)}
                    </td>
                    <td
                      className="px-3 py-2 max-w-[160px] truncate"
                      title={rec.fileName}
                    >
                      {rec.fileName}
                    </td>
                    <td className="px-3 py-2">
                      {fileTypeBadge(rec.fileType ?? "csv")}
                    </td>
                    <td className="px-3 py-2">{rec.uploadedBy}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatDateTime(rec.uploadedAt)}
                    </td>
                    <td className="px-3 py-2">
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                        {rec.importMode === "smartMerge"
                          ? "Smart Merge"
                          : rec.importMode === "skip"
                            ? "Skip"
                            : "Overwrite"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">{rec.totalRows}</td>
                    <td className="px-3 py-2 text-center text-green-600 font-medium">
                      {rec.importedRows}
                    </td>
                    <td className="px-3 py-2 text-center text-gray-500">
                      {rec.skippedRows}
                    </td>
                    <td className="px-3 py-2 text-center text-red-600">
                      {rec.failedRows}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          rec.status === "completed"
                            ? "bg-green-100 text-green-700"
                            : rec.status === "partial"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {rec.status.charAt(0).toUpperCase() +
                          rec.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
