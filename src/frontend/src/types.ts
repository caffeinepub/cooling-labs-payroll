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
  /** Advance amount recorded at time of attendance entry (from import / WhatsApp ADV) */
  advanceAmount?: number;
  /** Source of this record: single / bulk / import / whatsapp / regularization */
  source?: string;
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

export interface SupervisorPermissions {
  attendance: {
    view: boolean;
    mark: boolean;
    bulk: boolean;
    dateRange: boolean;
    requestCorrectionOnly: boolean;
  };
  ot: {
    view: boolean;
    add: boolean;
    requireApproval: boolean;
  };
  advance: {
    view: boolean;
    add: boolean;
    requireApproval: boolean;
  };
  payroll: {
    viewSummary: boolean;
    viewRows: boolean;
    downloadPayslip: boolean;
  };
  import: {
    viewHistory: boolean;
    upload: boolean;
    requireApproval: boolean;
  };
  regularization: {
    raise: boolean;
    approve: boolean;
  };
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
  /** Per-supervisor permission overrides. Falls back to global defaults if not set. */
  permissions?: SupervisorPermissions;
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
  // Extended fields (optional, backward compat)
  oldOtHours?: number;
  newOtHours?: number;
  oldAdvance?: number;
  newAdvance?: number;
  approvalRemark?: string;
  requestType?: "status" | "ot" | "advance" | "combined";
  siteId?: string;
}

export interface ApprovalRequest {
  id: string;
  requestType:
    | "attendance_correction"
    | "ot_request"
    | "advance_request"
    | "regularization"
    | "leave_request";
  employeeId: string;
  siteId: string;
  date: string; // YYYYMMDD format
  monthRef: string; // YYYYMM format
  oldValue: Record<string, unknown>;
  newValue: Record<string, unknown>;
  reason: string;
  requestedBy: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  approvedBy: string;
  approvedAt: number;
  approvalRemark: string;
  createdAt: number;
}

export interface UserProfile {
  name: string;
  role: string;
  department: string;
}
