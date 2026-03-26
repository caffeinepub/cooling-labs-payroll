import { MapPin } from "lucide-react";
import React, { useState, useMemo, useCallback } from "react";
import { ToastContainer } from "../../components/ui/ToastContainer";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { useAppContext } from "../../context/AppContext";
import { useToast } from "../../hooks/useToast";
import * as attendanceStorage from "../../services/attendanceStorage";

const STATUS_OPTIONS = ["Present", "Absent", "HalfDay", "Leave"] as const;
type AttStatus = (typeof STATUS_OPTIONS)[number];

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

export function SingleEntry() {
  const { activeEmployees } = useAppContext();
  const { toasts, addToast, removeToast } = useToast();
  const [entryMode, setEntryMode] = useState<"single" | "range">("single");
  const [empId, setEmpId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [fromDate, setFromDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [toDate, setToDate] = useState(new Date().toISOString().split("T")[0]);
  const [status, setStatus] = useState<AttStatus>("Present");
  const [otHours, setOtHours] = useState("0");
  const [punchIn, setPunchIn] = useState("");
  const [punchOut, setPunchOut] = useState("");
  const [lat, setLat] = useState(0);
  const [lng, setLng] = useState(0);
  const [locationCaptured, setLocationCaptured] = useState(false);
  const [capturingLocation, setCapturingLocation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDates, setPendingDates] = useState<string[]>([]);
  const [duplicateDates, setDuplicateDates] = useState<string[]>([]);

  const empOptions = useMemo(
    () =>
      activeEmployees.map((e) => ({
        value: e.id,
        label: `${e.name} (${e.employeeId})`,
      })),
    [activeEmployees],
  );

  const handleCaptureLocation = useCallback(() => {
    if (!navigator.geolocation) {
      addToast("Geolocation not supported by this browser", "error");
      return;
    }
    setCapturingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setLocationCaptured(true);
        addToast(
          `Location captured: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`,
          "success",
        );
        setCapturingLocation(false);
      },
      (_err) => {
        addToast("Location access denied or unavailable", "warning");
        setCapturingLocation(false);
      },
      { timeout: 10000 },
    );
  }, [addToast]);

  const doMarkDates = useCallback(
    (dates: string[], overwrite: boolean) => {
      let successCount = 0;
      let skipCount = 0;
      for (const d of dates) {
        const dateStr = d.replace(/-/g, "");
        // OT hours only applies for single-date entry
        const ot = entryMode === "single" ? Number.parseFloat(otHours) || 0 : 0;
        let ok: boolean;
        if (overwrite) {
          // Remove existing then re-mark
          attendanceStorage.deleteAttendance(empId, dateStr);
          ok =
            attendanceStorage.markAttendance(
              empId,
              dateStr,
              status,
              ot,
              punchIn,
              punchOut,
              lat,
              lng,
              "admin",
            ) !== false;
        } else {
          ok =
            attendanceStorage.markAttendance(
              empId,
              dateStr,
              status,
              ot,
              punchIn,
              punchOut,
              lat,
              lng,
              "admin",
            ) !== false;
        }
        if (ok) successCount++;
        else skipCount++;
      }
      if (successCount > 0)
        addToast(
          `Marked ${successCount} date(s) successfully${skipCount > 0 ? `, skipped ${skipCount} (already marked)` : ""}`,
          "success",
        );
      else addToast("No records saved (all duplicates)", "warning");
      // Reset form
      setEmpId("");
      setOtHours("0");
      setPunchIn("");
      setPunchOut("");
      setLat(0);
      setLng(0);
      setLocationCaptured(false);
    },
    [empId, status, otHours, punchIn, punchOut, lat, lng, entryMode, addToast],
  );

  const handleSubmit = useCallback(() => {
    if (!empId) {
      addToast("Select an employee", "warning");
      return;
    }

    let dates: string[];
    if (entryMode === "single") {
      if (!date) {
        addToast("Select a date", "warning");
        return;
      }
      dates = [date];
    } else {
      if (!fromDate || !toDate) {
        addToast("Select from and to dates", "warning");
        return;
      }
      dates = datesBetween(fromDate, toDate);
      if (dates.length === 0) {
        addToast('"From Date" must be on or before "To Date"', "warning");
        return;
      }
    }

    // Check for duplicates
    const dups = dates.filter((d) => {
      const ds = d.replace(/-/g, "");
      return attendanceStorage.getExistingKeys([`${empId}_${ds}`]).size > 0;
    });

    if (dups.length > 0) {
      setPendingDates(dates);
      setDuplicateDates(dups);
      setConfirmOpen(true);
      return;
    }

    setSaving(true);
    doMarkDates(dates, false);
    setSaving(false);
  }, [empId, date, fromDate, toDate, entryMode, addToast, doMarkDates]);

  return (
    <div className="max-w-lg space-y-4">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          Mark Single Attendance
        </h3>

        {/* Entry Mode Toggle */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Entry Mode</p>
          <div className="flex gap-2">
            {(["single", "range"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setEntryMode(m)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  entryMode === m
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {m === "single" ? "Single Date" : "Date Range"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="att-emp">Employee *</Label>
          <Select value={empId} onValueChange={setEmpId}>
            <SelectTrigger id="att-emp">
              <SelectValue placeholder="Select employee" />
            </SelectTrigger>
            <SelectContent>
              {empOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {entryMode === "single" ? (
          <div>
            <Label htmlFor="att-date">Date *</Label>
            <Input
              id="att-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="att-from">From Date *</Label>
              <Input
                id="att-from"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="att-to">To Date *</Label>
              <Input
                id="att-to"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            {fromDate && toDate && (
              <div className="col-span-2">
                <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
                  {datesBetween(fromDate, toDate).length} date(s) selected —
                  same status will be applied to each. OT hours are not copied
                  for date ranges.
                </p>
              </div>
            )}
          </div>
        )}

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Status *</p>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => setStatus(s)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  status === s
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {s === "HalfDay" ? "Half Day" : s}
              </button>
            ))}
          </div>
        </div>

        {entryMode === "single" &&
          (status === "Present" || status === "HalfDay") && (
            <div>
              <Label htmlFor="att-ot">OT Hours</Label>
              <Input
                id="att-ot"
                type="number"
                min="0"
                step="0.5"
                value={otHours}
                onChange={(e) => setOtHours(e.target.value)}
              />
            </div>
          )}

        {entryMode === "single" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="att-punchin">Punch In</Label>
                <Input
                  id="att-punchin"
                  type="time"
                  value={punchIn}
                  onChange={(e) => setPunchIn(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="att-punchout">Punch Out</Label>
                <Input
                  id="att-punchout"
                  type="time"
                  value={punchOut}
                  onChange={(e) => setPunchOut(e.target.value)}
                />
              </div>
            </div>

            {/* Location */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                GPS Location{" "}
                <span className="text-xs font-normal text-gray-400">
                  (optional)
                </span>
              </p>
              <button
                type="button"
                onClick={handleCaptureLocation}
                disabled={capturingLocation}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-colors ${
                  locationCaptured
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                }`}
              >
                <MapPin className="w-4 h-4" />
                {capturingLocation
                  ? "Capturing..."
                  : locationCaptured
                    ? `${lat.toFixed(4)}, ${lng.toFixed(4)}`
                    : "Capture Location"}
              </button>
            </div>
          </>
        )}

        <Button onClick={handleSubmit} disabled={saving} className="w-full">
          {saving ? "Saving..." : "Mark Attendance"}
        </Button>
      </div>

      {/* Overwrite confirmation dialog */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-6 max-w-sm w-full mx-4">
            <h3 className="font-semibold text-gray-900 mb-2">
              Duplicate Records Found
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {duplicateDates.length} date(s) already have attendance records
              for this employee. Do you want to overwrite them or skip?
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setConfirmOpen(false);
                  setSaving(true);
                  doMarkDates(pendingDates, false);
                  setSaving(false);
                }}
              >
                Skip Duplicates
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  setConfirmOpen(false);
                  setSaving(true);
                  doMarkDates(pendingDates, true);
                  setSaving(false);
                }}
              >
                Overwrite All
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
