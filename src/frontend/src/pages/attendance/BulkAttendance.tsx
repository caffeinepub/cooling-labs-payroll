import React, { useState, useMemo, useCallback, useEffect } from "react";
import { ToastContainer } from "../../components/ui/ToastContainer";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { useAppContext } from "../../context/AppContext";
import { useToast } from "../../hooks/useToast";
import * as attendanceStorage from "../../services/attendanceStorage";
import {
  bulkMarkAttendanceInCanister,
  bulkMarkAttendanceOverwriteInCanister,
} from "../../services/canisterAttendanceService";
import type { Employee } from "../../types";

const STATUS_OPTS = ["Present", "Absent", "HalfDay", "Leave"];

interface Row {
  emp: Employee;
  status: string;
  otHours: string;
}

function datesBetween(from: string, to: string): string[] {
  if (!from || !to) return [];
  const result: string[] = [];
  const cur = new Date(from);
  const end = new Date(to);
  if (cur > end) return [];
  while (cur <= end) {
    result.push(cur.toISOString().split("T")[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

export function BulkAttendance() {
  const { activeEmployees } = useAppContext();
  const { toasts, addToast, removeToast } = useToast();
  const [site, setSite] = useState("");
  const [fromDate, setFromDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [toDate, setToDate] = useState(new Date().toISOString().split("T")[0]);
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [result, setResult] = useState<{
    success: bigint;
    skipped: bigint;
    overwritten: number;
    errors: string[];
  } | null>(null);
  const [overwriteOpen, setOverwriteOpen] = useState(false);
  const [pendingEntries, setPendingEntries] = useState<
    [string, string, string, number][]
  >([]);
  const [duplicateCount, setDuplicateCount] = useState(0);

  const siteOptions = useMemo(
    () => [...new Set(activeEmployees.map((e) => e.site).filter(Boolean))],
    [activeEmployees],
  );

  const dates = useMemo(
    () => datesBetween(fromDate, toDate),
    [fromDate, toDate],
  );

  const loadEmployees = useCallback(() => {
    if (!site) {
      setRows([]);
      return;
    }
    const emps = activeEmployees.filter((e) => e.site === site);
    setRows(emps.map((emp) => ({ emp, status: "Present", otHours: "0" })));
  }, [site, activeEmployees]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const updateRow = useCallback(
    (idx: number, field: "status" | "otHours", val: string) => {
      setRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, [field]: val } : r)),
      );
    },
    [],
  );

  const buildEntries = useCallback((): [string, string, string, number][] => {
    const entries: [string, string, string, number][] = [];
    for (const dateStr of dates) {
      const ds = dateStr.replace(/-/g, "");
      for (const row of rows) {
        entries.push([
          row.emp.id,
          ds,
          row.status,
          Number.parseFloat(row.otHours) || 0,
        ]);
      }
    }
    return entries;
  }, [dates, rows]);

  const handleSubmit = useCallback(() => {
    if (!site || !fromDate || rows.length === 0) {
      addToast("Select site, date(s), and load employees first", "warning");
      return;
    }
    if (dates.length === 0) {
      addToast('"From Date" must be on or before "To Date"', "warning");
      return;
    }

    const entries = buildEntries();

    // Check for existing duplicates
    const existing = attendanceStorage.getExistingKeys(
      entries.map(([empId, dateStr]) => `${empId}_${dateStr}`),
    );
    if (existing.size > 0) {
      setPendingEntries(entries);
      setDuplicateCount(existing.size);
      setOverwriteOpen(true);
      return;
    }

    doSubmit(entries, false);
  }, [site, fromDate, dates, rows, buildEntries, addToast]);

  const doSubmit = useCallback(
    (entries: [string, string, string, number][], overwrite: boolean) => {
      setSaving(true);
      let res: { successCount: bigint; skippedCount: bigint; errors: string[] };
      if (overwrite) {
        res = attendanceStorage.bulkMarkAttendanceOverwrite(entries, "admin");
        void bulkMarkAttendanceOverwriteInCanister(entries, "admin");
      } else {
        res = attendanceStorage.bulkMarkAttendance(entries, "admin");
        void bulkMarkAttendanceInCanister(entries, "admin");
      }
      setResult({
        success: res.successCount,
        skipped: res.skippedCount,
        overwritten: overwrite ? duplicateCount : 0,
        errors: res.errors,
      });
      setResultOpen(true);
      setSaving(false);
    },
    [duplicateCount],
  );

  const handleConfirmOverwrite = useCallback(() => {
    setOverwriteOpen(false);
    doSubmit(pendingEntries, true);
  }, [pendingEntries, doSubmit]);

  const handleSkipDuplicates = useCallback(() => {
    setOverwriteOpen(false);
    doSubmit(pendingEntries, false);
  }, [pendingEntries, doSubmit]);

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <Label>Site *</Label>
            <select
              value={site}
              onChange={(e) => setSite(e.target.value)}
              className="block mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none min-w-36"
            >
              <option value="">Select site</option>
              {siteOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>From Date *</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>To Date *</Label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="mt-1"
            />
          </div>
          <Button variant="outline" onClick={loadEmployees}>
            Load Employees
          </Button>
        </div>
        {dates.length > 1 && (
          <p className="mt-2 text-xs text-blue-600 font-medium">
            ℹ️ {dates.length} dates selected ({fromDate} to {toDate}). Same
            status will be applied to each date.
          </p>
        )}
      </div>

      {rows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">
              {rows.length} employees — {site} —{" "}
              {dates.length === 1
                ? fromDate
                : `${fromDate} to ${toDate} (${dates.length} days)`}
            </p>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving
                ? "Submitting..."
                : `Submit (${rows.length * dates.length} entries)`}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Employee
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Emp ID
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    OT Hours
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((row, idx) => (
                  <tr key={row.emp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {row.emp.name}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {row.emp.employeeId}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={row.status}
                        onChange={(e) =>
                          updateRow(idx, "status", e.target.value)
                        }
                        className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none"
                      >
                        {STATUS_OPTS.map((s) => (
                          <option key={s} value={s}>
                            {s === "HalfDay" ? "Half Day" : s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={row.otHours}
                        onChange={(e) =>
                          updateRow(idx, "otHours", e.target.value)
                        }
                        className="w-20 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Overwrite Confirmation */}
      <Dialog
        open={overwriteOpen}
        onOpenChange={(o) => !o && setOverwriteOpen(false)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Duplicate Records Found</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            {duplicateCount} attendance record(s) already exist for the selected
            employee/date combinations. Do you want to overwrite them or skip
            duplicates?
          </p>
          <div className="flex gap-3 mt-2">
            <Button
              variant="outline"
              onClick={handleSkipDuplicates}
              className="flex-1"
            >
              Skip Duplicates
            </Button>
            <Button onClick={handleConfirmOverwrite} className="flex-1">
              Overwrite All
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Result Dialog */}
      <Dialog
        open={resultOpen}
        onOpenChange={(o) => !o && setResultOpen(false)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Submission Results</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
              ✓ {String(result?.success ?? 0)} records marked successfully
            </p>
            {(result?.overwritten ?? 0) > 0 && (
              <p className="text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                ↺ {result?.overwritten} records overwritten
              </p>
            )}
            {Number(result?.skipped ?? 0) > 0 && (
              <p className="text-sm text-yellow-700 bg-yellow-50 rounded-lg px-3 py-2">
                ⚠ {String(result?.skipped ?? 0)} skipped (already marked)
              </p>
            )}
            {(result?.errors ?? []).length > 0 && (
              <p className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
                ✗ {result?.errors.length} errors
              </p>
            )}
          </div>
          <Button onClick={() => setResultOpen(false)} className="w-full">
            Done
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
