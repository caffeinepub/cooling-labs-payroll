import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Upload,
  X,
} from "lucide-react";
import type React from "react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { canisterCreateCompany } from "../../services/canisterCompanyService";
import {
  ALL_MODULES,
  MODULE_LABELS,
  createCompany,
  getCompanies,
} from "../../services/tenantStorage";

interface WizardForm {
  companyCode: string;
  companyName: string;
  legalName: string;
  brandName: string;
  logoDataUrl: string;
  address: string;
  state: string;
  country: string;
  moduleAccess: string[];
  adminUsername: string;
  adminPassword: string;
  confirmPassword: string;
  planStatus: "trial" | "active" | "inactive";
}

const EMPTY_FORM: WizardForm = {
  companyCode: "",
  companyName: "",
  legalName: "",
  brandName: "",
  logoDataUrl: "",
  address: "",
  state: "",
  country: "India",
  moduleAccess: [...ALL_MODULES],
  adminUsername: "",
  adminPassword: "",
  confirmPassword: "",
  planStatus: "trial",
};

const STEPS = [
  "Company Identity",
  "Location & Branding",
  "Module Access",
  "Admin & Review",
];

export function CompanyOnboardingWizard({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WizardForm>({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (field: keyof WizardForm, value: string | string[]) =>
    setForm((f) => ({ ...f, [field]: value }));

  const validateStep = (s: number): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (s === 0) {
      if (!form.companyCode.trim()) errs.companyCode = "Required";
      else if (!/^[A-Z0-9]+$/.test(form.companyCode))
        errs.companyCode = "Uppercase alphanumeric only";
      else {
        const existing = getCompanies();
        if (
          existing.some(
            (c) =>
              c.companyCode.toUpperCase() === form.companyCode.toUpperCase(),
          )
        )
          errs.companyCode = "Company code already exists";
      }
      if (!form.companyName.trim()) errs.companyName = "Required";
    }
    if (s === 3) {
      if (!form.adminUsername.trim()) errs.adminUsername = "Required";
      if (!form.adminPassword.trim()) errs.adminPassword = "Required";
      else if (form.adminPassword.length < 6)
        errs.adminPassword = "Minimum 6 characters";
      if (form.adminPassword !== form.confirmPassword)
        errs.confirmPassword = "Passwords do not match";
    }
    return errs;
  };

  const handleNext = () => {
    const errs = validateStep(step);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    setErrors({});
    setStep((s) => s - 1);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) set("logoDataUrl", ev.target.result as string);
    };
    reader.readAsDataURL(file);
  };

  const toggleModule = (mod: string) => {
    setForm((f) => ({
      ...f,
      moduleAccess: f.moduleAccess.includes(mod)
        ? f.moduleAccess.filter((m) => m !== mod)
        : [...f.moduleAccess, mod],
    }));
  };

  const handleCreate = async () => {
    const errs = validateStep(3);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setCreating(true);
    try {
      const companyData = {
        companyCode: form.companyCode.toUpperCase(),
        companyName: form.companyName,
        legalName: form.legalName,
        brandName: form.brandName || form.companyName,
        logoDataUrl: form.logoDataUrl,
        address: form.address,
        state: form.state,
        country: form.country || "India",
        moduleAccess: form.moduleAccess,
        status: "active" as const,
        adminUsername: form.adminUsername,
        adminPassword: form.adminPassword,
        planStatus: form.planStatus,
      };
      createCompany(companyData);
      await canisterCreateCompany(companyData);
      toast.success(`Company ${form.companyCode} created successfully`);
      onCreated();
    } catch (_e) {
      toast.error("Failed to create company");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(7,13,24,0.85)" }}
      data-ocid="company_wizard.modal"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl mx-4 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-700 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-5 h-5 text-blue-400" />
              <h2 className="text-white font-bold text-lg">
                New Company Onboarding
              </h2>
            </div>
            <p className="text-slate-400 text-sm">
              Step {step + 1} of {STEPS.length} — {STEPS[step]}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-ocid="company_wizard.close_button"
            className="text-slate-400 hover:text-white p-1 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-6 pt-4">
          <div className="flex gap-1 mb-1">
            {STEPS.map((s, i) => (
              <div key={s} className="flex-1">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i <= step ? "bg-blue-500" : "bg-slate-700"
                  }`}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between">
            {STEPS.map((s, i) => (
              <span
                key={s}
                className={`text-xs ${
                  i === step
                    ? "text-blue-400 font-medium"
                    : i < step
                      ? "text-emerald-400"
                      : "text-slate-600"
                }`}
              >
                {i < step ? <Check className="w-3 h-3 inline" /> : i + 1}. {s}
              </span>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Step 0: Company Identity */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-slate-300">Company Code *</Label>
                  <Input
                    data-ocid="company_wizard.input"
                    value={form.companyCode}
                    onChange={(e) =>
                      set(
                        "companyCode",
                        e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                      )
                    }
                    placeholder="e.g. ACMECORP"
                    className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 uppercase font-mono"
                  />
                  {errors.companyCode && (
                    <p
                      className="text-red-400 text-xs"
                      data-ocid="company_wizard.error_state"
                    >
                      {errors.companyCode}
                    </p>
                  )}
                  <p className="text-slate-500 text-xs">
                    Unique identifier — cannot be changed later
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300">Plan Status</Label>
                  <select
                    value={form.planStatus}
                    onChange={(e) => set("planStatus", e.target.value)}
                    className="w-full h-10 px-3 rounded-md bg-slate-800 border border-slate-600 text-white text-sm"
                  >
                    <option value="trial">Trial</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">Company Name *</Label>
                <Input
                  value={form.companyName}
                  onChange={(e) => set("companyName", e.target.value)}
                  placeholder="e.g. Acme Corporation"
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                />
                {errors.companyName && (
                  <p className="text-red-400 text-xs">{errors.companyName}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">Legal Name</Label>
                <Input
                  value={form.legalName}
                  onChange={(e) => set("legalName", e.target.value)}
                  placeholder="Full legal entity name (e.g. Acme Corp Pvt. Ltd.)"
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">Brand Name</Label>
                <Input
                  value={form.brandName}
                  onChange={(e) => set("brandName", e.target.value)}
                  placeholder="Short display name shown in UI (leave blank to use Company Name)"
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                />
                <p className="text-slate-500 text-xs">
                  Shown in sidebar and login screen
                </p>
              </div>
            </div>
          )}

          {/* Step 1: Location & Branding */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Company Logo</Label>
                <div className="flex items-start gap-4">
                  {form.logoDataUrl ? (
                    <div className="relative">
                      <img
                        src={form.logoDataUrl}
                        alt="logo preview"
                        className="w-20 h-20 rounded-xl object-contain border border-slate-600 bg-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => set("logoDataUrl", "")}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-600 flex items-center justify-center bg-slate-800">
                      <Building2 className="w-8 h-8 text-slate-500" />
                    </div>
                  )}
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      data-ocid="company_wizard.upload_button"
                      onClick={() => fileRef.current?.click()}
                      className="border-slate-600 text-slate-300 hover:text-white hover:border-slate-400"
                    >
                      <Upload className="w-3.5 h-3.5 mr-1.5" />
                      Upload Logo
                    </Button>
                    <p className="text-slate-500 text-xs mt-2">
                      PNG, JPG or SVG. Max 2MB.
                    </p>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">Address</Label>
                <Textarea
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  placeholder="Registered office address"
                  rows={3}
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-slate-300">State</Label>
                  <Input
                    value={form.state}
                    onChange={(e) => set("state", e.target.value)}
                    placeholder="e.g. Maharashtra"
                    className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300">Country</Label>
                  <Input
                    value={form.country}
                    onChange={(e) => set("country", e.target.value)}
                    placeholder="India"
                    className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Module Access */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-slate-400 text-sm mb-4">
                Select which modules this company can access. All modules are
                enabled by default.
              </p>
              <div className="grid grid-cols-1 gap-2">
                {ALL_MODULES.map((mod) => (
                  <div
                    key={mod}
                    className="flex items-center gap-3 p-3 rounded-lg bg-slate-800 border border-slate-700 cursor-pointer hover:border-slate-500 transition-colors"
                    onClick={() => toggleModule(mod)}
                    onKeyDown={(e) =>
                      (e.key === "Enter" || e.key === " ") && toggleModule(mod)
                    }
                  >
                    <Checkbox
                      checked={form.moduleAccess.includes(mod)}
                      onCheckedChange={() => toggleModule(mod)}
                      className="border-slate-500"
                    />
                    <span className="text-slate-200 text-sm">
                      {MODULE_LABELS[mod] || mod}
                    </span>
                    {form.moduleAccess.includes(mod) && (
                      <Badge className="ml-auto bg-emerald-900/50 text-emerald-300 border-emerald-700/50 text-xs">
                        Enabled
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({ ...f, moduleAccess: [...ALL_MODULES] }))
                  }
                  className="text-xs text-blue-400 hover:underline"
                >
                  Enable All
                </button>
                <span className="text-slate-600">·</span>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, moduleAccess: [] }))}
                  className="text-xs text-slate-400 hover:underline"
                >
                  Disable All
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Admin & Review */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="space-y-4">
                <h3 className="text-slate-300 font-medium text-sm">
                  Admin Account
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-slate-300">Admin Username *</Label>
                    <Input
                      value={form.adminUsername}
                      onChange={(e) => set("adminUsername", e.target.value)}
                      placeholder="admin"
                      className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                    />
                    {errors.adminUsername && (
                      <p className="text-red-400 text-xs">
                        {errors.adminUsername}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-300">Password *</Label>
                    <Input
                      type="password"
                      value={form.adminPassword}
                      onChange={(e) => set("adminPassword", e.target.value)}
                      placeholder="Min 6 chars"
                      className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                    />
                    {errors.adminPassword && (
                      <p className="text-red-400 text-xs">
                        {errors.adminPassword}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-300">Confirm Password *</Label>
                    <Input
                      type="password"
                      value={form.confirmPassword}
                      onChange={(e) => set("confirmPassword", e.target.value)}
                      placeholder="Re-enter password"
                      className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                    />
                    {errors.confirmPassword && (
                      <p className="text-red-400 text-xs">
                        {errors.confirmPassword}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Review Summary */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
                <h3 className="text-slate-300 font-medium text-sm">
                  Review Summary
                </h3>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <span className="text-slate-500">Company Code</span>
                  <span className="text-white font-mono font-bold">
                    {form.companyCode || "—"}
                  </span>
                  <span className="text-slate-500">Company Name</span>
                  <span className="text-white">{form.companyName || "—"}</span>
                  <span className="text-slate-500">Legal Name</span>
                  <span className="text-slate-300">
                    {form.legalName || "—"}
                  </span>
                  <span className="text-slate-500">Brand Name</span>
                  <span className="text-slate-300">
                    {form.brandName || form.companyName || "—"}
                  </span>
                  <span className="text-slate-500">Location</span>
                  <span className="text-slate-300">
                    {[form.state, form.country].filter(Boolean).join(", ") ||
                      "—"}
                  </span>
                  <span className="text-slate-500">Logo</span>
                  <span className="text-slate-300">
                    {form.logoDataUrl ? "Uploaded" : "None"}
                  </span>
                  <span className="text-slate-500">Modules</span>
                  <span className="text-slate-300">
                    {form.moduleAccess.length} / {ALL_MODULES.length} enabled
                  </span>
                  <span className="text-slate-500">Plan</span>
                  <span className="text-slate-300">{form.planStatus}</span>
                  <span className="text-slate-500">Admin</span>
                  <span className="text-slate-300">
                    {form.adminUsername || "—"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 flex justify-between items-center">
          <Button
            variant="ghost"
            onClick={step === 0 ? onClose : handleBack}
            data-ocid="company_wizard.cancel_button"
            className="text-slate-400 hover:text-white"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            {step === 0 ? "Cancel" : "Back"}
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-slate-600 text-xs">
              {step + 1} / {STEPS.length}
            </span>
            {step < STEPS.length - 1 ? (
              <Button
                onClick={handleNext}
                data-ocid="company_wizard.primary_button"
                className="bg-blue-600 hover:bg-blue-700"
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleCreate}
                disabled={creating}
                data-ocid="company_wizard.submit_button"
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {creating ? "Creating..." : "Create Company"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
