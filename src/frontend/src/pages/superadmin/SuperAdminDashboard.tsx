import { Link, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  Building2,
  LogOut,
  PauseCircle,
  Shield,
  UserSquare2,
  Users,
  XCircle,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  clearSuperAdminSession,
  getCompanies,
  getPlatformStats,
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
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
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
  const [stats, setStats] = useState({ totalEmployees: 0, totalUsers: 0 });

  useEffect(() => {
    const session = getSuperAdminSession();
    if (!session) {
      navigate({ to: "/superadmin/login" });
      return;
    }
    setCompanies(getCompanies());
    setStats(getPlatformStats());
  }, [navigate]);

  const handleLogout = () => {
    clearSuperAdminSession();
    navigate({ to: "/superadmin/login" });
  };

  const active = companies.filter((c) => c.status === "active").length;
  const suspended = companies.filter((c) => c.status === "suspended").length;
  const inactive = companies.filter((c) => c.status === "inactive").length;

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
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Platform Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            Overview of all companies and tenants on HumanskeyAI
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <StatCard
            label="Total Companies"
            value={companies.length}
            icon={Building2}
            color="bg-blue-600"
            subLabel="All registered tenants"
          />
          <StatCard
            label="Active Companies"
            value={active}
            icon={Activity}
            color="bg-emerald-600"
            subLabel="Currently operational"
          />
          <StatCard
            label="Suspended"
            value={suspended}
            icon={PauseCircle}
            color="bg-orange-500"
            subLabel="Temporarily blocked"
          />
          <StatCard
            label="Inactive"
            value={inactive}
            icon={XCircle}
            color="bg-red-700"
            subLabel="Deactivated tenants"
          />
          <StatCard
            label="Total Employees"
            value={stats.totalEmployees}
            icon={Users}
            color="bg-violet-600"
            subLabel="Across all tenants"
          />
          <StatCard
            label="Total Users"
            value={stats.totalUsers}
            icon={UserSquare2}
            color="bg-cyan-600"
            subLabel="Admins + supervisors"
          />
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-white font-semibold">Registered Companies</h2>
            <Link to="/superadmin/companies">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                <Building2 className="w-3.5 h-3.5 mr-1" /> Manage Companies
              </Button>
            </Link>
          </div>
          {companies.length === 0 ? (
            <div className="px-5 py-8 text-center text-slate-500">
              No companies registered yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="px-5 py-3 text-left text-slate-400 font-medium">
                      Company Code
                    </th>
                    <th className="px-5 py-3 text-left text-slate-400 font-medium">
                      Brand / Name
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
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company) => (
                    <tr
                      key={company.id}
                      className="border-b border-slate-700/50 hover:bg-slate-700/30"
                    >
                      <td className="px-5 py-3">
                        <Badge className="bg-blue-900/60 text-blue-300 border-blue-700/50">
                          {company.companyCode}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {company.logoDataUrl ? (
                            <img
                              src={company.logoDataUrl}
                              alt="logo"
                              className="w-6 h-6 rounded object-contain"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded bg-blue-700 flex items-center justify-center">
                              <span className="text-white text-xs font-bold">
                                {(company.brandName || company.companyName)
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </span>
                            </div>
                          )}
                          <span className="text-white font-medium">
                            {company.brandName || company.companyName}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-300">
                        {company.adminUsername}
                      </td>
                      <td className="px-5 py-3">
                        <Badge
                          className={
                            company.planStatus === "active"
                              ? "bg-emerald-900/60 text-emerald-300 border-emerald-700/50"
                              : "bg-slate-700 text-slate-400"
                          }
                        >
                          {company.planStatus}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <Badge
                          className={
                            company.status === "active"
                              ? "bg-emerald-900/60 text-emerald-300 border-emerald-700/50"
                              : company.status === "suspended"
                                ? "bg-orange-900/60 text-orange-300 border-orange-700/50"
                                : "bg-slate-700 text-slate-400 border-slate-600"
                          }
                        >
                          {company.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-slate-400 text-xs">
                        {new Date(company.createdAt).toLocaleDateString(
                          "en-IN",
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
