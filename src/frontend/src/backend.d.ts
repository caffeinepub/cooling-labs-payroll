export interface Trade {
  id: string;
  name: string;
  status: string;
  createdAt: bigint;
}

export interface Department {
  id: string;
  name: string;
  status: string;
  createdAt: bigint;
}

export interface Site {
  id: string;
  name: string;
  status: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  createdAt: bigint;
}

export interface Employee {
  id: string;
  employeeId: string;
  name: string;
  mobile: string;
  site: string;
  tradeId: string;
  departmentId: string;
  status: string;
  salaryMode: string;
  cityType: string;
  basicSalary: number;
  hra: number;
  conveyance: number;
  specialAllowance: number;
  otherAllowance: number;
  otRate: number;
  pfApplicable: boolean;
  esiApplicable: boolean;
  createdAt: bigint;
}

export interface TenantEmployee {
  id: string;
  companyCode: string;
  employeeId: string;
  name: string;
  mobile: string;
  site: string;
  tradeId: string;
  departmentId: string;
  status: string;
  salaryMode: string;
  cityType: string;
  basicSalary: number;
  hra: number;
  conveyance: number;
  specialAllowance: number;
  otherAllowance: number;
  otRate: number;
  pfApplicable: boolean;
  esiApplicable: boolean;
  aadhaarNumber: string;
  panNumber: string;
  uanNumber: string;
  esiNumber: string;
  bankAccountHolderName: string;
  bankAccountNumber: string;
  ifscCode: string;
  bankName: string;
  branchAddress: string;
  dateOfJoining: string;
  createdAt: bigint;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  status: string;
  otHours: number;
  punchIn: string;
  punchOut: string;
  lat: number;
  lng: number;
  isFlagged: boolean;
  flagReason: string;
  isRegularized: boolean;
  regularizationReason: string;
  changedBy: string;
  updatedAt: bigint;
  createdAt: bigint;
}

/** Tenant-aware attendance record stored in canister */
export interface TenantAttendanceRecord {
  id: string;
  companyCode: string;
  employeeId: string;
  date: string;
  status: string;
  otHours: number;
  advanceAmount: number;
  punchIn: string;
  punchOut: string;
  lat: number;
  lng: number;
  isFlagged: boolean;
  flagReason: string;
  isRegularized: boolean;
  regularizationReason: string;
  changedBy: string;
  updatedAt: bigint;
  createdAt: bigint;
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  month: bigint;
  year: bigint;
  basicSalary: number;
  hra: number;
  conveyance: number;
  specialAllowance: number;
  otherAllowance: number;
  otAmount: number;
  grossPay: number;
  pfDeduction: number;
  esiDeduction: number;
  ptDeduction: number;
  netPay: number;
  generatedAt: bigint;
}

export interface TenantPayrollRecord {
  id: string;
  companyCode: string;
  employeeId: string;
  month: number;
  year: number;
  earnedBasic: number;
  earnedHra: number;
  earnedConveyance: number;
  earnedSpecialAllowance: number;
  earnedOtherAllowance: number;
  earnedGross: number;
  otPay: number;
  finalGross: number;
  pfDeduction: number;
  esiDeduction: number;
  ptDeduction: number;
  advanceDeduction: number;
  otherDeduction: number;
  netPay: number;
  paidDays: number;
  presentDays: number;
  halfDays: number;
  lopDays: number;
  totalDaysInMonth: number;
  otHours: number;
  generatedAt: number;
}

export interface PayrollSummary {
  totalEmployees: bigint;
  totalGross: number;
  totalDeductions: number;
  totalNetPay: number;
}

export interface PayrollBreakdown {
  record: PayrollRecord;
  presentDays: number;
  halfDays: number;
  lopDays: number;
  paidDays: number;
  otHours: number;
  totalDaysInMonth: bigint;
}

export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  timestamp: bigint;
  reason: string;
}

export interface Advance {
  id: string;
  employeeId: string;
  amount: number;
  date: string;
  site: string;
  createdAt: bigint;
}

export interface Supervisor {
  phone: string;
  name: string;
  siteId: string;
  pin: string;
  active: boolean;
}

export interface RegularizationRequest {
  id: string;
  employeeId: string;
  date: string;
  oldStatus: string;
  requestedStatus: string;
  reason: string;
  requestedBy: string;
  approvalStatus: string;
  approvedBy: string;
  approvedAt: bigint;
  createdAt: bigint;
}

// Company & Auth types — CompanyFull is the current canister type
export interface Company {
  id: string;
  companyCode: string;
  companyName: string;
  legalName: string;
  brandName: string;
  address: string;
  state: string;
  country: string;
  status: string;
  adminUsername: string;
  adminPasswordHash: string;
  planStatus: string;
  moduleAccess: string[];
  logoDataUrl: string;
  notes: string;
  updatedAt: bigint;
  createdAt: bigint;
}

export interface TenantSummary {
  employeeCount: bigint;
  attendanceCount: bigint;
  payrollCount: bigint;
  status: string;
  plan: string;
  modules: string[];
  createdAt: bigint;
  updatedAt: bigint;
}

