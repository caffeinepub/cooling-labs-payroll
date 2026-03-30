// tenantStorage.ts - Platform-level company registry for HumanskeyAI multi-tenant SaaS

export interface Company {
  id: string;
  companyCode: string;
  companyName: string;
  legalName: string;
  brandName: string;
  logoDataUrl: string;
  address: string;
  state: string;
  country: string;
  moduleAccess: string[];
  status: "active" | "suspended" | "inactive";
  adminUsername: string;
  adminPassword: string;
  createdAt: number;
  planStatus: "trial" | "active" | "inactive";
  notes?: string;
  updatedAt?: number;
}

export const ALL_MODULES = [
  "employees",
  "attendance",
  "bulkAttendance",
  "whatsappAttendance",
  "attendanceImport",
  "regularization",
  "payroll",
  "reports",
  "masters",
  "userManagement",
  "salarySlips",
];

export const MODULE_LABELS: Record<string, string> = {
  employees: "Employees",
  attendance: "Attendance",
  bulkAttendance: "Bulk Attendance",
  whatsappAttendance: "WhatsApp Attendance",
  attendanceImport: "Attendance Import",
  regularization: "Regularization",
  payroll: "Payroll",
  reports: "Reports",
  masters: "Masters",
  userManagement: "User Management",
  salarySlips: "Salary Slips",
};

const COMPANIES_KEY = "hkai_companies";
const SUPERADMIN_SESSION_KEY = "hkai_superadmin_session";
const COMPANY_SESSION_KEY = "hkai_company_session";
const SUPERADMIN_CREDS_KEY = "hkai_superadmin_creds";
const MIGRATION_FLAG = "hkai_migration_v1";

export interface CompanySession {
  companyId: string;
  companyCode: string;
  companyName: string;
  role: "company_admin" | "supervisor";
  username: string;
  siteId?: string;
}

export interface SuperAdminSession {
  username: string;
  loggedInAt: number;
}

/** Get tenant-prefixed key. e.g. getTenantKey('COOLABS', 'clf_employees') => 'clf_COOLABS_employees' */
export function getTenantKey(companyId: string, baseKey: string): string {
  if (baseKey.startsWith("clf_")) {
    return `clf_${companyId}_${baseKey.slice(4)}`;
  }
  return `clf_${companyId}_${baseKey}`;
}

/** Get active company ID from session (for use inside storage services) */
export function getActiveCompanyId(): string {
  try {
    const raw = localStorage.getItem(COMPANY_SESSION_KEY);
    if (!raw) return "COOLABS";
    const session: CompanySession = JSON.parse(raw);
    return session.companyCode || "COOLABS";
  } catch {
    return "COOLABS";
  }
}

