import { Link, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  Building2,
  CheckCircle2,
  Eye,
  KeyRound,
  Loader2,
  LogOut,
  PauseCircle,
  Plus,
  Search,
  Settings,
  Shield,
  Upload,
  X,
  XCircle,
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
  canisterCreateCompany,
  canisterGetCompanies,
  canisterGetTenantSummary,
  canisterResetCompanyPassword,
  canisterUpdateCompany,
  canisterUpdateCompanyStatus,
  migrateLocalCompaniesToCanister,
} from "../../services/canisterCompanyService";
import {
  ALL_MODULES,
  MODULE_LABELS,
  clearSuperAdminSession,
  getCompanies,
  getSuperAdminSession,
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

function PlanBadge({ plan }: { plan: Company["planStatus"] }) {
  if (plan === "active")
    return (
      <Badge className="bg-violet-900/60 text-violet-300 border-violet-700/50">
        Paid
      </Badge>
    );
  if (plan === "trial")
    return (
      <Badge className="bg-sky-900/60 text-sky-300 border-sky-700/50">
        Trial
      </Badge>
    );
  return (
    <Badge className="bg-slate-700 text-slate-400 border-slate-600">
      Inactive
    </Badge>
  );
}

type TenantSummary = {
  employeeCount: number;
  attendanceCount: number;
  payrollCount: number;
  status: string;
  plan: string;
  modules: string[];
  createdAt: number;
  updatedAt: number;
};

export function Companies() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showWizard, setShowWizard] = useState(false);

  // Edit panel
  const [editTarget, setEditTarget] = useState<Company | null>(null);
  const [editForm, setEditForm] = useState<Partial<Company>>({
    companyName: "",
    brandName: "",
    legalName: "",
    address: "",
    state: "",
    country: "",
    logoDataUrl: "",
    moduleAccess: [...ALL_MODULES],
    planStatus: "trial",
    status: "active",
    adminUsername: "",
    notes: "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  // Reset password dialog
  const [resetTarget, setResetTarget] = useState<Company | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [resetPwConfirm, setResetPwConfirm] = useState("");
  const [resetSaving, setResetSaving] = useState(false);

  // Tenant summary dialog
  const [summaryTarget, setSummaryTarget] = useState<Company | null>(null);
  const [summaryData, setSummaryData] = useState<TenantSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    const session = getSuperAdminSession();
    if (!session) {
      navigate({ to: "/superadmin/login" });
      return;
    }
    setLoading(true);
    const localCompanies = getCompanies();
    migrateLocalCompaniesToCanister(localCompanies)
      .then(() => canisterGetCompanies())
      .then((list) => {
        setCompanies(list.length > 0 ? list : localCompanies);
        setLoading(false);
      })
      .catch(() => {
        setCompanies(localCompanies);
        setLoading(false);
      });
  }, [navigate]);

  const refreshCompanies = useCallback(async () => {
    try {
      const list = await canisterGetCompanies();
      if (list.length > 0) setCompanies(list);
    } catch {
      // silent
    }
  }, []);

  const openEdit = (company: Company) => {
    setEditTarget(company);
    setEditForm({
      companyName: company.companyName,
      brandName: company.brandName,
      legalName: company.legalName,
      address: company.address,
      state: company.state,
      country: company.country || "India",
      logoDataUrl: company.logoDataUrl,
      moduleAccess: company.moduleAccess || [...ALL_MODULES],
      planStatus: company.planStatus,
      status: company.status,
      adminUsername: company.adminUsername,
      notes: company.notes || "",
    });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setEditForm((prev) => ({
        ...prev,
        logoDataUrl: reader.result as string,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    setEditSaving(true);
    try {
      await canisterUpdateCompany(editTarget.id, editForm, editTarget);
      toast.success("Company updated successfully");
      setEditTarget(null);
      await refreshCompanies();
    } catch {
      toast.error("Failed to save company");
    } finally {
      setEditSaving(false);
    }
  };

  const handleStatusChange = async (
    company: Company,
    newStatus: Company["status"],
  ) => {
    try {
      await canisterUpdateCompanyStatus(company.id, newStatus);
      toast.success(
        `Company ${newStatus === "active" ? "activated" : newStatus === "suspended" ? "suspended" : "deactivated"} successfully`,
      );
      await refreshCompanies();
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    if (!resetPw || resetPw.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (resetPw !== resetPwConfirm) {
      toast.error("Passwords do not match");
      return;
    }
    setResetSaving(true);
    try {
      await canisterResetCompanyPassword(resetTarget.id, resetPw);
      toast.success("Password reset successfully");
      setResetTarget(null);
      setResetPw("");
      setResetPwConfirm("");
    } catch {
      toast.error("Failed to reset password");
    } finally {
      setResetSaving(false);
    }
  };

  const handleViewSummary = async (company: Company) => {
    setSummaryTarget(company);
    setSummaryData(null);
    setSummaryLoading(true);
    try {
      const data = await canisterGetTenantSummary(company.companyCode);
      setSummaryData(data as TenantSummary);
    } catch {
      setSummaryData(null);
    } finally {
      setSummaryLoading(false);
    }
  };

  const toggleModule = (mod: string) => {
    const current = editForm.moduleAccess || [];
    if (current.includes(mod)) {
      setEditForm((prev) => ({
        ...prev,
        moduleAccess: current.filter((m) => m !== mod),
      }));
    } else {
      setEditForm((prev) => ({
        ...prev,
        moduleAccess: [...current, mod],
      }));
    }
  };

  const handleLogout = () => {
    clearSuperAdminSession();
    navigate({ to: "/superadmin/login" });
  };

  const filtered = companies.filter(
    (c) =>
      !search ||
      c.companyName.toLowerCase().includes(search.toLowerCase()) ||
      c.companyCode.toLowerCase().includes(search.toLowerCase()) ||
      (c.brandName || "").toLowerCase().includes(search.toLowerCase()),
  );

  if (showWizard) {
    return (
      <CompanyOnboardingWizard
        onClose={() => setShowWizard(false)}
        onCreated={async () => {
          await refreshCompanies();
          setShowWizard(false);
        }}
      />
    );
  }

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
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="text-white font-bold text-sm">HumanskeyAI</span>
              <span className="text-slate-400 text-xs ml-2">Super Admin</span>
            </div>
          </div>
          <nav className="flex items-center gap-1">
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
            <Link to="/superadmin/settings">
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-300 hover:text-white"
              >
                <Settings className="w-4 h-4 mr-1" /> Settings
              </Button>
            </Link>
            <Link to="/superadmin/change-password">
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-300 hover:text-white"
              >
                <KeyRound className="w-4 h-4 mr-1" /> Password
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
              {companies.length} tenant{companies.length !== 1 ? "s" : ""}{" "}
              registered on platform
            </p>
          </div>
          <Button
            onClick={() => setShowWizard(true)}
            className="bg-blue-600 hover:bg-blue-700"
            data-ocid="companies.open_modal_button"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Company
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by name, code, or brand…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500"
            data-ocid="companies.search_input"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Loading companies from canister…
          </div>
        ) : (
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            {filtered.length === 0 ? (
              <div
                className="px-5 py-12 text-center text-slate-500"
                data-ocid="companies.empty_state"
              >
                {search
                  ? "No companies match your search."
                  : "No companies yet. Create one to get started."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-ocid="companies.table">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-900/40">
                      <th className="px-4 py-3 text-left text-slate-400 font-medium">
                        Code
                      </th>
                      <th className="px-4 py-3 text-left text-slate-400 font-medium">
                        Company
                      </th>
                      <th className="px-4 py-3 text-left text-slate-400 font-medium">
                        Brand
                      </th>
                      <th className="px-4 py-3 text-left text-slate-400 font-medium">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-slate-400 font-medium">
                        Plan
                      </th>
                      <th className="px-4 py-3 text-left text-slate-400 font-medium">
                        Admin
                      </th>
                      <th className="px-4 py-3 text-left text-slate-400 font-medium">
                        Created
                      </th>
                      <th className="px-4 py-3 text-left text-slate-400 font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((company, idx) => (
                      <tr
                        key={company.id}
                        className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors"
                        data-ocid={`companies.item.${idx + 1}`}
                      >
                        <td className="px-4 py-3">
                          <Badge className="bg-blue-900/60 text-blue-300 border-blue-700/50 font-mono">
                            {company.companyCode}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {company.logoDataUrl ? (
                              <img
                                src={company.logoDataUrl}
                                alt="logo"
                                className="w-6 h-6 rounded object-contain bg-slate-700"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded bg-blue-700 flex items-center justify-center flex-shrink-0">
                                <span className="text-white text-xs font-bold">
                                  {(company.companyName || "?")
                                    .slice(0, 2)
                                    .toUpperCase()}
                                </span>
                              </div>
                            )}
                            <span className="text-white font-medium">
                              {company.companyName}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {company.brandName || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={company.status} />
                        </td>
                        <td className="px-4 py-3">
                          <PlanBadge plan={company.planStatus} />
                        </td>
                        <td className="px-4 py-3 text-slate-300 text-xs">
                          {company.adminUsername}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">
                          {new Date(company.createdAt).toLocaleDateString(
                            "en-IN",
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 flex-wrap">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-blue-400 hover:text-blue-300 hover:bg-blue-900/30"
                              onClick={() => openEdit(company)}
                              data-ocid={`companies.edit_button.${idx + 1}`}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700"
                              onClick={() => handleViewSummary(company)}
                              data-ocid={`companies.secondary_button.${idx + 1}`}
                            >
                              <Eye className="w-3 h-3 mr-1" /> Summary
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-900/20"
                              onClick={() => setResetTarget(company)}
                              data-ocid={`companies.delete_button.${idx + 1}`}
                            >
                              <KeyRound className="w-3 h-3 mr-1" /> Reset PW
                            </Button>
                            {company.status !== "active" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/20"
                                onClick={() =>
                                  handleStatusChange(company, "active")
                                }
                              >
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Activate
                              </Button>
                            )}
                            {company.status !== "suspended" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-orange-400 hover:text-orange-300 hover:bg-orange-900/20"
                                onClick={() =>
                                  handleStatusChange(company, "suspended")
                                }
                              >
                                <PauseCircle className="w-3 h-3 mr-1" />
                                Suspend
                              </Button>
                            )}
                            {company.status !== "inactive" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                onClick={() =>
                                  handleStatusChange(company, "inactive")
                                }
                              >
                                <XCircle className="w-3 h-3 mr-1" />
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
        )}
      </main>

      {/* ======= EDIT COMPANY DIALOG ======= */}
      <Dialog
        open={!!editTarget}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
      >
        <DialogContent
          className="max-w-2xl bg-slate-900 border-slate-700 text-white max-h-[90vh] overflow-y-auto"
          data-ocid="companies.dialog"
        >
          <DialogHeader>
            <DialogTitle className="text-white text-lg">
              Edit Company — {editTarget?.companyCode}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 mt-2">
            {/* Identity */}
            <div className="bg-slate-800 rounded-lg p-4 space-y-4">
              <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">
                Company Identity
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-300 text-xs">Company Name</Label>
                  <Input
                    value={editForm.companyName || ""}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        companyName: e.target.value,
                      }))
                    }
                    className="mt-1 bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-300 text-xs">Brand Name</Label>
                  <Input
                    value={editForm.brandName || ""}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, brandName: e.target.value }))
                    }
                    className="mt-1 bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-slate-300 text-xs">Legal Name</Label>
                  <Input
                    value={editForm.legalName || ""}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, legalName: e.target.value }))
                    }
                    className="mt-1 bg-slate-700 border-slate-600 text-white"
                  />
                </div>
              </div>
            </div>

            {/* Logo */}
            <div className="bg-slate-800 rounded-lg p-4">
              <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold mb-3">
                Company Logo
              </p>
              <div className="flex items-center gap-4">
                {editForm.logoDataUrl ? (
                  <div className="relative">
                    <img
                      src={editForm.logoDataUrl}
                      alt="logo"
                      className="w-16 h-16 rounded-lg object-contain bg-slate-700 border border-slate-600"
                    />
                    <button
                      type="button"
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center"
                      onClick={() =>
                        setEditForm((p) => ({ ...p, logoDataUrl: "" }))
                      }
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-slate-700 border border-slate-600 border-dashed flex items-center justify-center">
                    <Upload className="w-5 h-5 text-slate-500" />
                  </div>
                )}
                <div>
                  <input
                    ref={logoRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                    onClick={() => logoRef.current?.click()}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1" />{" "}
                    {editForm.logoDataUrl ? "Change Logo" : "Upload Logo"}
                  </Button>
                  {editForm.logoDataUrl && (
                    <p className="text-slate-500 text-xs mt-1">
                      Logo will be saved to canister and visible cross-browser
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="bg-slate-800 rounded-lg p-4 space-y-3">
              <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">
                Location
              </p>
              <div>
                <Label className="text-slate-300 text-xs">Address</Label>
                <Input
                  value={editForm.address || ""}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, address: e.target.value }))
                  }
                  className="mt-1 bg-slate-700 border-slate-600 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-300 text-xs">State</Label>
                  <Input
                    value={editForm.state || ""}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, state: e.target.value }))
                    }
                    className="mt-1 bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-300 text-xs">Country</Label>
                  <Input
                    value={editForm.country || "India"}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, country: e.target.value }))
                    }
                    className="mt-1 bg-slate-700 border-slate-600 text-white"
                  />
                </div>
              </div>
            </div>

            {/* Module Access */}
            <div className="bg-slate-800 rounded-lg p-4">
              <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold mb-3">
                Module Access
              </p>
              <div className="grid grid-cols-2 gap-2">
                {ALL_MODULES.map((mod) => (
                  <div
                    key={mod}
                    className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors"
                  >
                    <Checkbox
                      checked={(editForm.moduleAccess || []).includes(mod)}
                      onCheckedChange={() => toggleModule(mod)}
                      className="border-slate-500"
                    />
                    <span className="text-slate-300 text-sm">
                      {MODULE_LABELS[mod] || mod}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Plan & Status */}
            <div className="bg-slate-800 rounded-lg p-4 space-y-3">
              <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">
                Plan & Status
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-300 text-xs">Plan Status</Label>
                  <select
                    value={editForm.planStatus || "trial"}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        planStatus: e.target.value as Company["planStatus"],
                      }))
                    }
                    className="mt-1 w-full bg-slate-700 border border-slate-600 rounded-md text-white text-sm px-3 py-2"
                  >
                    <option value="trial">Trial</option>
                    <option value="active">Paid / Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <Label className="text-slate-300 text-xs">
                    Account Status
                  </Label>
                  <select
                    value={editForm.status || "active"}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        status: e.target.value as Company["status"],
                      }))
                    }
                    className="mt-1 w-full bg-slate-700 border border-slate-600 rounded-md text-white text-sm px-3 py-2"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Admin */}
            <div className="bg-slate-800 rounded-lg p-4">
              <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold mb-3">
                Admin Credentials
              </p>
              <div>
                <Label className="text-slate-300 text-xs">
                  Primary Admin Username
                </Label>
                <Input
                  value={editForm.adminUsername || ""}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      adminUsername: e.target.value,
                    }))
                  }
                  className="mt-1 bg-slate-700 border-slate-600 text-white"
                />
                <p className="text-slate-500 text-xs mt-1">
                  To reset password, use the Reset Password action on the
                  company row.
                </p>
              </div>
            </div>

            {/* Notes */}
            <div className="bg-slate-800 rounded-lg p-4">
              <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold mb-2">
                Internal Notes / Remarks
              </p>
              <Textarea
                value={editForm.notes || ""}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, notes: e.target.value }))
                }
                placeholder="Internal notes visible only to Super Admin…"
                className="bg-slate-700 border-slate-600 text-white placeholder-slate-500 resize-none"
                rows={3}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setEditTarget(null)}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
                data-ocid="companies.cancel_button"
              >
                Cancel
              </Button>
              <Button
                onClick={handleEditSave}
                disabled={editSaving}
                className="bg-blue-600 hover:bg-blue-700"
                data-ocid="companies.save_button"
              >
                {editSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                {editSaving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ======= RESET PASSWORD DIALOG ======= */}
      <Dialog
        open={!!resetTarget}
        onOpenChange={(open) => {
          if (!open) {
            setResetTarget(null);
            setResetPw("");
            setResetPwConfirm("");
          }
        }}
      >
        <DialogContent
          className="max-w-sm bg-slate-900 border-slate-700 text-white"
          data-ocid="companies.modal"
        >
          <DialogHeader>
            <DialogTitle className="text-white">
              Reset Admin Password
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-slate-400 text-sm">
              Company:{" "}
              <span className="text-white font-medium">
                {resetTarget?.companyCode}
              </span>{" "}
              — Admin:{" "}
              <span className="text-white">{resetTarget?.adminUsername}</span>
            </p>
            <div>
              <Label className="text-slate-300 text-xs">New Password</Label>
              <Input
                type="password"
                value={resetPw}
                onChange={(e) => setResetPw(e.target.value)}
                placeholder="Min 6 characters"
                className="mt-1 bg-slate-700 border-slate-600 text-white"
                data-ocid="companies.input"
              />
            </div>
            <div>
              <Label className="text-slate-300 text-xs">Confirm Password</Label>
              <Input
                type="password"
                value={resetPwConfirm}
                onChange={(e) => setResetPwConfirm(e.target.value)}
                placeholder="Confirm new password"
                className="mt-1 bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setResetTarget(null)}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
                data-ocid="companies.cancel_button"
              >
                Cancel
              </Button>
              <Button
                onClick={handleResetPassword}
                disabled={resetSaving}
                className="bg-orange-600 hover:bg-orange-700"
                data-ocid="companies.confirm_button"
              >
                {resetSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                {resetSaving ? "Resetting…" : "Reset Password"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ======= TENANT SUMMARY DIALOG ======= */}
      <Dialog
        open={!!summaryTarget}
        onOpenChange={(open) => {
          if (!open) setSummaryTarget(null);
        }}
      >
        <DialogContent
          className="max-w-md bg-slate-900 border-slate-700 text-white"
          data-ocid="companies.panel"
        >
          <DialogHeader>
            <DialogTitle className="text-white">
              Tenant Summary — {summaryTarget?.companyCode}
            </DialogTitle>
          </DialogHeader>
          {summaryLoading ? (
            <div
              className="py-10 flex items-center justify-center text-slate-400"
              data-ocid="companies.loading_state"
            >
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading tenant data…
            </div>
          ) : summaryData ? (
            <div className="space-y-3 mt-2">
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: "Employees",
                    value: summaryData.employeeCount,
                    icon: "👥",
                  },
                  {
                    label: "Attendance Records",
                    value: summaryData.attendanceCount,
                    icon: "📋",
                  },
                  {
                    label: "Payroll Runs",
                    value: summaryData.payrollCount,
                    icon: "💰",
                  },
                  {
                    label: "Modules Enabled",
                    value: summaryData.modules?.length ?? "—",
                    icon: "🔧",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="bg-slate-800 rounded-lg p-3 text-center"
                  >
                    <p className="text-xl">{item.icon}</p>
                    <p className="text-white font-bold text-lg mt-1">
                      {item.value}
                    </p>
                    <p className="text-slate-400 text-xs">{item.label}</p>
                  </div>
                ))}
              </div>
              <div className="bg-slate-800 rounded-lg p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Status</span>
                  <StatusBadge
                    status={
                      (summaryData.status as Company["status"]) || "active"
                    }
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Plan</span>
                  <PlanBadge
                    plan={
                      (summaryData.plan as Company["planStatus"]) || "trial"
                    }
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Created</span>
                  <span className="text-white text-xs">
                    {summaryData.createdAt
                      ? new Date(summaryData.createdAt).toLocaleDateString(
                          "en-IN",
                        )
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Last Updated</span>
                  <span className="text-white text-xs">
                    {summaryData.updatedAt
                      ? new Date(summaryData.updatedAt).toLocaleDateString(
                          "en-IN",
                        )
                      : "—"}
                  </span>
                </div>
              </div>
              {summaryData.modules && summaryData.modules.length > 0 && (
                <div className="bg-slate-800 rounded-lg p-3">
                  <p className="text-slate-400 text-xs mb-2">Active Modules</p>
                  <div className="flex flex-wrap gap-1">
                    {summaryData.modules.map((mod) => (
                      <Badge
                        key={mod}
                        className="bg-blue-900/50 text-blue-300 border-blue-700/40 text-xs"
                      >
                        {MODULE_LABELS[mod] || mod}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              className="py-8 text-center text-slate-500 text-sm"
              data-ocid="companies.error_state"
            >
              Could not load tenant summary. The tenant may have no data yet.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
