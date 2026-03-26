/**
 * CSV-based export that opens properly in Microsoft Excel.
 * Uses UTF-8 BOM so Excel correctly handles special characters and ₹ symbols.
 */
function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (
    s.includes(",") ||
    s.includes('"') ||
    s.includes("\n") ||
    s.includes("\r")
  ) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportXlsx(
  data: object[],
  filename: string,
  _sheetName = "Sheet1",
): void {
  if (data.length === 0) {
    alert("No data to export.");
    return;
  }

  const headers = Object.keys(data[0]);
  const rows = [
    headers.map(escapeCsv).join(","),
    ...data.map((row) =>
      headers
        .map((h) => escapeCsv((row as Record<string, unknown>)[h]))
        .join(","),
    ),
  ].join("\r\n");

  // UTF-8 BOM ensures Excel opens with correct encoding (including ₹ symbol)
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + rows], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  // Use .csv extension - opens directly in Excel with proper formatting
  a.download = filename.replace(/\.(xlsx|xls)$/, ".csv");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
