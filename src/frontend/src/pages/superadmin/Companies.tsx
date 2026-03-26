import { Link, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  Building2,
  Check,
  Edit2,
  LogOut,
  Plus,
  Search,
  Upload,
  X,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import {
  ALL_MODULES,
  MODULE_LABELS,
  clearSuperAdminSession,
  getCompanies,
  getSuperAdminSession,
  updateCompany,
} from "../../services/tenantStorage";
import type { Company } from "../../services/tenantStorage";
import { CompanyOnboardingWizard } from "./CompanyOnboardingWizard";

function StatusBadge({ status }: { status: Company["status"] }) {
  if (status === "active")
    return (
      <Badge className="bg-emerald-900/60 text-emerald-300 border-emerald-700/50">
        Active
      </Badge>
    );
  if (status === "suspended")
    return (
      <Badge className="bg-orange-900/60 text-orange-300 border-orange-700/50">
        Suspended
      </Badge>
    );
  return (
    <Badge className="bg-slate-700 text-slate-400 border-slate-600">
      Inactive
    </Badge>
  );
}

export function Companies() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState("");
  const [showWizard, setShowWizard] = useState(false);
  const [editTarget, setEditTarget] = useState<Company | null>(null);
  const [editForm, setEditForm] = useState<
    Partial<Company> & { confirmPassword?: string }
  >({
    confirmPassword: "",
  });
  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const session = getSuperAdminSession();
    if (!session) {
      navigate({ to: "/superadmin/login" });
      return;
    }
    setCompanies(getCompanies());
  }, [navigate]);

  const refreshCompanies = useCallback(() => setCompanies(getCompanies()), []);

  const handleLogout = () => {
    clearSuperAdminSession();
    navigate({ to: "/superadmin/login" });
  };

  const openEdit = (c: Company) => {
    setEditForm({
      companyName: c.companyName,
      legalName: c.legalName || "",
      brandName: c.brandName || "",
      address: c.address || "",
      state: c.state || "",
      country: c.country || "India",
      moduleAccess: c.moduleAccess || [...ALL_MODULES],
      adminUsername: c.adminUsername,
      adminPassword: c.adminPassword,
      confirmPassword: "",
      logoDataUrl: c.logoDataUrl || "",
      planStatus: c.planStatus,
    });
    setEditTarget(c);
  };

  const handleEditSave = () => {
    if (!editTarget) return;
    if (!editForm.companyName?.trim()) {
      toast.error("Company name is required");
      return;
    }
    if (
      editForm.adminPassword &&
      editForm.adminPassword !== editForm.confirmPassword
    ) {
      toast.error("Passwords do not match");
      return;
    }
    updateCompany(editTarget.id, {
      companyName: editForm.companyName,
      legalName: editForm.legalName,
      brandName: editForm.brandName || editForm.companyName,
      address: editForm.address,
      state: editForm.state,
      country: editForm.country,
      moduleAccess: editForm.moduleAccess,
      adminUsername: editForm.adminUsername,
      adminPassword: editForm.adminPassword,
      logoDataUrl: editForm.logoDataUrl,
      planStatus: editForm.planStatus,
    });
    toast.success("Company updated");
    setEditTarget(null);
    refreshCompanies();
  };

  const handleStatusChange = (
    c: Company,
    newStatus: "active" | "suspended" | "inactive",
  ) => {
    updateCompany(c.id, { status: newStatus });
    const labels: Record<string, string> = {
      active: "activated",
      suspended: "suspended",
      inactive: "deactivated",
    };
    toast.success(`Company ${labels[newStatus]}`);
    refreshCompanies();
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result)
        setEditForm((f) => ({
          ...f,
          logoDataUrl: ev.target!.result as string,
        }));
    };
    reader.readAsDataURL(file);
  };

  const toggleEditModule = (mod: string) => {
    setEditForm((f) => ({
      ...f,
      moduleAccess: (f.moduleAccess || []).includes(mod)
        ? (f.moduleAccess || []).filter((m) => m !== mod)
        : [...(f.moduleAccess || []), mod],
    }));
  };

  const filtered = companies.filter(
    (c) =>
      c.companyName.toLowerCase().includes(search.toLowerCase()) ||
      c.companyCode.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(180deg, #0B1220 0%, #0F1B2D 100%)",
      }}
    >
      {/* Top nav */}
      <header className="border-b border-slate-700 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">HKAI</span>
            </div>
            <div>
              <span className="text-white font-bold text-sm">HumanskeyAI</span>
              <span className="text-slate-400 text-xs ml-2">
                Platform Admin
              </span>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            <Link to="/superadmin/dashboard">
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-300 hover:text-white"
              >
                <Activity className="w-4 h-4 mr-1" /> Dashboard
              </Button>
            </Link>
            <Link to="/superadmin/companies">
              <Button variant="ghost" size="sm" className="text-blue-400">
                <Building2 className="w-4 h-4 mr-1" /> Companies
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-slate-400 hover:text-red-400"
            >
              <LogOut className="w-4 h-4 mr-1" /> Logout
            </Button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Companies</h1>
            <p className="text-slate-400 text-sm mt-1">
              Manage tenant companies on HumanskeyAI
            </p>
          </div>
          <Button
            data-ocid="companies.open_modal_button"
            onClick={() => setShowWizard(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" /> Onboard Company
          </Button>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700">
            <div className="relative max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                data-ocid="companies.search_input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search companies..."
                className="pl-9 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div
              data-ocid="companies.empty_state"
              className="px-5 py-8 text-center text-slate-500"
            >
              {search
                ? "No companies match your search."
                : "No companies registered yet."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="px-5 py-3 text-left text-slate-400 font-medium">
                      Code
                    </th>
                    <th className="px-5 py-3 text-left text-slate-400 font-medium">
                      Brand / Name
                    </th>
                    <th className="px-5 py-3 text-left text-slate-400 font-medium">
                      Legal Name
                    </th>
                    <th className="px-5 py-3 text-left text-slate-400 font-medium">
                      Location
                    </th>
                    <th className="px-5 py-3 text-left text-slate-400 font-medium">
                      Admin
                    </th>
                    <th className="px-5 py-3 text-left text-slate-400 font-medium">
                      Plan
                    </th>
                    <th className="px-5 py-3 text-left text-slate-400 font-medium">
                      Status
                    </th>
                    <th className="px-5 py-3 text-left text-slate-400 font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => (
                    <tr
                      key={c.id}
                      data-ocid={`companies.item.${i + 1}`}
                      className="border-b border-slate-700/50 hover:bg-slate-700/20"
                    >
                      <td className="px-5 py-3">
                        <Badge className="bg-blue-900/60 text-blue-300 border-blue-700/50 font-mono">
                          {c.companyCode}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {c.logoDataUrl ? (
                            <img
                              src={c.logoDataUrl}
                              alt="logo"
                              className="w-7 h-7 rounded object-contain border border-slate-600"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded bg-blue-700 flex items-center justify-center text-white text-xs font-bold">
                              {(c.brandName || c.companyName)
                                .slice(0, 2)
                                .toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="text-white font-medium leading-none">
                              {c.brandName || c.companyName}
                            </p>
                            {c.brandName && c.brandName !== c.companyName && (
                              <p className="text-slate-500 text-xs mt-0.5">
                                {c.companyName}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-400 text-xs max-w-[160px] truncate">
                        {c.legalName || "—"}
                      </td>
                      <td className="px-5 py-3 text-slate-400 text-xs">
                        {[c.state, c.country].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="px-5 py-3 text-slate-300">
                        {c.adminUsername}
                      </td>
                      <td className="px-5 py-3">
                        <Badge
                          className={
                            c.planStatus === "active"
                              ? "bg-emerald-900/60 text-emerald-300 border-emerald-700/50"
                              : "bg-slate-700 text-slate-400"
                          }
                        >
                          {c.planStatus}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            data-ocid={`companies.edit_button.${i + 1}`}
                            onClick={() => openEdit(c)}
                            className="text-slate-400 hover:text-white h-7 px-2"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          {c.status !== "active" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleStatusChange(c, "active")}
                              className="text-emerald-400 hover:text-emerald-300 h-7 px-2 text-xs"
                            >
                              <Check className="w-3 h-3 mr-0.5" /> Activate
                            </Button>
                          )}
                          {c.status !== "suspended" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleStatusChange(c, "suspended")}
                              className="text-orange-400 hover:text-orange-300 h-7 px-2 text-xs"
                            >
                              Suspend
                            </Button>
                          )}
                          {c.status !== "inactive" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleStatusChange(c, "inactive")}
                              className="text-red-400 hover:text-red-300 h-7 px-2 text-xs"
                            >
                              Deactivate
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Onboarding Wizard */}
      {showWizard && (
        <CompanyOnboardingWizard
          onClose={() => setShowWizard(false)}
          onCreated={() => {
            setShowWizard(false);
            refreshCompanies();
          }}
        />
      )}

      {/* Edit Dialog */}
      <Dialog
        open={!!editTarget}
        onOpenChange={(o) => !o && setEditTarget(null)}
      >
        <DialogContent
          data-ocid="companies.dialog"
          className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[85vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle className="text-white">
              Edit Company —{" "}
              <span className="text-blue-400 font-mono">
                {editTarget?.companyCode}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-300">Company Name *</Label>
                <Input
                  value={editForm.companyName || ""}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, companyName: e.target.value }))
                  }
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">Brand Name</Label>
                <Input
                  value={editForm.brandName || ""}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, brandName: e.target.value }))
                  }
                  placeholder="Short display name"
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Legal Name</Label>
              <Input
                value={editForm.legalName || ""}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, legalName: e.target.value }))
                }
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>

            {/* Logo upload */}
            <div className="space-y-2">
              <Label className="text-slate-300">Logo</Label>
              <div className="flex items-center gap-3">
                {editForm.logoDataUrl ? (
                  <div className="relative">
                    <img
                      src={editForm.logoDataUrl}
                      alt="logo"
                      className="w-14 h-14 rounded-lg object-contain border border-slate-600 bg-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setEditForm((f) => ({ ...f, logoDataUrl: "" }))
                      }
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"
                    >
                      <X className="w-2.5 h-2.5 text-white" />
                    </button>
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-lg border-2 border-dashed border-slate-600 flex items-center justify-center bg-slate-900">
                    <Building2 className="w-6 h-6 text-slate-500" />
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => logoRef.current?.click()}
                  className="border-slate-600 text-slate-300 hover:text-white"
                >
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                  Upload Logo
                </Button>
                <input
                  ref={logoRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-300">Address</Label>
              <Textarea
                value={editForm.address || ""}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, address: e.target.value }))
                }
                rows={2}
                className="bg-slate-700 border-slate-600 text-white resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-300">State</Label>
                <Input
                  value={editForm.state || ""}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, state: e.target.value }))
                  }
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">Country</Label>
                <Input
                  value={editForm.country || ""}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, country: e.target.value }))
                  }
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
            </div>

            {/* Module access */}
            <div className="space-y-2">
              <Label className="text-slate-300">Module Access</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {ALL_MODULES.map((mod) => (
                  <div
                    key={mod}
                    className="flex items-center gap-2 p-2 rounded-lg bg-slate-700 border border-slate-600 cursor-pointer hover:border-slate-500"
                    onClick={() => toggleEditModule(mod)}
                    onKeyDown={(e) =>
                      (e.key === "Enter" || e.key === " ") &&
                      toggleEditModule(mod)
                    }
                  >
                    <Checkbox
                      checked={(editForm.moduleAccess || []).includes(mod)}
                      onCheckedChange={() => toggleEditModule(mod)}
                      className="border-slate-500"
                    />
                    <span className="text-slate-300 text-xs">
                      {MODULE_LABELS[mod]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-300">Admin Username</Label>
                <Input
                  value={editForm.adminUsername || ""}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      adminUsername: e.target.value,
                    }))
                  }
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">New Password</Label>
                <Input
                  type="password"
                  value={editForm.adminPassword || ""}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      adminPassword: e.target.value,
                    }))
                  }
                  placeholder="Leave blank to keep"
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">Confirm Password</Label>
                <Input
                  type="password"
                  value={editForm.confirmPassword || ""}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      confirmPassword: e.target.value,
                    }))
                  }
                  placeholder="Re-enter"
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-300">Plan Status</Label>
              <select
                value={editForm.planStatus || "trial"}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    planStatus: e.target.value as Company["planStatus"],
                  }))
                }
                className="w-full h-10 px-3 rounded-md bg-slate-700 border border-slate-600 text-white text-sm"
              >
                <option value="trial">Trial</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                data-ocid="companies.cancel_button"
                variant="ghost"
                onClick={() => setEditTarget(null)}
                className="text-slate-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                data-ocid="companies.save_button"
                onClick={handleEditSave}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Update Company
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
