# Cooling Labs Payroll — Attendance Import Rebuild

## Current State
The existing `AttendanceImport.tsx` only handles `.csv` files using `file.text()`. It has:
- No `.xlsx` support
- No Excel serial date parsing
- No status aliases (P, A, HD, L, WO, H)
- Only partial header matching
- No Excel template download (only CSV)
- No downloadable error report
- No file type field in import history
- The UI says "CSV only"

## Requested Changes (Diff)

### Add
- SheetJS (`xlsx`) is now installed — use it for both reading `.xlsx` uploads and generating `.xlsx` templates
- Excel template download (`HumanskeyAI_Attendance_Template.xlsx`) with 2 sheets: "Attendance Import" (bold frozen header, sample rows) and "Instructions"
- CSV template download (same data, UTF-8 BOM)
- Full fuzzy header mapping: tolerant of spacing, casing, aliases
- Date parsing for DD-MM-YY (2-digit year → 2000+)
- Excel serial date parsing (numeric cell from xlsx)
- Status aliases: P→Present, A→Absent, HD/Half→Half Day, L→Leave, WO→Weekly Off, H→Holiday
- OT and Advance: blank or empty string → 0; reject non-numeric with clear error
- Summary card for "Duplicate Rows in file" (separate from "Exists in System")
- Download Error Report button (CSV export of error/warning rows)
- fileType field in ImportHistoryRecord
- UI recommendation: "Use Excel (.xlsx) for best compatibility"
- Upload accept `.xlsx,.csv`
- Advance values from import stored with a tagged source so payroll can pick them up

### Modify
- `parseFile`: branch on file extension → XLSX parser vs CSV parser
- `normalizeDate`: add DD-MM-YY and Excel serial number cases
- `normalizeStatus`: expand with alias map
- Header column detection: expand alias lists for all 9 canonical fields
- ImportHistoryRecord: add `fileType: string` field
- Summary cards: add separate "Dup in File" card
- UI header description: update from "CSV files" to "Excel or CSV files"
- File accept attribute: `.xlsx,.csv`

### Remove
- Nothing removed — purely additive improvements

## Implementation Plan
1. Update `attendanceImportStorage.ts` — add `fileType` to `ImportHistoryRecord`
2. Rewrite `AttendanceImport.tsx`:
   a. Add xlsx import and all parsing logic
   b. Add `downloadExcelTemplate()` using SheetJS
   c. Add `downloadCsvTemplate()`
   d. Expand `normalizeDate()`, `normalizeStatus()`, header matchers
   e. Add Excel file reader (XLSX.read → sheet_to_json)
   f. Add error report download
   g. Update UI: recommend xlsx, two template buttons, accept both file types
