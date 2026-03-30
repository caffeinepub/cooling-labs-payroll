import { Link, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  Building2,
  KeyRound,
  Layers,
  LogOut,
  PauseCircle,
  Plus,
  Settings,
  Shield,
  Users,
  XCircle,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  canisterGetCompanies,
  canisterGetPlatformStats,
} from "../../services/canisterCompanyService";
import {
  clearSuperAdminSession,
  getSuperAdminSession,
} from "../../services/tenantStorage";
import type { Company } from "../../services/tenantStorage";

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  subLabel,
}: {
  label: string;
  value: number | string;
  icon: React.FC<{ className?: string }>;
  color: string;
  subLabel?: string;
}) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-slate-600 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className="text-slate-400 text-sm">{label}</span>
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}
        >
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {subLabel && <p className="text-slate-500 text-xs mt-1">{subLabel}</p>}
    </div>
  );
}

export function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stats, setStats] = useState({
    totalCompanies: 0,
    activeCompanies: 0,
    suspendedCompanies: 0,
    inactiveCompanies: 0,
    trialCompanies: 0,
    paidCompanies: 0,
    totalEmployees: 0,
    totalUsers: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    const session = getSuperAdminSession();
    if (!session) {
      navigate({ to: "/superadmin/login" });
      return;
    }
    setLoadingStats(true);
    Promise.all([canisterGetPlatformStats(), canisterGetCompanies()])
      .then(([platformStats, list]) => {
        const ps = platformStats;
        setStats({
          totalCompanies: ps?.totalCompanies ?? list.length,
          activeCompanies:
            ps?.activeCompanies ??
            list.filter((c) => c.status === "active").length,
          suspendedCompanies:
            ps?.suspendedCompanies ??
            list.filter((c) => c.status === "suspended").length,
          inactiveCompanies:
            ps?.inactiveCompanies ??
            list.filter((c) => c.status === "inactive").length,
          trialCompanies:
            ps?.trialCompanies ??
            list.filter((c) => c.planStatus === "trial").length,
          paidCompanies:
            ps?.paidCompanies ??
            list.filter((c) => c.planStatus === "active").length,
          totalEmployees: ps?.totalEmployees ?? 0,
          totalUsers: ps?.totalUsers ?? 0,
        });
        // Recent 5 by createdAt
        const sorted = [...list].sort((a, b) => b.createdAt - a.createdAt);
        setCompanies(sorted.slice(0, 5));
      })
      .catch(() => {
        // silent
      })
      .finally(() => setLoadingStats(false));
  }, [navigate]);

  const handleLogout = () => {
    clearSuperAdminSession();
    navigate({ to: "/superadmin/login" });
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
              <Button variant="ghost" size="sm" className="text-blue-400">
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
        <div className="mb-7">
          <h1 className="text-2xl font-bold text-white">Platform Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            HumanskeyAI SaaS control center — all tenants at a glance
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total Companies"
            value={loadingStats ? "—" : stats.totalCompanies}
            icon={Building2}
            color="bg-blue-600"
            subLabel="All registered tenants"
          />
          <StatCard
            label="Active"
            value={loadingStats ? "—" : stats.activeCompanies}
            icon={Activity}
            color="bg-emerald-600"
            subLabel="Operational now"
          />
          <StatCard
            label="Suspended"
            value={loadingStats ? "—" : stats.suspendedCompanies}
            icon={PauseCircle}
            color="bg-orange-500"
            subLabel="Temporarily blocked"
          />
          <StatCard
            label="Inactive"
            value={loadingStats ? "—" : stats.inactiveCompanies}
            icon={XCircle}
            color="bg-red-700"
            subLabel="Deactivated tenants"
          />
          <StatCard
            label="Trial Plan"
            value={loadingStats ? "—" : stats.trialCompanies}
            icon={Layers}
            color="bg-sky-600"
            subLabel="On trial plan"
          />
          <StatCard
            label="Paid Plan"
            value={loadingStats ? "—" : stats.paidCompanies}
            icon={Shield}
            color="bg-violet-600"
            subLabel="Active subscriptions"
          />
          <StatCard
            label="Total Employees"
            value={loadingStats ? "—" : stats.totalEmployees}
            icon={Users}
            color="bg-teal-600"
            subLabel="Across all tenants"
          />
          <StatCard
            label="Platform Users"
            value={loadingStats ? "—" : stats.totalUsers}
            icon={Users}
            color="bg-cyan-600"
            subLabel="Admins + supervisors"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Tenants */}
          <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-white font-semibold text-sm">
                Recently Created Tenants
              </h2>
              <Link to="/superadmin/companies">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-blue-400 text-xs h-7"
                >
                  View all →
                </Button>
              </Link>
            </div>
            {companies.length === 0 ? (
              <div className="px-5 py-8 text-center text-slate-500 text-sm">
                {loadingStats ? "Loading..." : "No companies yet."}
              </div>
            ) : (
              <div className="divide-y divide-slate-700/50">
                {companies.map((company) => (
                  <div
                    key={company.id}
                    className="px-5 py-3 flex items-center gap-3 hover:bg-slate-700/30 transition-colors"
                  >
                    <div className="flex-shrink-0">
                      {company.logoDataUrl ? (
                        <img
                          src={company.logoDataUrl}
                          alt="logo"
                          className="w-8 h-8 rounded object-contain bg-slate-700"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-blue-700 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">
                            {(company.brandName || company.companyName)
                              .slice(0, 2)
                              .toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        {company.brandName || company.companyName}
                      </p>
                      <p className="text-slate-500 text-xs">
                        {company.companyCode} ·{" "}
                        {new Date(company.createdAt).toLocaleDateString(
                          "en-IN",
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={
                          company.status === "active"
                            ? "bg-emerald-900/60 text-emerald-300 border-emerald-700/50 text-xs"
                            : company.status === "suspended"
                              ? "bg-orange-900/60 text-orange-300 border-orange-700/50 text-xs"
                              : "bg-slate-700 text-slate-400 border-slate-600 text-xs"
                        }
                      >
                        {company.status}
                      </Badge>
                      <Badge
                        className={
                          company.planStatus === "active"
                            ? "bg-violet-900/60 text-violet-300 border-violet-700/50 text-xs"
                            : company.planStatus === "trial"
                              ? "bg-sky-900/60 text-sky-300 border-sky-700/50 text-xs"
                              : "bg-slate-700 text-slate-400 text-xs"
                        }
                      >
                        {company.planStatus}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="space-y-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <h2 className="text-white font-semibold text-sm mb-4">
                Quick Actions
              </h2>
              <div className="space-y-3">
                <Link to="/superadmin/companies" className="block">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-600/10 border border-blue-700/40 hover:bg-blue-600/20 transition-colors cursor-pointer">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                      <Plus className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">
                        Add Company
                      </p>
                      <p className="text-slate-400 text-xs">
                        Create new tenant
                      </p>
                    </div>
                  </div>
                </Link>
                <Link to="/superadmin/settings" className="block">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/40 border border-slate-600/40 hover:bg-slate-700/60 transition-colors cursor-pointer">
                    <div className="w-8 h-8 rounded-lg bg-slate-600 flex items-center justify-center">
                      <Settings className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">
                        Platform Settings
                      </p>
                      <p className="text-slate-400 text-xs">
                        Defaults & controls
                      </p>
                    </div>
                  </div>
                </Link>
                <Link to="/superadmin/change-password" className="block">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-700/40 border border-slate-600/40 hover:bg-slate-700/60 transition-colors cursor-pointer">
                    <div className="w-8 h-8 rounded-lg bg-slate-600 flex items-center justify-center">
                      <KeyRound className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">
                        Change Password
                      </p>
                      <p className="text-slate-400 text-xs">
                        Update Super Admin credentials
                      </p>
                    </div>
                  </div>
                </Link>
              </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <h2 className="text-white font-semibold text-sm mb-3">
                Platform Info
              </h2>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Platform</span>
                  <span className="text-white">HumanskeyAI</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Version</span>
                  <span className="text-white">1.0.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Backend</span>
                  <span className="text-emerald-400">ICP Canister ✓</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Data Source</span>
                  <span className="text-emerald-400">Canister only</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
