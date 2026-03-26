import {
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import React from "react";
import { Layout } from "./components/Layout";
import { AdminAuthProvider } from "./context/AdminAuthContext";
import { AppProvider } from "./context/AppContext";
import { AdminLogin } from "./pages/AdminLogin";
import { AdminSettings } from "./pages/AdminSettings";
import { ApprovalsCenter } from "./pages/ApprovalsCenter";
import { Dashboard } from "./pages/Dashboard";
import { Employees } from "./pages/Employees";
import { Masters } from "./pages/Masters";
import { Payroll } from "./pages/Payroll";
import { Reports } from "./pages/Reports";
import { SuperAdminLogin } from "./pages/SuperAdminLogin";
import { SupervisorView } from "./pages/SupervisorView";
import { UserManagement } from "./pages/UserManagement";
import { AttendanceImport } from "./pages/attendance/AttendanceImport";
import { BulkAttendance } from "./pages/attendance/BulkAttendance";
import { Regularization } from "./pages/attendance/Regularization";
import { SingleEntry } from "./pages/attendance/SingleEntry";
import { WhatsApp } from "./pages/attendance/WhatsApp";
import { Companies } from "./pages/superadmin/Companies";
import { SuperAdminDashboard } from "./pages/superadmin/SuperAdminDashboard";
import {
  ensureDefaultCompanies,
  runMigrationIfNeeded,
} from "./services/tenantStorage";

// Run migration + ensure default companies exist
runMigrationIfNeeded();
ensureDefaultCompanies();

const rootRoute = createRootRoute({ component: Layout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Dashboard,
});
const employeesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/employees",
  component: Employees,
});
const attendanceSingleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/attendance/single",
  component: SingleEntry,
});
const attendanceBulkRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/attendance/bulk",
  component: BulkAttendance,
});
const attendanceWhatsAppRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/attendance/whatsapp",
  component: WhatsApp,
});
const attendanceRegularizationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/attendance/regularization",
  component: Regularization,
});
const attendanceImportRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/attendance/import",
  component: AttendanceImport,
});
const payrollRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/payroll",
  component: Payroll,
});
const reportsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reports",
  component: Reports,
});
const supervisorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/supervisor",
  component: SupervisorView,
});
const userManagementRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/users",
  component: UserManagement,
});
const mastersMastersRedirectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/masters",
  component: () => <Masters section="trades" />,
});
const mastersTradesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/masters/trades",
  component: () => <Masters section="trades" />,
});
const mastersDepartmentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/masters/departments",
  component: () => <Masters section="departments" />,
});
const mastersSitesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/masters/sites",
  component: () => <Masters section="sites" />,
});
const adminLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/login",
  component: AdminLogin,
});
const adminSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/settings",
  component: AdminSettings,
});
const approvalsCenterRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/approvals",
  component: ApprovalsCenter,
});
// Super Admin routes (render their own full-page layouts)
const superAdminLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/superadmin/login",
  component: SuperAdminLogin,
});
const superAdminDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/superadmin/dashboard",
  component: SuperAdminDashboard,
});
const superAdminCompaniesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/superadmin/companies",
  component: Companies,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  employeesRoute,
  attendanceSingleRoute,
  attendanceBulkRoute,
  attendanceWhatsAppRoute,
  attendanceRegularizationRoute,
  attendanceImportRoute,
  payrollRoute,
  reportsRoute,
  supervisorRoute,
  userManagementRoute,
  mastersMastersRedirectRoute,
  mastersTradesRoute,
  mastersDepartmentsRoute,
  mastersSitesRoute,
  adminLoginRoute,
  adminSettingsRoute,
  approvalsCenterRoute,
  superAdminLoginRoute,
  superAdminDashboardRoute,
  superAdminCompaniesRoute,
]);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  return (
    <AdminAuthProvider>
      <AppProvider>
        <RouterProvider router={router} />
      </AppProvider>
    </AdminAuthProvider>
  );
}
