import { Link, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  Building2,
  CheckCircle2,
  Info,
  KeyRound,
  LogOut,
  Save,
  Settings,
  Shield,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Label } from "../../components/ui/label";
import {
  ALL_MODULES,
  MODULE_LABELS,
  clearSuperAdminSession,
  getSuperAdminSession,
} from "../../services/tenantStorage";

const DEFAULT_MODULES_KEY = "hkai_platform_default_modules";
const DEFAULT_PLAN_KEY = "hkai_platform_default_plan";

export function PlatformSettings() {
  const navigate = useNavigate();
  const [defaultModules, setDefaultModules] = useState<string[]>([
    ...ALL_MODULES,
  ]);
  const [defaultPlan, setDefaultPlan] = useState<"trial" | "active">("trial");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const session = getSuperAdminSession();
    if (!session) {
      navigate({ to: "/superadmin/login" });
      return;
    }
    // Load saved settings
    const storedModules = localStorage.getItem(DEFAULT_MODULES_KEY);
    if (storedModules) {
      try {
        setDefaultModules(JSON.parse(storedModules));
      } catch {
        setDefaultModules([...ALL_MODULES]);
      }
    }
    const storedPlan = localStorage.getItem(DEFAULT_PLAN_KEY);
    if (storedPlan === "active" || storedPlan === "trial") {
      setDefaultPlan(storedPlan);
    }
  }, [navigate]);

  const handleLogout = () => {
    clearSuperAdminSession();
    navigate({ to: "/superadmin/login" });
  };

  const toggleModule = (mod: string) => {
    if (defaultModules.includes(mod)) {
      setDefaultModules((prev) => prev.filter((m) => m !== mod));
    } else {
      setDefaultModules((prev) => [...prev, mod]);
    }
  };

  const handleSave = () => {
    localStorage.setItem(DEFAULT_MODULES_KEY, JSON.stringify(defaultModules));
    localStorage.setItem(DEFAULT_PLAN_KEY, defaultPlan);
    setSaved(true);
    toast.success("Platform settings saved");
    setTimeout(() => setSaved(false), 2000);
  };

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
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-300 hover:text-white"
              >
                <Building2 className="w-4 h-4 mr-1" /> Companies
              </Button>
            </Link>
            <Link to="/superadmin/settings">
              <Button variant="ghost" size="sm" className="text-blue-400">
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

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-7">
          <h1 className="text-2xl font-bold text-white">Platform Settings</h1>
          <p className="text-slate-400 text-sm mt-1">
            Configure default behaviours for new company tenants
          </p>
        </div>

        <div className="space-y-6">
          {/* Default Modules */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-white font-semibold">
                Default Module Access
              </h2>
            </div>
            <p className="text-slate-400 text-sm mb-4">
              Modules selected here will be enabled by default when creating a
              new company.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {ALL_MODULES.map((mod) => (
                <div
                  key={mod}
                  className="flex items-center gap-2.5 cursor-pointer group"
                >
                  <Checkbox
                    checked={defaultModules.includes(mod)}
                    onCheckedChange={() => toggleModule(mod)}
                    className="border-slate-500"
                    data-ocid="settings.checkbox"
                  />
                  <span className="text-slate-300 text-sm group-hover:text-white transition-colors">
                    {MODULE_LABELS[mod] || mod}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Default Plan */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <h2 className="text-white font-semibold mb-1">
              Default Plan for New Companies
            </h2>
            <p className="text-slate-400 text-sm mb-4">
              New companies will be created with this plan by default.
            </p>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="defaultPlan"
                  value="trial"
                  checked={defaultPlan === "trial"}
                  onChange={() => setDefaultPlan("trial")}
                  className="accent-blue-500 w-4 h-4"
                  data-ocid="settings.radio"
                />
                <span className="text-slate-300">
                  Trial{" "}
                  <span className="text-slate-500 text-xs">(recommended)</span>
                </span>
              </div>
              <div className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="defaultPlan"
                  value="active"
                  checked={defaultPlan === "active"}
                  onChange={() => setDefaultPlan("active")}
                  className="accent-blue-500 w-4 h-4"
                />
                <span className="text-slate-300">Paid / Active</span>
              </div>
            </div>
          </div>

          {/* Credentials Policy */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-1">
              <Info className="w-4 h-4 text-blue-400" />
              <h2 className="text-white font-semibold">Credentials Policy</h2>
            </div>
            <ul className="space-y-1.5 mt-3 text-slate-400 text-sm list-disc list-inside">
              <li>Minimum password length: 6 characters</li>
              <li>Company codes must be uppercase alphanumeric (no spaces)</li>
              <li>Admin username must be unique per company</li>
              <li>Super Admin password changes take effect immediately</li>
              <li>
                Suspended companies cannot log in until reactivated by Super
                Admin
              </li>
            </ul>
          </div>

          {/* Platform Info */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-blue-400" />
              <h2 className="text-white font-semibold">Platform Info</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: "Platform Name", value: "HumanskeyAI" },
                { label: "Super Admin", value: "humanskeyai" },
                { label: "Version", value: "1.0.0" },
                { label: "Backend", value: "ICP Canister (Motoko)" },
                {
                  label: "Data Source",
                  value: "Canister (shared, cross-browser)",
                },
                { label: "Auth", value: "Canister session tokens" },
              ].map((row) => (
                <div key={row.label} className="bg-slate-900/50 rounded-lg p-3">
                  <p className="text-slate-400 text-xs">{row.label}</p>
                  <p className="text-white font-medium mt-0.5">{row.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Save */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              className="bg-blue-600 hover:bg-blue-700 min-w-[120px]"
              data-ocid="settings.save_button"
            >
              {saved ? (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Saved!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" /> Save Settings
                </>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