export interface CompanySession {
  token: string;
  companyId: string;
  companyCode: string;
  companyName: string;
  username: string;
  role: string;
  siteId: string;
  createdAt: bigint;
  expiresAt: bigint;
}

export interface SuperAdminSession {
  token: string;
  username: string;
  createdAt: bigint;
  expiresAt: bigint;
}

export interface LoginResult {
  success: boolean;
  token: string;
  companyCode: string;
  companyName: string;
  role: string;
  errorMsg: string;
}

export interface SuperAdminLoginResult {
  success: boolean;
  token: string;
  errorMsg: string;
}

export interface PlatformStats {
  totalCompanies: bigint;
  activeCompanies: bigint;
  suspendedCompanies: bigint;
  inactiveCompanies: bigint;
  trialCompanies: bigint;
  paidCompanies: bigint;
  totalEmployees: bigint;
  totalUsers: bigint;
}

export interface backendInterface {
  isCallerAdmin: () => Promise<boolean>;
  verifyAdminPassword: (password: string) => Promise<boolean>;
  setAdminPassword: (oldPassword: string, newPassword: string) => Promise<boolean>;

  // Company management
  getCompanies: () => Promise<Company[]>;
  getCompanyByCode: (code: string) => Promise<[] | [Company]>;
  ensureCompaniesBootstrapped: () => Promise<bigint>;
  getCompaniesUpdate: () => Promise<Company[]>;
  createCompany: (
    companyCode: string, companyName: string, legalName: string, brandName: string,
    address: string, state: string, country: string,
    adminUsername: string, adminPassword: string, planStatus: string,
    moduleAccess: string[], logoDataUrl: string
  ) => Promise<{ success: boolean; errorMsg: string }>;
  updateCompany: (
    id: string, companyName: string, legalName: string, brandName: string,
    address: string, state: string, country: string,
    adminUsername: string, planStatus: string, moduleAccess: string[], logoDataUrl: string, notes: string
  ) => Promise<boolean>;
  updateCompanyStatus: (id: string, status: string) => Promise<boolean>;
  updateCompanyAdminPassword: (companyId: string, newPassword: string) => Promise<boolean>;

  // Company authentication
  loginCompany: (companyCode: string, username: string, password: string) => Promise<LoginResult>;
  validateCompanySession: (token: string) => Promise<[] | [CompanySession]>;
  logoutCompanySession: (token: string) => Promise<boolean>;

  // Super Admin authentication
  loginSuperAdmin: (username: string, password: string) => Promise<SuperAdminLoginResult>;
  validateSuperAdminSession: (token: string) => Promise<[] | [SuperAdminSession]>;
  logoutSuperAdminSession: (token: string) => Promise<boolean>;
  changeSuperAdminPassword: (currentPassword: string, newPassword: string) => Promise<boolean>;

  // Platform stats and tenant inspection
  getPlatformStats: () => Promise<PlatformStats>;
  getTenantSummary: (companyCode: string) => Promise<TenantSummary>;

  getTrades: () => Promise<{ trades: Trade[]; activeTrades: Trade[] }>;
  createTrade: (name: string) => Promise<boolean>;
  updateTrade: (id: string, name: string, status: string) => Promise<boolean>;

  getDepartments: () => Promise<{ departments: Department[]; activeDepartments: Department[] }>;
  createDepartment: (name: string) => Promise<boolean>;
  updateDepartment: (id: string, name: string, status: string) => Promise<boolean>;

  getSites: () => Promise<{ sites: Site[]; activeSites: Site[] }>;
  createSite: (name: string, lat: number, lng: number, radiusMeters: number) => Promise<boolean>;
  updateSite: (id: string, name: string, status: string, lat: number, lng: number, radiusMeters: number) => Promise<boolean>;

  getEmployees: () => Promise<{ allEmployees: Employee[]; activeEmployees: Employee[] }>;
  getEmployeesBySite: (siteId: string) => Promise<{ allEmployees: Employee[]; activeEmployees: Employee[] }>;
  createEmployee: (emp: Employee) => Promise<boolean>;
  updateEmployee: (id: string, emp: Employee) => Promise<boolean>;

  // Tenant-aware employee methods
  getEmployeesByCompany: (companyCode: string) => Promise<{ allEmployees: TenantEmployee[]; activeEmployees: TenantEmployee[] }>;
  createEmployeeForCompany: (companyCode: string, emp: TenantEmployee) => Promise<boolean>;
  updateEmployeeForCompany: (companyCode: string, id: string, emp: TenantEmployee) => Promise<boolean>;

  // Legacy attendance methods
  markAttendance: (employeeId: string, date: string, status: string, otHours: number, punchIn: string, punchOut: string, lat: number, lng: number, source: string) => Promise<boolean>;
  updateAttendanceOT: (employeeId: string, date: string, otHours: number, source: string) => Promise<boolean>;
  bulkMarkAttendance: (records: [string, string, string, number][], source: string) => Promise<{ successCount: bigint; skippedCount: bigint; errors: string[] }>;
  getAttendanceByMonth: (month: string, year: string) => Promise<AttendanceRecord[]>;
  getAllAttendance: () => Promise<AttendanceRecord[]>;
  getAttendanceBySite: (siteId: string, month: string, year: string) => Promise<AttendanceRecord[]>;
  regularizeAttendance: (id: string, newStatus: string, newOtHours: number, reason: string, changedBy: string) => Promise<boolean>;
  flagAttendance: (id: string, reason: string) => Promise<boolean>;

