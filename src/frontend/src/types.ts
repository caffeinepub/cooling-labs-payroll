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
  siteCode: string;
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
  // KYC / Statutory
  aadhaarNumber?: string;
  panNumber?: string;
  uanNumber?: string;
  esiNumber?: string;
  // Bank Details
  bankAccountHolderName?: string;
  bankAccountNumber?: string;
  ifscCode?: string;
  bankName?: string;
  branchAddress?: string;
  dateOfJoining?: string;
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
  advanceDeduction?: number;
  otherDeduction?: number;
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

/** Supervisor / user with role-based login */
export interface Supervisor {
  phone: string;
  name: string;
  siteId: string;
  pin: string;
  active: boolean;
  /** Optional username for credential-based login */
  username?: string;
  /** Plain-text password stored in localStorage (same approach as admin) */
  password?: string;
  role?: "supervisor" | "admin";
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

export interface UserProfile {
  name: string;
  role: string;
  department: string;
}
