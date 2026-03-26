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

export interface backendInterface {
  isCallerAdmin: () => Promise<boolean>;
  verifyAdminPassword: (password: string) => Promise<boolean>;
  setAdminPassword: (oldPassword: string, newPassword: string) => Promise<boolean>;

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

  markAttendance: (employeeId: string, date: string, status: string, otHours: number, punchIn: string, punchOut: string, lat: number, lng: number, source: string) => Promise<boolean>;
  updateAttendanceOT: (employeeId: string, date: string, otHours: number, source: string) => Promise<boolean>;
  bulkMarkAttendance: (records: [string, string, string, number][], source: string) => Promise<{ successCount: bigint; skippedCount: bigint; errors: string[] }>;
  getAttendanceByMonth: (month: string, year: string) => Promise<AttendanceRecord[]>;
  getAllAttendance: () => Promise<AttendanceRecord[]>;
  getAttendanceBySite: (siteId: string, month: string, year: string) => Promise<AttendanceRecord[]>;
  regularizeAttendance: (id: string, newStatus: string, newOtHours: number, reason: string, changedBy: string) => Promise<boolean>;
  flagAttendance: (id: string, reason: string) => Promise<boolean>;

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

  getSupervisors: () => Promise<Supervisor[]>;
  addSupervisor: (phone: string, name: string, siteId: string, pin: string) => Promise<boolean>;
  removeSupervisor: (phone: string) => Promise<boolean>;
  verifySupervisorPin: (phone: string, pin: string) => Promise<boolean>;
}