export function getCompanies(): Company[] {
  try {
    const raw = localStorage.getItem(COMPANIES_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveCompanies(companies: Company[]): void {
  localStorage.setItem(COMPANIES_KEY, JSON.stringify(companies));
}

export function createCompany(
  company: Omit<Company, "id" | "createdAt">,
): Company {
  const companies = getCompanies();
  const newCompany: Company = {
    ...company,
    id: `company-${Date.now()}`,
    companyCode: company.companyCode.toUpperCase(),
    brandName: company.brandName || company.companyName,
    state: company.state || "",
    country: company.country || "India",
    moduleAccess: company.moduleAccess || [...ALL_MODULES],
    createdAt: Date.now(),
  };
  companies.push(newCompany);
  saveCompanies(companies);
  return newCompany;
}

export function updateCompany(id: string, updates: Partial<Company>): boolean {
  const companies = getCompanies();
  const idx = companies.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  companies[idx] = { ...companies[idx], ...updates };
  saveCompanies(companies);
  return true;
}

export function getCompanyByCode(code: string): Company | null {
  const companies = getCompanies();
  return (
    companies.find((c) => c.companyCode.toUpperCase() === code.toUpperCase()) ||
    null
  );
}

export function loginCompany(
  companyCode: string,
  username: string,
  password: string,
): CompanySession | null {
  const company = getCompanyByCode(companyCode);
  if (!company || company.status !== "active") return null;
  if (company.adminUsername !== username || company.adminPassword !== password)
    return null;
  const session: CompanySession = {
    companyId: company.id,
    companyCode: company.companyCode,
    companyName: company.brandName || company.companyName,
    role: "company_admin",
    username,
  };
  localStorage.setItem(COMPANY_SESSION_KEY, JSON.stringify(session));
  return session;
}

export function getCompanySession(): CompanySession | null {
  try {
    const raw = localStorage.getItem(COMPANY_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCompanySession(session: CompanySession): void {
  localStorage.setItem(COMPANY_SESSION_KEY, JSON.stringify(session));
}

export function clearCompanySession(): void {
  localStorage.removeItem(COMPANY_SESSION_KEY);
}

export function loginSuperAdmin(username: string, password: string): boolean {
  const stored = localStorage.getItem(SUPERADMIN_CREDS_KEY);
  let creds = { username: "humanskeyai", password: "Humanskey@123" };
  if (stored) {
    try {
      creds = JSON.parse(stored);
    } catch {}
  }
  if (username !== creds.username || password !== creds.password) return false;
  const session: SuperAdminSession = { username, loggedInAt: Date.now() };
  localStorage.setItem(SUPERADMIN_SESSION_KEY, JSON.stringify(session));
  return true;
}

export function getSuperAdminSession(): SuperAdminSession | null {
  try {
    const raw = localStorage.getItem(SUPERADMIN_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSuperAdminSession(): void {
  localStorage.removeItem(SUPERADMIN_SESSION_KEY);
}

export function changeSuperAdminPassword(newPassword: string): void {
  localStorage.setItem(
    SUPERADMIN_CREDS_KEY,
    JSON.stringify({ username: "humanskeyai", password: newPassword }),
  );
}

/** Get platform-wide aggregated stats across all tenants */
export function getPlatformStats(): {
  totalEmployees: number;
  totalUsers: number;
} {
  const companies = getCompanies();
  let totalEmployees = 0;
  let totalUsers = 0;
  for (const company of companies) {
    try {
      const empKey = getTenantKey(company.companyCode, "clf_employees");
      const empRaw = localStorage.getItem(empKey);
      if (empRaw) {
        const emps = JSON.parse(empRaw);
        if (Array.isArray(emps)) totalEmployees += emps.length;
      }
    } catch {}
    try {
      const supKey = getTenantKey(company.companyCode, "clf_supervisors");
      const supRaw = localStorage.getItem(supKey);
      if (supRaw) {
        const sups = JSON.parse(supRaw);
        if (Array.isArray(sups)) totalUsers += sups.length;
      }
    } catch {}
    // Count admin user per company
    if (company.adminUsername) totalUsers += 1;
  }
  return { totalEmployees, totalUsers };
}

/** Idempotent: ensure platform default companies always exist */
export function ensureDefaultCompanies(): void {
  const companies = getCompanies();
  if (!companies.find((c) => c.companyCode === "COOLABS")) {
    createCompany({
      companyCode: "COOLABS",
      companyName: "Cooling Labs",
      legalName: "COOLING LABS ENGINEERS LLP.",
      brandName: "Cooling Labs",
      logoDataUrl: "",
      address: "",
      state: "Maharashtra",
      country: "India",
      moduleAccess: [...ALL_MODULES],
      status: "active",
      adminUsername: "admin",
      adminPassword: "admin123",
      planStatus: "active",
    });
  } else {
    // Backfill new fields for existing COOLABS company
    const cl = companies.find((c) => c.companyCode === "COOLABS");
    if (cl && !cl.brandName) {
      updateCompany(cl.id, {
        brandName: cl.companyName,
        state: cl.state || "Maharashtra",
        country: cl.country || "India",
        moduleAccess: cl.moduleAccess || [...ALL_MODULES],
      });
    }
  }
  if (!companies.find((c) => c.companyCode === "DEMOCORP")) {
    createCompany({
      companyCode: "DEMOCORP",
      companyName: "Demo Corporation",
      legalName: "Demo Corporation Pvt. Ltd.",
      brandName: "DemoCorp",
      logoDataUrl: "",
      address: "123 Demo Street, Mumbai",
      state: "Maharashtra",
      country: "India",
      moduleAccess: [...ALL_MODULES],
      status: "active",
      adminUsername: "admin",
      adminPassword: "demo123",
      planStatus: "trial",
    });
  } else {
    const dc = companies.find((c) => c.companyCode === "DEMOCORP");
    if (dc && !dc.brandName) {
      updateCompany(dc.id, {
        brandName: dc.brandName || "DemoCorp",
        state: dc.state || "Maharashtra",
        country: dc.country || "India",
        moduleAccess: dc.moduleAccess || [...ALL_MODULES],
      });
    }
  }
}

/** One-time migration: copy old clf_* keys to clf_COOLABS_* keys */
export function runMigrationIfNeeded(): void {
  if (localStorage.getItem(MIGRATION_FLAG)) return;

  const hasOldData =
    localStorage.getItem("clf_employees") || localStorage.getItem("clf_trades");

  const keysToMigrate = [
    "clf_employees",
    "clf_supervisors",
    "clf_workforce_counter",
    "clf_trades",
    "clf_departments",
    "clf_sites",
    "clf_master_counter",
    "clf_attendance",
    "clf_payroll",
    "clf_payroll_manual_ded",
    "clf_reg_requests",
    "clf_audit_logs",
    "clf_approval_requests",
    "clf_import_settings",
    "clf_import_history",
    "clf_supervisor_permissions_global",
    "clf_supervisor_permissions",
    "clf_company_settings",
  ];

  for (const key of keysToMigrate) {
    const value = localStorage.getItem(key);
    if (value !== null) {
      const newKey = getTenantKey("COOLABS", key);
      if (!localStorage.getItem(newKey)) {
        localStorage.setItem(newKey, value);
      }
    }
  }

  // Migrate admin credentials
  const adminPw = localStorage.getItem("adminPassword");
  if (adminPw)
    localStorage.setItem(getTenantKey("COOLABS", "clf_adminPassword"), adminPw);
  const adminName = localStorage.getItem("adminName");
  if (adminName)
    localStorage.setItem(getTenantKey("COOLABS", "clf_adminName"), adminName);

  // Create COOLABS company if it doesn't exist
  const companies = getCompanies();
  if (!companies.find((c) => c.companyCode === "COOLABS")) {
    const adminPwValue = hasOldData
      ? localStorage.getItem("adminPassword") || "admin123"
      : "admin123";
    createCompany({
      companyCode: "COOLABS",
      companyName: "Cooling Labs",
      legalName: "COOLING LABS ENGINEERS LLP.",
      brandName: "Cooling Labs",
      logoDataUrl: "",
      address: "",
      state: "Maharashtra",
      country: "India",
      moduleAccess: [...ALL_MODULES],
      status: "active",
      adminUsername: "admin",
      adminPassword: adminPwValue,
      planStatus: "active",
    });
  }

  // Create DEMOCORP demo company if it doesn't exist
  if (!companies.find((c) => c.companyCode === "DEMOCORP")) {
    createCompany({
      companyCode: "DEMOCORP",
      companyName: "Demo Corporation",
      legalName: "Demo Corporation Pvt. Ltd.",
      brandName: "DemoCorp",
      logoDataUrl: "",
      address: "123 Demo Street, Mumbai",
      state: "Maharashtra",
      country: "India",
      moduleAccess: [...ALL_MODULES],
      status: "active",
      adminUsername: "admin",
      adminPassword: "demo123",
      planStatus: "trial",
    });
  }

  localStorage.setItem(MIGRATION_FLAG, "1");
}
