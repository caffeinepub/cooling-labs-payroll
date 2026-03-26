import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, LogOut, Settings, User } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import { useAdminAuth } from "../context/AdminAuthContext";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/employees": "Employees",
  "/attendance/single": "Single Entry",
  "/attendance/bulk": "Bulk Attendance",
  "/attendance/whatsapp": "WhatsApp Attendance",
  "/attendance/regularization": "Attendance Regularization",
  "/payroll": "Payroll",
  "/reports": "Reports",
  "/masters": "Masters & Settings",
  "/masters/trades": "Trade Master",
  "/masters/departments": "Department Master",
  "/masters/sites": "Site Master",
  "/admin/settings": "Admin Settings",
  "/admin/login": "Admin Login",
  "/admin/users": "User Management",
};

export function Topbar() {
  const routerState = useRouterState();
  const { adminLoggedIn, logout, adminName, session } = useAdminAuth();
  const navigate = useNavigate();
  const pathname = routerState.location.pathname;
  const title = pageTitles[pathname] ?? "Cooling Labs";
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node))
        setDropOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = () => {
    setDropOpen(false);
    logout();
    // Replace history so back button can't return to protected page
    window.history.pushState(null, "", "/admin/login");
    navigate({ to: "/admin/login" });
  };

  // Display name: use adminName for admin, supervisor name for supervisor
  const displayName =
    session?.role === "supervisor"
      ? session.name
      : adminLoggedIn
        ? adminName
        : "Guest";

  const displayRole =
    session?.role === "supervisor"
      ? "Supervisor"
      : adminLoggedIn
        ? "Administrator"
        : "Limited Access";

  return (
    <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
      <h1 className="text-xl font-bold text-gray-900">{title}</h1>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500"
        >
          <Bell className="w-5 h-5" />
        </button>
        <div
          className="flex items-center gap-2 pl-3 border-l border-gray-200 relative"
          ref={dropRef}
        >
          <button
            type="button"
            onClick={() => setDropOpen((p) => !p)}
            className="flex items-center gap-2 hover:bg-gray-50 rounded-lg px-2 py-1"
          >
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-gray-900 leading-none">
                {displayName}
              </p>
              <p className="text-xs text-gray-500">{displayRole}</p>
            </div>
          </button>
          {dropOpen && (
            <div className="absolute right-0 top-full mt-2 w-44 bg-white rounded-xl border border-gray-200 shadow-lg py-1 z-50">
              {adminLoggedIn ? (
                <>
                  <Link
                    to="/admin/settings"
                    onClick={() => setDropOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Settings className="w-4 h-4" /> Settings
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="w-4 h-4" /> Logout
                  </button>
                </>
              ) : (
                <Link
                  to="/admin/login"
                  onClick={() => setDropOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50"
                >
                  <User className="w-4 h-4" /> Admin Login
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
