import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  Database,
  Edit3,
  FileText,
  HardHat,
  IndianRupee,
  LayoutDashboard,
  MessageSquare,
  Settings,
  ShieldCheck,
  Upload,
  UserCheck,
  Users,
  Users2,
} from "lucide-react";
import type React from "react";
import { useCallback, useState } from "react";
import { useAppContext } from "../context/AppContext";

const navBase =
  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150";
const navActive = "bg-white/15 text-white";
const navInactive = "text-slate-400 hover:text-white hover:bg-white/8";

function NavItem({
  to,
  children,
  className,
}: { to: string; children: React.ReactNode; className?: string }) {
  const router = useRouterState();
  const isActive = router.location.pathname === to;
  return (
    <Link
      to={to}
      className={`${navBase} ${isActive ? navActive : navInactive} ${className ?? ""}`}
    >
      {children}
    </Link>
  );
}

function SubNavItem({
  to,
  children,
}: { to: string; children: React.ReactNode }) {
  const router = useRouterState();
  const isActive = router.location.pathname === to;
  return (
    <Link
      to={to}
      className={`${navBase} text-xs py-2 ${
        isActive ? "text-white bg-white/10" : "text-slate-400 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}

export function Sidebar() {
  const [attOpen, setAttOpen] = useState(false);
  const [mastersOpen, setMastersOpen] = useState(false);
  const { isAdmin } = useAppContext();
  const router = useRouterState();
  const pathname = router.location.pathname;

  const toggleAtt = useCallback(() => setAttOpen((p) => !p), []);
  const toggleMasters = useCallback(() => setMastersOpen((p) => !p), []);
  const isAttActive = pathname.startsWith("/attendance");
  const isMastersActive = pathname.startsWith("/masters");

  return (
    <div
      className="w-64 min-h-screen flex flex-col"
      style={{
        background: "linear-gradient(180deg, #0B1220 0%, #0F1B2D 100%)",
      }}
    >
      <div className="px-5 py-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
            <HardHat className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">
              Cooling Labs
            </p>
            <p className="text-slate-400 text-xs mt-0.5">
              Construction Workforce
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <NavItem to="/">
          <LayoutDashboard className="w-4 h-4" /> Dashboard
        </NavItem>
        <NavItem to="/employees">
          <Users className="w-4 h-4" /> Employees
        </NavItem>

        <button
          type="button"
          onClick={toggleAtt}
          className={`w-full ${navBase} ${
            isAttActive ? navActive : navInactive
          } justify-between`}
        >
          <span className="flex items-center gap-3">
            <ClipboardList className="w-4 h-4" /> Attendance
          </span>
          {attOpen || isAttActive ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>
        {(attOpen || isAttActive) && (
          <div className="ml-7 space-y-0.5">
            <SubNavItem to="/attendance/single">
              <Clock className="w-3.5 h-3.5" /> Single Entry
            </SubNavItem>
            <SubNavItem to="/attendance/bulk">
              <Users className="w-3.5 h-3.5" /> Bulk Attendance
            </SubNavItem>
            <SubNavItem to="/attendance/whatsapp">
              <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
            </SubNavItem>
            {isAdmin && (
              <SubNavItem to="/attendance/regularization">
                <Edit3 className="w-3.5 h-3.5" /> Regularization
              </SubNavItem>
            )}
            <SubNavItem to="/attendance/import">
              <Upload className="w-3.5 h-3.5" /> Import
            </SubNavItem>
          </div>
        )}

        {isAdmin && (
          <NavItem to="/payroll">
            <IndianRupee className="w-4 h-4" /> Payroll
          </NavItem>
        )}
        <NavItem to="/reports">
          <FileText className="w-4 h-4" /> Reports
        </NavItem>
        <NavItem to="/supervisor">
          <ShieldCheck className="w-4 h-4" /> Supervisor View
        </NavItem>

        {isAdmin && (
          <NavItem to="/admin/users">
            <Users2 className="w-4 h-4" /> User Management
          </NavItem>
        )}

        <button
          type="button"
          onClick={toggleMasters}
          className={`w-full ${navBase} ${
            isMastersActive ? navActive : navInactive
          } justify-between`}
        >
          <span className="flex items-center gap-3">
            <Database className="w-4 h-4" /> Masters
          </span>
          {mastersOpen || isMastersActive ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>
        {(mastersOpen || isMastersActive) && (
          <div className="ml-7 space-y-0.5">
            <SubNavItem to="/masters/trades">
              <BookOpen className="w-3.5 h-3.5" /> Trade Master
            </SubNavItem>
            <SubNavItem to="/masters/departments">
              <BookOpen className="w-3.5 h-3.5" /> Department Master
            </SubNavItem>
            <SubNavItem to="/masters/sites">
              <BookOpen className="w-3.5 h-3.5" /> Site Master
            </SubNavItem>
          </div>
        )}
      </nav>

      <div className="px-3 pb-2">
        {isAdmin && (
          <NavItem to="/admin/settings">
            <Settings className="w-4 h-4" /> Settings
          </NavItem>
        )}
      </div>

      <div className="px-5 py-4 border-t border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-blue-700 flex items-center justify-center">
            <UserCheck className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-white text-xs font-medium">
              {isAdmin ? "Administrator" : "Guest"}
            </p>
            <p className="text-slate-500 text-xs">
              {isAdmin ? "Full Access" : "Limited Access"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
