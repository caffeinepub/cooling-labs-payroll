import {
  KeyRound,
  Plus,
  Settings2,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { ToastContainer } from "../components/ui/ToastContainer";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { useAppContext } from "../context/AppContext";
import { useToast } from "../hooks/useToast";
import * as supervisorPermissionsStorage from "../services/supervisorPermissionsStorage";
import * as workforceStorage from "../services/workforceStorage";
import type { Supervisor, SupervisorPermissions } from "../types";

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

function PermissionEditor({
  perms,
  onChange,
}: {
  perms: SupervisorPermissions;
  onChange: (p: SupervisorPermissions) => void;
}) {
  const set = (path: string[], val: boolean) => {
    const next = JSON.parse(JSON.stringify(perms)) as SupervisorPermissions;
    // biome-ignore lint/suspicious/noExplicitAny: dynamic path
    let obj: any = next;
    for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
    obj[path[path.length - 1]] = val;
    onChange(next);
  };

  return (
    <Tabs defaultValue="attendance">
      <TabsList className="mb-4">
        <TabsTrigger value="attendance">Attendance</TabsTrigger>
        <TabsTrigger value="ot">OT</TabsTrigger>
        <TabsTrigger value="advance">Advance</TabsTrigger>
        <TabsTrigger value="payroll">Payroll</TabsTrigger>
        <TabsTrigger value="import">Import</TabsTrigger>
        <TabsTrigger value="reg">Regularization</TabsTrigger>
      </TabsList>

      <TabsContent value="attendance">
        <PermRow
          label="View Attendance"
          checked={perms.attendance.view}
          onChange={(v) => set(["attendance", "view"], v)}
        />
        <PermRow
          label="Mark Attendance"
          checked={perms.attendance.mark}
          onChange={(v) => set(["attendance", "mark"], v)}
        />
        <PermRow
          label="Bulk Mark"
          checked={perms.attendance.bulk}
          onChange={(v) => set(["attendance", "bulk"], v)}
        />
        <PermRow
          label="Date Range Attendance"
          checked={perms.attendance.dateRange}
          onChange={(v) => set(["attendance", "dateRange"], v)}
        />
        <PermRow
          label="Request Correction Only"
          desc="Supervisor can only request correction, not directly edit"
          checked={perms.attendance.requestCorrectionOnly}
          onChange={(v) => set(["attendance", "requestCorrectionOnly"], v)}
        />
      </TabsContent>

      <TabsContent value="ot">
        <PermRow
          label="View OT"
          checked={perms.ot.view}
          onChange={(v) => set(["ot", "view"], v)}
        />
        <PermRow
          label="Add OT Request"
          checked={perms.ot.add}
          onChange={(v) => set(["ot", "add"], v)}
        />
        <PermRow
          label="Require Admin Approval"
          desc="OT requests go to Approvals Center before applying"
          checked={perms.ot.requireApproval}
          onChange={(v) => set(["ot", "requireApproval"], v)}
        />
      </TabsContent>

      <TabsContent value="advance">
        <PermRow
          label="View Advance"
          checked={perms.advance.view}
          onChange={(v) => set(["advance", "view"], v)}
        />
        <PermRow
          label="Add Advance Request"
          checked={perms.advance.add}
          onChange={(v) => set(["advance", "add"], v)}
        />
        <PermRow
          label="Require Admin Approval"
          desc="Advance requests go to Approvals Center before applying"
          checked={perms.advance.requireApproval}
          onChange={(v) => set(["advance", "requireApproval"], v)}
        />
      </TabsContent>

      <TabsContent value="payroll">
        <PermRow
          label="View Salary Summary"
          checked={perms.payroll.viewSummary}
          onChange={(v) => set(["payroll", "viewSummary"], v)}
        />
        <PermRow
          label="View Payroll Rows"
          desc="Show Basic, Gross, PF, ESI columns"
          checked={perms.payroll.viewRows}
          onChange={(v) => set(["payroll", "viewRows"], v)}
        />
        <PermRow
          label="Download Payslip"
          desc="Allow supervisor to download salary slips"
          checked={perms.payroll.downloadPayslip}
          onChange={(v) => set(["payroll", "downloadPayslip"], v)}
        />
      </TabsContent>

      <TabsContent value="import">
        <PermRow
          label="View Import History"
          checked={perms.import.viewHistory}
          onChange={(v) => set(["import", "viewHistory"], v)}
        />
        <PermRow
          label="Upload Attendance"
          desc="Allow file upload for assigned site"
          checked={perms.import.upload}
          onChange={(v) => set(["import", "upload"], v)}
        />
        <PermRow
          label="Require Approval Before Commit"
          checked={perms.import.requireApproval}
          onChange={(v) => set(["import", "requireApproval"], v)}
        />
      </TabsContent>

      <TabsContent value="reg">
        <PermRow
          label="Raise Regularization"
          checked={perms.regularization.raise}
          onChange={(v) => set(["regularization", "raise"], v)}
        />
        <PermRow
          label="Approve Regularization"
          desc="Default: OFF — only admin approves"
          checked={perms.regularization.approve}
          onChange={(v) => set(["regularization", "approve"], v)}
        />
      </TabsContent>
    </Tabs>
  );
}

export function UserManagement() {
  const { activeSites } = useAppContext();
  const { toasts, addToast, removeToast } = useToast();
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [permOpen, setPermOpen] = useState(false);
  const [selectedSup, setSelectedSup] = useState<Supervisor | null>(null);
  const [selectedPhone, setSelectedPhone] = useState("");
  const [editPerms, setEditPerms] = useState<SupervisorPermissions>(
    supervisorPermissionsStorage.DEFAULT_PERMISSIONS,
  );

  // Form fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [siteId, setSiteId] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const load = useCallback(() => {
    setSupervisors(workforceStorage.getSupervisors());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setName("");
    setPhone("");
    setUsername("");
    setPassword("");
    setPin("");
    setSiteId("");
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: resetForm is stable
  const handleAdd = useCallback(() => {
    if (!name.trim() || !phone.trim() || !siteId) {
      addToast("Name, phone, and site are required", "warning");
      return;
    }
    if (username.trim() && !password.trim()) {
      addToast("Set a password for the username login", "warning");
      return;
    }
    if (pin && (pin.length !== 4 || !/^\d+$/.test(pin))) {
      addToast("PIN must be exactly 4 digits", "warning");
      return;
    }
    const sup: Supervisor = {
      phone: phone.trim(),
      name: name.trim(),
      siteId,
      pin: pin || "0000",
      active: true,
      username: username.trim() || undefined,
      password: password.trim() || undefined,
      role: "supervisor",
    };
    const ok = workforceStorage.createSupervisor(sup);
    if (ok) {
      addToast(`User "${name}" created`, "success");
      setAddOpen(false);
      resetForm();
      load();
    } else {
      addToast("Phone or username already exists", "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, phone, username, password, pin, siteId, addToast, load]);

  const handleToggleActive = useCallback(
    (sup: Supervisor) => {
      workforceStorage.updateSupervisor(sup.phone, { active: !sup.active });
      addToast(`User ${sup.active ? "deactivated" : "activated"}`, "success");
      load();
    },
    [addToast, load],
  );

  const handleDelete = useCallback(
    (sup: Supervisor) => {
      if (!window.confirm(`Delete user "${sup.name}"? This cannot be undone.`))
        return;
      workforceStorage.deleteSupervisor(sup.phone);
      addToast("User deleted", "success");
      load();
    },
    [addToast, load],
  );

  const openResetPassword = useCallback((sup: Supervisor) => {
    setSelectedPhone(sup.phone);
    setNewPassword("");
    setResetOpen(true);
  }, []);

  const handleResetPassword = useCallback(() => {
    if (!newPassword.trim() || newPassword.length < 4) {
      addToast("Password must be at least 4 characters", "warning");
      return;
    }
    workforceStorage.resetSupervisorPassword(selectedPhone, newPassword.trim());
    addToast("Password updated", "success");
    setResetOpen(false);
    load();
  }, [selectedPhone, newPassword, addToast, load]);

  const openPermissions = useCallback((sup: Supervisor) => {
    setSelectedSup(sup);
    setEditPerms(
      supervisorPermissionsStorage.getPermissionsForSupervisor(sup.phone),
    );
    setPermOpen(true);
  }, []);

  const handleSavePermissions = useCallback(() => {
    if (!selectedSup) return;
    supervisorPermissionsStorage.savePermissionsForSupervisor(
      selectedSup.phone,
      editPerms,
    );
    workforceStorage.updateSupervisor(selectedSup.phone, {
      permissions: editPerms,
    });
    addToast("Permissions saved", "success");
    setPermOpen(false);
    load();
  }, [selectedSup, editPerms, addToast, load]);

  // Resolve site name for display
  const siteNameMap = Object.fromEntries(
    activeSites.map((s) => [s.id, s.name]),
  );

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">User Management</h2>
          <p className="text-sm text-gray-500">
            Create and manage supervisor and user accounts
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setAddOpen(true);
          }}
          data-ocid="users.primary_button"
        >
          <Plus className="w-4 h-4 mr-2" /> Add User
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {supervisors.length === 0 ? (
          <div className="py-16 text-center" data-ocid="users.empty_state">
            <ShieldCheck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No users created yet.</p>
            <p className="text-xs text-gray-400 mt-1">
              Click "Add User" to create a supervisor account.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Name
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Phone
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Username
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Site
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Role
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Status
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {supervisors.map((sup, idx) => (
                <tr
                  key={sup.phone}
                  className="hover:bg-gray-50"
                  data-ocid={`users.item.${idx + 1}`}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {sup.name}
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                    {sup.phone}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {sup.username ?? (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {siteNameMap[sup.siteId] ?? sup.siteId}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                      <ShieldCheck className="w-3 h-3" />{" "}
                      {sup.role ?? "supervisor"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {sup.active ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700">
                        <UserCheck className="w-3.5 h-3.5" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-red-500">
                        <UserX className="w-3.5 h-3.5" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => openPermissions(sup)}
                        title="Edit Permissions"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50"
                        data-ocid="users.edit_button"
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openResetPassword(sup)}
                        title="Reset Password"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(sup)}
                        title={sup.active ? "Deactivate" : "Activate"}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50"
                      >
                        {sup.active ? (
                          <UserX className="w-3.5 h-3.5" />
                        ) : (
                          <UserCheck className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(sup)}
                        title="Delete"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                        data-ocid="users.delete_button"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add User Dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => !o && setAddOpen(false)}>
        <DialogContent className="max-w-md" data-ocid="users.dialog">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Full Name *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rajesh Kumar"
                  className="mt-1"
                  data-ocid="users.input"
                />
              </div>
              <div>
                <Label>Phone *</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Mobile number"
                  type="tel"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Assigned Site *</Label>
                <select
                  value={siteId}
                  onChange={(e) => setSiteId(e.target.value)}
                  className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none"
                  data-ocid="users.select"
                >
                  <option value="">Select site</option>
                  {activeSites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                Credential Login (recommended)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Username</Label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. rajesh.kumar"
                    className="mt-1"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 4 chars"
                    className="mt-1"
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                PIN Login (fallback)
              </p>
              <div>
                <Label>4-Digit PIN</Label>
                <Input
                  value={pin}
                  onChange={(e) =>
                    setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  placeholder="e.g. 1234"
                  maxLength={4}
                  className="mt-1 w-32"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setAddOpen(false)}
                data-ocid="users.cancel_button"
              >
                Cancel
              </Button>
              <Button onClick={handleAdd} data-ocid="users.submit_button">
                Create User
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={(o) => !o && setResetOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="mt-1"
                autoComplete="new-password"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setResetOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleResetPassword}>Update Password</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      <Dialog open={permOpen} onOpenChange={(o) => !o && setPermOpen(false)}>
        <DialogContent className="max-w-lg" data-ocid="users.modal">
          <DialogHeader>
            <DialogTitle>Permissions for {selectedSup?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-xs text-gray-500 mb-4">
              Configure what this supervisor can view and edit. These settings
              override global defaults.
            </p>
            <PermissionEditor perms={editPerms} onChange={setEditPerms} />
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <Button
              variant="outline"
              onClick={() => setPermOpen(false)}
              data-ocid="users.cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePermissions}
              data-ocid="users.save_button"
            >
              Save Permissions
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
