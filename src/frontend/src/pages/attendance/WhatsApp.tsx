import { Clipboard, Phone, PlusCircle, Send, Trash2, X } from "lucide-react";
import React, { useState, useCallback } from "react";
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
import * as workforceStorage from "../../services/workforceStorage";
import type { Supervisor } from "../../types";

interface CommandLog {
  id: string;
  line: string;
  type: string;
  status: "success" | "error" | "skipped";
  message: string;
  timestamp: string;
}

type Tab = "parser" | "supervisors";

export function WhatsApp() {
  const { activeEmployees, supervisors, activeSites, refreshSupervisors } =
    useAppContext();
  const { toasts, addToast, removeToast } = useToast();
  const [tab, setTab] = useState<Tab>("parser");
  const [text, setText] = useState("");
  const [log, setLog] = useState<CommandLog[]>([]);
  const [processing, setProcessing] = useState(false);

  const [supOpen, setSupOpen] = useState(false);
  const [supPhone, setSupPhone] = useState("");
  const [supName, setSupName] = useState("");
  const [supSite, setSupSite] = useState("");
  const [supPin, setSupPin] = useState("");
  const [supSaving, setSupSaving] = useState(false);

  const handlePaste = useCallback(async () => {
    try {
      const content = await navigator.clipboard.readText();
      setText(content);
      addToast("Pasted from clipboard", "success");
    } catch {
      addToast(
        "Clipboard access blocked — please paste manually (Ctrl+V)",
        "warning",
      );
    }
  }, [addToast]);

  const handleProcess = useCallback(() => {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      addToast("No commands to process", "warning");
      return;
    }

    setProcessing(true);
    const results: CommandLog[] = [];
    const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const now = new Date().toLocaleTimeString();

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const cmd = parts[0]?.toUpperCase();
      const entryId = Math.random().toString(36).slice(2);

      if (cmd === "ATT" && parts.length >= 3) {
        const empCode = parts[1];
        const status = parts[2];
        const validStatuses = ["Present", "Absent", "HalfDay", "Leave"];
        if (!validStatuses.includes(status)) {
          results.push({
            id: entryId,
            line,
            type: "ATT",
            status: "error",
            message: `Invalid status "${status}". Use: Present, Absent, HalfDay, Leave`,
            timestamp: now,
          });
          continue;
        }
        const emp = activeEmployees.find((e) => e.employeeId === empCode);
        if (!emp) {
          results.push({
            id: entryId,
            line,
            type: "ATT",
            status: "error",
            message: `Employee ${empCode} not found`,
            timestamp: now,
          });
          continue;
        }
        const ok = attendanceStorage.markAttendance(
          emp.id,
          today,
          status,
          0,
          "",
          "",
          0,
          0,
          "whatsapp",
        );
        results.push({
          id: entryId,
          line,
          type: "ATT",
          status: ok ? "success" : "skipped",
          message: ok
            ? `✓ ${emp.name} marked ${status}`
            : "Already marked for today",
          timestamp: now,
        });
      } else if (cmd === "OT" && parts.length >= 3) {
        const empCode = parts[1];
        const hours = Number.parseFloat(parts[2]) || 0;
        const emp = activeEmployees.find((e) => e.employeeId === empCode);
        if (!emp) {
          results.push({
            id: entryId,
            line,
            type: "OT",
            status: "error",
            message: `Employee ${empCode} not found`,
            timestamp: now,
          });
          continue;
        }
        const updated = attendanceStorage.updateAttendanceOT(
          emp.id,
          today,
          hours,
          "whatsapp",
        );
        if (!updated) {
          attendanceStorage.markAttendance(
            emp.id,
            today,
            "Present",
            hours,
            "",
            "",
            0,
            0,
            "whatsapp",
          );
        }
        results.push({
          id: entryId,
          line,
          type: "OT",
          status: "success",
          message: `✓ ${hours}h OT recorded for ${emp.name}`,
          timestamp: now,
        });
      } else if (cmd === "ADV" && parts.length >= 3) {
        const empCode = parts[1];
        const amount = Number.parseFloat(parts[2]) || 0;
        const emp = activeEmployees.find((e) => e.employeeId === empCode);
        if (!emp) {
          results.push({
            id: entryId,
            line,
            type: "ADV",
            status: "error",
            message: `Employee ${empCode} not found`,
            timestamp: now,
          });
          continue;
        }
        // Write advance to canonical attendance store for payroll integration
        attendanceStorage.updateAttendanceAdvance(
          emp.id,
          today,
          amount,
          "whatsapp",
        );
        console.debug(
          `[WhatsApp] ADV committed: ${emp.id} ${today} adv=${amount}`,
        );
        results.push({
          id: entryId,
          line,
          type: "ADV",
          status: "success",
          message: `✓ ₹${amount} advance recorded for ${emp.name} (affects payroll)`,
          timestamp: now,
        });
      } else {
        results.push({
          id: entryId,
          line,
          type: cmd ?? "?",
          status: "error",
          message:
            "Unknown format. Use: ATT EMP001 Present | OT EMP001 2 | ADV EMP001 500",
          timestamp: now,
        });
      }
    }

    setLog((prev) => [...results, ...prev].slice(0, 100));
    const success = results.filter((r) => r.status === "success").length;
    const errors = results.filter((r) => r.status === "error").length;
    addToast(
      `Processed ${results.length} commands — ${success} ok, ${errors} failed`,
      errors > 0 ? "warning" : "success",
    );
    setProcessing(false);
  }, [text, activeEmployees, addToast]);

  const handleAddSupervisor = useCallback(async () => {
    if (!supPhone.trim() || !supName.trim()) {
      addToast("Phone and name are required", "warning");
      return;
    }
    if (!supPin.trim() || supPin.length !== 4 || !/^\d{4}$/.test(supPin)) {
      addToast("PIN must be exactly 4 digits", "warning");
      return;
    }
    setSupSaving(true);
    const ok = workforceStorage.createSupervisor({
      phone: supPhone.trim(),
      name: supName.trim(),
      siteId: supSite,
      pin: supPin.trim(),
      active: true,
    });
    if (ok) {
      addToast("Supervisor added", "success");
      setSupOpen(false);
      setSupPhone("");
      setSupName("");
      setSupSite("");
      setSupPin("");
      await refreshSupervisors();
    } else {
      addToast("Phone number already mapped", "error");
    }
    setSupSaving(false);
  }, [supPhone, supName, supSite, supPin, addToast, refreshSupervisors]);

  const handleRemoveSupervisor = useCallback(
    async (phone: string) => {
      workforceStorage.updateSupervisor(phone, { active: false });
      addToast("Supervisor removed", "success");
      await refreshSupervisors();
    },
    [addToast, refreshSupervisors],
  );

  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      tab === t ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"
    }`;

  const activeSupervisors = supervisors.filter((s) => s.active !== false);

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="flex gap-2 bg-white rounded-xl border border-gray-200 p-2 shadow-sm w-fit">
        <button
          type="button"
          className={tabClass("parser")}
          onClick={() => setTab("parser")}
        >
          Parser
        </button>
        <button
          type="button"
          className={tabClass("supervisors")}
          onClick={() => setTab("supervisors")}
        >
          Supervisors ({activeSupervisors.length})
        </button>
      </div>

      {tab === "parser" && (
        <>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">
                Command Input
              </h3>
              <button
                type="button"
                onClick={handlePaste}
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700"
              >
                <Clipboard className="w-3.5 h-3.5" /> Paste from Clipboard
              </button>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                "Paste WhatsApp commands here, one per line:\nATT EMP001 Present SITE1\nOT EMP001 2 SITE1\nADV EMP001 500 SITE1"
              }
              className="w-full h-36 text-sm font-mono border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-xs text-blue-700 space-y-1">
              <p className="font-semibold mb-1">Supported Commands:</p>
              <p>
                <code className="bg-blue-100 px-1 rounded">
                  ATT [EmpID] [Status]
                </code>{" "}
                — Status: Present, Absent, HalfDay, Leave
              </p>
              <p>
                <code className="bg-blue-100 px-1 rounded">
                  OT [EmpID] [Hours]
                </code>{" "}
                — Mark overtime hours
              </p>
              <p>
                <code className="bg-blue-100 px-1 rounded">
                  ADV [EmpID] [Amount] [Site]
                </code>{" "}
                — Record advance payment
              </p>
            </div>
            <Button
              onClick={handleProcess}
              disabled={processing || !text.trim()}
              className="w-full"
            >
              <Send className="w-4 h-4 mr-2" />
              {processing ? "Processing..." : "Parse & Submit"}
            </Button>
          </div>

          {log.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">
                  Command Log ({log.length})
                </p>
                <button
                  type="button"
                  onClick={() => setLog([])}
                  className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" /> Clear
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-2.5 font-medium text-gray-500">
                        Time
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-500">
                        Command
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-500">
                        Type
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-500">
                        Result
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-gray-500">
                        Message
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {log.map((entry) => (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">
                          {entry.timestamp}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-700">
                          {entry.line}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-semibold">
                            {entry.type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              entry.status === "success"
                                ? "bg-green-100 text-green-700"
                                : entry.status === "skipped"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-red-100 text-red-700"
                            }`}
                          >
                            {entry.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 text-xs">
                          {entry.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "supervisors" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Only mapped supervisors can submit WhatsApp commands.
            </p>
            <Button size="sm" onClick={() => setSupOpen(true)}>
              <PlusCircle className="w-4 h-4 mr-1.5" /> Add Supervisor
            </Button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {activeSupervisors.length === 0 ? (
              <div className="py-12 text-center">
                <Phone className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  No supervisors mapped yet
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Add supervisor phone numbers to control who can submit
                  WhatsApp commands
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-500">
                      Phone
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">
                      Name
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">
                      Site
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">
                      Status
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {activeSupervisors.map((sup: Supervisor) => (
                    <tr key={sup.phone} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-gray-700">
                        {sup.phone}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {sup.name}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {sup.siteId || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          Active
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveSupervisor(sup.phone)}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 hover:text-red-600 transition-colors"
                          title="Remove supervisor"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <Dialog open={supOpen} onOpenChange={(o) => !o && setSupOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Supervisor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="sup-phone">Phone Number *</Label>
              <Input
                id="sup-phone"
                value={supPhone}
                onChange={(e) => setSupPhone(e.target.value)}
                placeholder="e.g. 9876543210"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sup-name">Name *</Label>
              <Input
                id="sup-name"
                value={supName}
                onChange={(e) => setSupName(e.target.value)}
                placeholder="Supervisor name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sup-pin">4-Digit PIN *</Label>
              <Input
                id="sup-pin"
                type="password"
                maxLength={4}
                value={supPin}
                onChange={(e) => setSupPin(e.target.value.replace(/\D/g, ""))}
                placeholder="e.g. 1234"
              />
              <p className="text-xs text-gray-400">
                Supervisor uses this PIN to access the Supervisor View
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sup-site">Site</Label>
              <select
                id="sup-site"
                value={supSite}
                onChange={(e) => setSupSite(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">All sites</option>
                {activeSites.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setSupOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddSupervisor} disabled={supSaving}>
              {supSaving ? "Adding..." : "Add Supervisor"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