  // Tenant-aware attendance methods
  getAllAttendanceByCompany: (companyCode: string) => Promise<TenantAttendanceRecord[]>;
  getAttendanceByCompanyAndMonth: (companyCode: string, month: string, year: string) => Promise<TenantAttendanceRecord[]>;
  markAttendanceForCompany: (companyCode: string, employeeId: string, date: string, status: string, otHours: number, advanceAmount: number, punchIn: string, punchOut: string, lat: number, lng: number, source: string) => Promise<boolean>;
  markAttendanceOverwriteForCompany: (companyCode: string, employeeId: string, date: string, status: string, otHours: number, advanceAmount: number, punchIn: string, punchOut: string, lat: number, lng: number, source: string) => Promise<void>;
  deleteAttendanceForCompany: (companyCode: string, employeeId: string, date: string) => Promise<boolean>;
  bulkMarkAttendanceForCompany: (companyCode: string, records: [string, string, string, number][], source: string) => Promise<{ successCount: bigint; skippedCount: bigint; errors: string[] }>;
  bulkMarkAttendanceOverwriteForCompany: (companyCode: string, records: [string, string, string, number][], source: string) => Promise<{ successCount: bigint; skippedCount: bigint; errors: string[] }>;
  updateAttendanceOTForCompany: (companyCode: string, employeeId: string, date: string, otHours: number, source: string) => Promise<boolean>;
  updateAttendanceAdvanceForCompany: (companyCode: string, employeeId: string, date: string, advanceAmount: number, source: string) => Promise<boolean>;
  regularizeAttendanceForCompany: (companyCode: string, id: string, newStatus: string, newOtHours: number, reason: string, changedBy: string) => Promise<boolean>;
  flagAttendanceForCompany: (companyCode: string, id: string, reason: string) => Promise<boolean>;

  createRegularizationRequest: (employeeId: string, date: string, oldStatus: string, requestedStatus: string, reason: string, requestedBy: string) => Promise<boolean>;
  getRegularizationRequests: () => Promise<RegularizationRequest[]>;
  approveRegularizationRequest: (id: string, approvedBy: string) => Promise<boolean>;
  rejectRegularizationRequest: (id: string, approvedBy: string) => Promise<boolean>;

  addAdvance: (employeeId: string, amount: number, date: string, site: string) => Promise<boolean>;
  getAdvancesByEmployee: (employeeId: string) => Promise<Advance[]>;

  getAuditLogs: () => Promise<AuditLog[]>;

  generatePayroll: (month: bigint, year: bigint, generatedBy: string) => Promise<{ generatedCount: bigint }>;
  overwritePayroll: (month: bigint, year: bigint, generatedBy: string) => Promise<{ generatedCount: bigint }>;
  getPayrollByMonth: (month: bigint, year: bigint) => Promise<PayrollRecord[]>;
  getPayrollBySite: (siteId: string, month: bigint, year: bigint) => Promise<PayrollRecord[]>;
  getPayrollSummary: (month: bigint, year: bigint) => Promise<PayrollSummary>;
  getPayrollWithBreakdown: (month: bigint, year: bigint) => Promise<PayrollBreakdown[]>;
  setPayrollPT: (employeeId: string, month: bigint, year: bigint, ptAmount: number) => Promise<boolean>;
  manualOverridePayroll: (employeeId: string, month: bigint, year: bigint, basicSalary: number, hra: number, conveyance: number, specialAllowance: number, otherAllowance: number, otAmount: number, pfDeduction: number, esiDeduction: number, ptDeduction: number, netPay: number, overriddenBy: string) => Promise<boolean>;

  // Tenant-aware payroll methods
  getPayrollByCompanyAndMonth: (companyCode: string, month: number, year: number) => Promise<TenantPayrollRecord[]>;
  getAllPayrollByCompany: (companyCode: string) => Promise<TenantPayrollRecord[]>;
  savePayrollForCompany: (companyCode: string, records: TenantPayrollRecord[]) => Promise<number>;
  deletePayrollForCompanyAndMonth: (companyCode: string, month: number, year: number) => Promise<number>;
  updatePayrollDeductionForCompany: (companyCode: string, employeeId: string, month: number, year: number, ptDeduction: number, advanceDeduction: number, otherDeduction: number) => Promise<boolean>;

  getSupervisors: () => Promise<Supervisor[]>;
  addSupervisor: (phone: string, name: string, siteId: string, pin: string) => Promise<boolean>;
  removeSupervisor: (phone: string) => Promise<boolean>;
  verifySupervisorPin: (phone: string, pin: string) => Promise<boolean>;
}
