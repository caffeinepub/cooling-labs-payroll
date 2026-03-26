import { useNavigate } from "@tanstack/react-router";
import {
  Building2,
  Eye,
  EyeOff,
  FileSpreadsheet,
  KeyRound,
  LogOut,
  Save,
  ShieldCheck,
  Upload,
  User,
} from "lucide-react";
import React, { useState, useCallback } from "react";
import { ToastContainer } from "../components/ui/ToastContainer";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { useAdminAuth } from "../context/AdminAuthContext";
import { useToast } from "../hooks/useToast";
import {
  type ImportMode,
  type NameMismatchRule,
  type SiteMismatchRule,
  getImportSettings,
  saveImportSettings,
} from "../services/attendanceImportStorage";
import {
  getCompanySettings,
  saveCompanySettings,
} from "../services/companySettings";
import {
  DEFAULT_PERMISSIONS,
  getGlobalDefaults,
  saveGlobalDefaults,
} from "../services/supervisorPermissionsStorage";
import type { SupervisorPermissions } from "../types";

function PermRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {desc && <p className="text-xs text-gray-500">{desc}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function AdminSettings() {
  const { logout, changePassword, updateAdminProfile, adminName } =
    useAdminAuth();
  const { toasts, addToast, removeToast } = useToast();
  const navigate = useNavigate();
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState(adminName);
  const [savingProfile, setSavingProfile] = useState(false);
  const [companySettings, setCompanySettings] =
    React.useState(getCompanySettings);
  const [savingLogo, setSavingLogo] = useState(false);
  const [importSettings, setImportSettings] = React.useState(getImportSettings);
  const [globalPerms, setGlobalPerms] = React.useState<SupervisorPermissions>(
    () => getGlobalDefaults(),
  );
  const [savingGlobalPerms, setSavingGlobalPerms] = useState(false);

  const handleLogoUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        addToast("Please upload an image file", "warning");
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        const updated = { ...companySettings, logoDataUrl: dataUrl };
        setCompanySettings(updated);
        saveCompanySettings(updated);
        addToast("Logo saved successfully", "success");
      };
      reader.readAsDataURL(file);
    },
    [companySettings, addToast],
  );

  const handleClearLogo = useCallback(() => {
    const updated = { ...companySettings, logoDataUrl: "" };
    setCompanySettings(updated);
    saveCompanySettings(updated);
    addToast("Logo removed", "success");
  }, [companySettings, addToast]);

  const handleSaveCompanyName = useCallback(() => {
    setSavingLogo(true);
    saveCompanySettings({ companyName: companySettings.companyName });
    addToast("Company name saved", "success");
    setSavingLogo(false);
  }, [companySettings, addToast]);

  const handleSaveProfile = useCallback(() => {
    if (!editName.trim()) {
      addToast("Name cannot be empty", "warning");
      return;
    }
    setSavingProfile(true);
    updateAdminProfile(editName.trim());
    addToast("Profile updated", "success");
    setSavingProfile(false);
  }, [editName, updateAdminProfile, addToast]);

  const handleChangePassword = useCallback(async () => {
    if (!oldPw || !newPw || !confirmPw) {
      addToast("Fill all password fields", "warning");
      return;
    }
    if (newPw !== confirmPw) {
      addToast("New passwords do not match", "warning");
      return;
    }
    if (newPw.length < 4) {
      addToast("Password must be at least 4 characters", "warning");
      return;
    }
    setSaving(true);
    try {
      const ok = await changePassword(oldPw, newPw);
      if (ok) {
        addToast("Password changed successfully", "success");
        setOldPw("");
        setNewPw("");
        setConfirmPw("");
      } else {
        addToast("Old password is incorrect", "error");
      }
    } finally {
      setSaving(false);
    }
  }, [oldPw, newPw, confirmPw, changePassword, addToast]);

  const handleLogout = useCallback(() => {
    logout();
    navigate({ to: "/admin/login" });
  }, [logout, navigate]);

  const handleSaveImportSettings = useCallback(() => {
    saveImportSettings(importSettings);
    addToast("Import settings saved", "success");
  }, [importSettings, addToast]);

  const handleSaveGlobalPerms = useCallback(() => {
    setSavingGlobalPerms(true);
    saveGlobalDefaults(globalPerms);
    addToast("Default supervisor permissions saved", "success");
    setSavingGlobalPerms(false);
  }, [globalPerms, addToast]);

  const setGP = (path: string[], val: boolean) => {
    setGlobalPerms((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as SupervisorPermissions;
      // biome-ignore lint/suspicious/noExplicitAny: dynamic path update
      let obj: any = next;
      for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
      obj[path[path.length - 1]] = val;
      return next;
    });
  };

  return (
    <div className="max-w-lg space-y-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Profile */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <User className="w-5 h-5 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">Admin Profile</h3>
        </div>
        <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
            {adminName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900">{adminName}</p>
            <p className="text-sm text-gray-500">Full system access</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <Label>Display Name</Label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Your name"
              className="mt-1"
            />
          </div>
          <Button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            size="sm"
          >
            <Save className="w-4 h-4 mr-2" /> Save Profile
          </Button>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <KeyRound className="w-5 h-5 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">
            Change Password
          </h3>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="old-pw">Current Password</Label>
            <div className="relative">
              <Input
                id="old-pw"
                type={showOld ? "text" : "password"}
                value={oldPw}
                onChange={(e) => setOldPw(e.target.value)}
                placeholder="Current password"
              />
              <button
                type="button"
                onClick={() => setShowOld((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showOld ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-pw">New Password</Label>
            <div className="relative">
              <Input
                id="new-pw"
                type={showNew ? "text" : "password"}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="New password (min. 4 characters)"
              />
              <button
                type="button"
                onClick={() => setShowNew((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showNew ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-pw">Confirm New Password</Label>
            <Input
              id="confirm-pw"
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleChangePassword()}
              placeholder="Repeat new password"
            />
          </div>
          <Button onClick={handleChangePassword} disabled={saving}>
            {saving ? "Saving..." : "Update Password"}
          </Button>
        </div>
      </div>

      {/* Company / Logo Settings */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <Building2 className="w-5 h-5 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">
            Company Settings (Payslip Header)
          </h3>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Company Name</Label>
            <div className="flex gap-2">
              <input
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={companySettings.companyName}
                onChange={(e) =>
                  setCompanySettings((s) => ({
                    ...s,
                    companyName: e.target.value,
                  }))
                }
                placeholder="Company name as it appears on payslip"
              />
              <Button
                size="sm"
                onClick={handleSaveCompanyName}
                disabled={savingLogo}
              >
                <Save className="w-4 h-4 mr-1.5" /> Save
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Company Logo (for Payslip)</Label>
            {companySettings.logoDataUrl ? (
              <div className="flex items-center gap-4">
                <img
                  src={companySettings.logoDataUrl}
                  alt="Company Logo"
                  className="h-14 max-w-[180px] object-contain border border-gray-200 rounded p-1 bg-white"
                />
                <div className="flex flex-col gap-2">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">
                      <Upload className="w-3.5 h-3.5" /> Replace Logo
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={handleClearLogo}
                    className="text-xs text-red-500 hover:underline text-left"
                  >
                    Remove logo
                  </button>
                </div>
              </div>
            ) : (
              <label className="cursor-pointer block">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors">
                  <Upload className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-600">
                    Click to upload company logo
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    PNG, JPG — recommended max 200×80px
                  </p>
                </div>
              </label>
            )}
            <p className="text-xs text-gray-400">
              Logo appears in the payslip header. If not set, company name will
              be shown.
            </p>
          </div>
        </div>
      </div>

      {/* Attendance Import Settings */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <FileSpreadsheet className="w-5 h-5 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">
            Attendance Import Settings
          </h3>
        </div>
        <div className="space-y-5">
          {/* Default Import Mode */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">
              Default Import Mode
            </Label>
            <div className="space-y-2">
              {(
                [
                  {
                    value: "smartMerge",
                    label: "Smart Merge",
                    desc: "Create new records; update OT/Advance/Remarks on existing",
                  },
                  {
                    value: "skip",
                    label: "Skip Existing",
                    desc: "Do not modify records that already exist",
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
                  className="flex items-start gap-2.5 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="defaultMode"
                    value={opt.value}
                    checked={importSettings.defaultMode === opt.value}
                    onChange={() =>
                      setImportSettings((s) => ({
                        ...s,
                        defaultMode: opt.value,
                      }))
                    }
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {opt.label}
                    </p>
                    <p className="text-xs text-gray-500">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Supervisor Upload Permission */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium text-gray-800">
                Supervisor Upload Permission
              </p>
              <p className="text-xs text-gray-500">
                Allow supervisors to upload attendance files (restricted to
                their assigned sites)
              </p>
            </div>
            <Switch
              checked={importSettings.supervisorCanUpload}
              onCheckedChange={(v) =>
                setImportSettings((s) => ({ ...s, supervisorCanUpload: v }))
              }
              data-ocid="attendance_import.switch"
            />
          </div>

          {/* Site Mismatch Rule */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">
              Site Mismatch Handling
            </Label>
            <p className="text-xs text-gray-500">
              When employee's assigned site doesn't match the site in the
              uploaded file
            </p>
            <div className="flex gap-6">
              {(
                [
                  {
                    value: "warning",
                    label: "Warning (allow import, log mismatch)",
                  },
                  { value: "error", label: "Error (block that row)" },
                ] as { value: SiteMismatchRule; label: string }[]
              ).map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="siteMismatch"
                    value={opt.value}
                    checked={importSettings.siteMismatchRule === opt.value}
                    onChange={() =>
                      setImportSettings((s) => ({
                        ...s,
                        siteMismatchRule: opt.value,
                      }))
                    }
                  />
                  <span className="text-sm text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Employee Name Mismatch */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">
              Employee Name Mismatch
            </Label>
            <p className="text-xs text-gray-500">
              When name in file doesn't match Employee Master
            </p>
            <div className="flex gap-6">
              {(
                [
                  { value: "warn", label: "Warn only (allow import)" },
                  { value: "block", label: "Block row" },
                ] as { value: NameMismatchRule; label: string }[]
              ).map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="nameMismatch"
                    value={opt.value}
                    checked={importSettings.nameMismatchRule === opt.value}
                    onChange={() =>
                      setImportSettings((s) => ({
                        ...s,
                        nameMismatchRule: opt.value,
                      }))
                    }
                  />
                  <span className="text-sm text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <Button
            size="sm"
            onClick={handleSaveImportSettings}
            data-ocid="attendance_import.save_button"
          >
            <Save className="w-4 h-4 mr-2" /> Save Import Settings
          </Button>
        </div>
      </div>

      {/* Default Supervisor Permissions */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-2">
          <ShieldCheck className="w-5 h-5 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">
            Default Supervisor Permissions
          </h3>
        </div>
        <p className="text-xs text-gray-500 mb-5">
          These defaults apply to all new supervisors unless overridden
          individually in User Management. Global Default → can be overridden
          per supervisor.
        </p>
        <div className="space-y-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Attendance
          </p>
          <PermRow
            label="View Attendance"
            checked={globalPerms.attendance.view}
            onChange={(v) => setGP(["attendance", "view"], v)}
          />
          <PermRow
            label="Mark Attendance"
            checked={globalPerms.attendance.mark}
            onChange={(v) => setGP(["attendance", "mark"], v)}
          />
          <PermRow
            label="Bulk Mark"
            checked={globalPerms.attendance.bulk}
            onChange={(v) => setGP(["attendance", "bulk"], v)}
          />
          <PermRow
            label="Date Range Attendance"
            checked={globalPerms.attendance.dateRange}
            onChange={(v) => setGP(["attendance", "dateRange"], v)}
          />
          <PermRow
            label="Request Correction Only"
            desc="Supervisor can only raise requests, not directly edit"
            checked={globalPerms.attendance.requestCorrectionOnly}
            onChange={(v) => setGP(["attendance", "requestCorrectionOnly"], v)}
          />

          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 mt-4">
            OT
          </p>
          <PermRow
            label="View OT"
            checked={globalPerms.ot.view}
            onChange={(v) => setGP(["ot", "view"], v)}
          />
          <PermRow
            label="Add OT Request"
            checked={globalPerms.ot.add}
            onChange={(v) => setGP(["ot", "add"], v)}
          />
          <PermRow
            label="Require Admin Approval for OT"
            checked={globalPerms.ot.requireApproval}
            onChange={(v) => setGP(["ot", "requireApproval"], v)}
          />

          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 mt-4">
            Advance
          </p>
          <PermRow
            label="View Advance"
            checked={globalPerms.advance.view}
            onChange={(v) => setGP(["advance", "view"], v)}
          />
          <PermRow
            label="Add Advance Request"
            checked={globalPerms.advance.add}
            onChange={(v) => setGP(["advance", "add"], v)}
          />
          <PermRow
            label="Require Admin Approval for Advance"
            checked={globalPerms.advance.requireApproval}
            onChange={(v) => setGP(["advance", "requireApproval"], v)}
          />

          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 mt-4">
            Payroll
          </p>
          <PermRow
            label="View Salary Summary"
            checked={globalPerms.payroll.viewSummary}
            onChange={(v) => setGP(["payroll", "viewSummary"], v)}
          />
          <PermRow
            label="View Payroll Rows"
            checked={globalPerms.payroll.viewRows}
            onChange={(v) => setGP(["payroll", "viewRows"], v)}
          />
          <PermRow
            label="Download Payslip"
            checked={globalPerms.payroll.downloadPayslip}
            onChange={(v) => setGP(["payroll", "downloadPayslip"], v)}
          />

          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 mt-4">
            Import
          </p>
          <PermRow
            label="View Import History"
            checked={globalPerms.import.viewHistory}
            onChange={(v) => setGP(["import", "viewHistory"], v)}
          />
          <PermRow
            label="Upload Attendance"
            checked={globalPerms.import.upload}
            onChange={(v) => setGP(["import", "upload"], v)}
          />

          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 mt-4">
            Regularization
          </p>
          <PermRow
            label="Raise Regularization"
            checked={globalPerms.regularization.raise}
            onChange={(v) => setGP(["regularization", "raise"], v)}
          />
          <PermRow
            label="Approve Regularization"
            desc="Default: OFF — only admin approves by default"
            checked={globalPerms.regularization.approve}
            onChange={(v) => setGP(["regularization", "approve"], v)}
          />
        </div>
        <div className="mt-5">
          <Button
            size="sm"
            onClick={handleSaveGlobalPerms}
            disabled={savingGlobalPerms}
            data-ocid="settings.save_button"
          >
            <Save className="w-4 h-4 mr-2" /> Save Default Permissions
          </Button>
        </div>
      </div>

      {/* Logout */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <LogOut className="w-5 h-5 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">Session</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          You are currently logged in as {adminName}. Logging out will lock all
          admin features and require re-authentication.
        </p>
        <Button
          variant="outline"
          onClick={handleLogout}
          className="text-red-600 border-red-200 hover:bg-red-50"
        >
          <LogOut className="w-4 h-4 mr-2" /> Logout
        </Button>
      </div>
    </div>
  );
}
