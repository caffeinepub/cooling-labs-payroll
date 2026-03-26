import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import React, { useEffect } from "react";
import { useAdminAuth } from "../context/AdminAuthContext";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

/** Routes accessible without admin login */
const PUBLIC_ROUTES = ["/admin/login", "/supervisor"];

export function Layout() {
  const { adminLoggedIn } = useAdminAuth();
  const routerState = useRouterState();
  const navigate = useNavigate();
  const pathname = routerState.location.pathname;

  useEffect(() => {
    const isPublic = PUBLIC_ROUTES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    );
    if (!isPublic && !adminLoggedIn) {
      // Replace history entry so back button can't return to protected page
      window.history.replaceState(null, "", "/admin/login");
      navigate({ to: "/admin/login" });
    }
  }, [adminLoggedIn, pathname, navigate]);

  // Prevent back button from returning to protected pages after logout
  useEffect(() => {
    const handlePopState = () => {
      const isPublic = PUBLIC_ROUTES.some(
        (p) =>
          window.location.pathname === p ||
          window.location.pathname.startsWith(`${p}/`),
      );
      if (!isPublic && !adminLoggedIn) {
        window.history.replaceState(null, "", "/admin/login");
        navigate({ to: "/admin/login" });
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [adminLoggedIn, navigate]);

  if (pathname === "/admin/login") {
    return <Outlet />;
  }

  if (pathname === "/supervisor") {
    return <Outlet />;
  }

  if (!adminLoggedIn) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-y-auto bg-[#F2F5FA] p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
