import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Advance {
    id: string;
    date: string;
    createdAt: bigint;
    site: string;
    employeeId: string;
    amount: number;
}
export interface AuditLog {
    id: string;
    oldValue: string;
    changedBy: string;
    newValue: string;
    entityId: string;
    timestamp: bigint;
    entityType: string;
    reason: string;
}
export interface SuperAdminSession {
    token: string;
    expiresAt: bigint;
    username: string;
    createdAt: bigint;
}
export interface TenantEmployee {
    id: string;
    bankAccountNumber: string;
    hra: number;
    status: string;
    pfApplicable: boolean;
    ifscCode: string;
    name: string;
    createdAt: bigint;
    site: string;
    otRate: number;
    cityType: string;
    bankName: string;
    dateOfJoining: string;
    tradeId: string;
    employeeId: string;
    otherAllowance: number;
    companyCode: string;
    bankAccountHolderName: string;
    salaryMode: string;
    branchAddress: string;
    panNumber: string;
    specialAllowance: number;
    mobile: string;
    aadhaarNumber: string;
    uanNumber: string;
    esiNumber: string;
    basicSalary: number;
    esiApplicable: boolean;
    conveyance: number;
    departmentId: string;
}
export interface CompanyFull {
    id: string;
    status: string;
    country: string;
    adminPasswordHash: string;
    moduleAccess: Array<string>;
    logoDataUrl: string;
    createdAt: bigint;
    legalName: string;
    adminUsername: string;
    updatedAt: bigint;
    state: string;
    address: string;
    notes: string;
    companyCode: string;
    companyName: string;
    brandName: string;
    planStatus: string;
}
export interface Supervisor {
    pin: string;
    active: boolean;
    name: string;
    siteId: string;
    phone: string;
}
export interface Trade {
    id: string;
    status: string;
    name: string;
    createdAt: bigint;
}
export interface SuperAdminLoginResult {
    token: string;
    success: boolean;
    errorMsg: string;
}
export interface RegularizationRequest {
    id: string;
    oldStatus: string;
    date: string;
    approvedAt: bigint;
    approvedBy: string;
    createdAt: bigint;
    approvalStatus: string;
    employeeId: string;
    requestedStatus: string;
    requestedBy: string;
    reason: string;
}
export interface PayrollRecord {
    id: string;
    hra: number;
    month: bigint;
    generatedAt: bigint;
    year: bigint;
    grossPay: number;
    netPay: number;
    ptDeduction: number;
    employeeId: string;
    otherAllowance: number;
    esiDeduction: number;
    otAmount: number;
    specialAllowance: number;
    basicSalary: number;
    conveyance: number;
    pfDeduction: number;
}
export interface PayrollSummary {
    totalEmployees: bigint;
    totalDeductions: number;
    totalNetPay: number;
    totalGross: number;
}
export interface Department {
    id: string;
    status: string;
    name: string;
    createdAt: bigint;
}
export interface TenantPayrollRecord {
    id: string;
    month: bigint;
    halfDays: number;
    otherDeduction: number;
    otHours: number;
    totalDaysInMonth: bigint;
    otPay: number;
    generatedAt: bigint;
    presentDays: number;
    year: bigint;
    netPay: number;
    ptDeduction: number;
    paidDays: number;
    employeeId: string;
    lopDays: number;
    esiDeduction: number;
    companyCode: string;
    advanceDeduction: number;
    earnedGross: number;
    earnedSpecialAllowance: number;
    earnedOtherAllowance: number;
    earnedHra: number;
    earnedConveyance: number;
    finalGross: number;
    earnedBasic: number;
    pfDeduction: number;
}
export interface Site {
    id: string;
    lat: number;
    lng: number;
    status: string;
    name: string;
    createdAt: bigint;
    radiusMeters: number;
}
export interface CompanySession {
    token: string;
    expiresAt: bigint;
    username: string;
    createdAt: bigint;
    role: string;
    companyCode: string;
    companyName: string;
    siteId: string;
    companyId: string;
}
export interface TenantAttendanceRecord {
    id: string;
    lat: number;
    lng: number;
    status: string;
    changedBy: string;
    otHours: number;
    flagReason: string;
    date: string;
    punchOut: string;
    createdAt: bigint;
    regularizationReason: string;
    updatedAt: bigint;
    isRegularized: boolean;
    employeeId: string;
    punchIn: string;
    advanceAmount: number;
    companyCode: string;
    isFlagged: boolean;
}
export interface PayrollBreakdown {
    halfDays: number;
    otHours: number;
    totalDaysInMonth: bigint;
    presentDays: number;
    paidDays: number;
    lopDays: number;
    record: PayrollRecord;
}
export interface LoginResult {
    token: string;
    role: string;
    companyCode: string;
    companyName: string;
    success: boolean;
    errorMsg: string;
}
export interface PlatformStats {
    totalEmployees: bigint;
    paidCompanies: bigint;
    activeCompanies: bigint;
    inactiveCompanies: bigint;
    totalUsers: bigint;
    suspendedCompanies: bigint;
    trialCompanies: bigint;
    totalCompanies: bigint;
}
export interface TenantSummary {
    status: string;
    employeeCount: bigint;
    createdAt: bigint;
    plan: string;
    updatedAt: bigint;
    attendanceCount: bigint;
    payrollCount: bigint;
    modules: Array<string>;
}
export interface Employee {
    id: string;
    hra: number;
    status: string;
    pfApplicable: boolean;
    name: string;
    createdAt: bigint;
    site: string;
    otRate: number;
    cityType: string;
    tradeId: string;
    employeeId: string;
    otherAllowance: number;
    salaryMode: string;
    specialAllowance: number;
    mobile: string;
    basicSalary: number;
    esiApplicable: boolean;
    conveyance: number;
    departmentId: string;
}
export interface AttendanceRecord {
    id: string;
    lat: number;
    lng: number;
    status: string;
    changedBy: string;
    otHours: number;
    flagReason: string;
    date: string;
    punchOut: string;
    createdAt: bigint;
    regularizationReason: string;
    updatedAt: bigint;
    isRegularized: boolean;
    employeeId: string;
    punchIn: string;
    isFlagged: boolean;
}
export interface backendInterface {
    addAdvance(employeeId: string, amount: number, date: string, site: string): Promise<boolean>;
    addSupervisor(phone: string, name: string, siteId: string, pin: string): Promise<boolean>;
    approveRegularizationRequest(id: string, approvedBy: string): Promise<boolean>;
    bulkMarkAttendance(records: Array<[string, string, string, number]>, source: string): Promise<{
        errors: Array<string>;
        successCount: bigint;
        skippedCount: bigint;
    }>;
    bulkMarkAttendanceForCompany(companyCode: string, records: Array<[string, string, string, number]>, source: string): Promise<{
        errors: Array<string>;
        successCount: bigint;
        skippedCount: bigint;
    }>;
    bulkMarkAttendanceOverwriteForCompany(companyCode: string, records: Array<[string, string, string, number]>, source: string): Promise<{
        errors: Array<string>;
        successCount: bigint;
        skippedCount: bigint;
    }>;
    changeSuperAdminPassword(currentPassword: string, newPassword: string): Promise<boolean>;
    createCompany(companyCode: string, companyName: string, legalName: string, brandName: string, address: string, state: string, country: string, adminUsername: string, adminPassword: string, planStatus: string, moduleAccess: Array<string>, logoDataUrl: string): Promise<{
        success: boolean;
        errorMsg: string;
    }>;
    createDepartment(name: string): Promise<boolean>;
    createEmployee(emp: Employee): Promise<boolean>;
    createEmployeeForCompany(companyCode: string, emp: TenantEmployee): Promise<boolean>;
    createRegularizationRequest(employeeId: string, date: string, oldStatus: string, requestedStatus: string, reason: string, requestedBy: string): Promise<boolean>;
    createSite(name: string, lat: number, lng: number, radiusMeters: number): Promise<boolean>;
    createTrade(name: string): Promise<boolean>;
    deleteAttendanceForCompany(companyCode: string, employeeId: string, date: string): Promise<boolean>;
    deletePayrollForCompanyAndMonth(companyCode: string, month: bigint, year: bigint): Promise<bigint>;
    ensureCompaniesBootstrapped(): Promise<bigint>;
    flagAttendance(id: string, reason: string): Promise<boolean>;
    flagAttendanceForCompany(companyCode: string, id: string, reason: string): Promise<boolean>;
    generatePayroll(month: bigint, year: bigint, _generatedBy: string): Promise<{
        generatedCount: bigint;
    }>;
    getAdvancesByEmployee(employeeId: string): Promise<Array<Advance>>;
    getAllAttendance(): Promise<Array<AttendanceRecord>>;
    getAllAttendanceByCompany(companyCode: string): Promise<Array<TenantAttendanceRecord>>;
    getAllPayrollByCompany(companyCode: string): Promise<Array<TenantPayrollRecord>>;
    getAllTenantKV(companyCode: string): Promise<Array<[string, string]>>;
    getAttendanceByCompanyAndMonth(companyCode: string, month: string, year: string): Promise<Array<TenantAttendanceRecord>>;
    getAttendanceByMonth(month: string, year: string): Promise<Array<AttendanceRecord>>;
    getAttendanceBySite(siteId: string, month: string, year: string): Promise<Array<AttendanceRecord>>;
    getAuditLogs(): Promise<Array<AuditLog>>;
    getCompanies(): Promise<Array<CompanyFull>>;
    getCompaniesUpdate(): Promise<Array<CompanyFull>>;
    getCompanyByCode(code: string): Promise<CompanyFull | null>;
    getDepartments(): Promise<{
        activeDepartments: Array<Department>;
        departments: Array<Department>;
    }>;
    getEmployees(): Promise<{
        allEmployees: Array<Employee>;
        activeEmployees: Array<Employee>;
    }>;
    getEmployeesByCompany(companyCode: string): Promise<{
        allEmployees: Array<TenantEmployee>;
        activeEmployees: Array<TenantEmployee>;
    }>;
    getEmployeesBySite(siteId: string): Promise<{
        allEmployees: Array<Employee>;
        activeEmployees: Array<Employee>;
    }>;
    getPayrollByCompanyAndMonth(companyCode: string, month: bigint, year: bigint): Promise<Array<TenantPayrollRecord>>;
    getPayrollByMonth(month: bigint, year: bigint): Promise<Array<PayrollRecord>>;
    getPayrollBySite(siteId: string, month: bigint, year: bigint): Promise<Array<PayrollRecord>>;
    getPayrollSummary(month: bigint, year: bigint): Promise<PayrollSummary>;
    getPayrollWithBreakdown(month: bigint, year: bigint): Promise<Array<PayrollBreakdown>>;
    getPlatformStats(): Promise<PlatformStats>;
    getRegularizationRequests(): Promise<Array<RegularizationRequest>>;
    getSites(): Promise<{
        sites: Array<Site>;
        activeSites: Array<Site>;
    }>;
    getSupervisors(): Promise<Array<Supervisor>>;
    getTenantSummary(companyCode: string): Promise<TenantSummary>;
    getTrades(): Promise<{
        trades: Array<Trade>;
        activeTrades: Array<Trade>;
    }>;
    isCallerAdmin(): Promise<boolean>;
    loginCompany(companyCode: string, username: string, password: string): Promise<LoginResult>;
    loginSuperAdmin(username: string, password: string): Promise<SuperAdminLoginResult>;
    logoutCompanySession(token: string): Promise<boolean>;
    logoutSuperAdminSession(token: string): Promise<boolean>;
    manualOverridePayroll(employeeId: string, month: bigint, year: bigint, basicSalary: number, hra: number, conveyance: number, specialAllowance: number, otherAllowance: number, otAmount: number, pfDeduction: number, esiDeduction: number, ptDeduction: number, netPay: number, overriddenBy: string): Promise<boolean>;
    markAttendance(employeeId: string, date: string, attStatus: string, otHours: number, punchIn: string, punchOut: string, lat: number, lng: number, source: string): Promise<boolean>;
    markAttendanceForCompany(companyCode: string, employeeId: string, date: string, attStatus: string, otHours: number, advanceAmount: number, punchIn: string, punchOut: string, lat: number, lng: number, source: string): Promise<boolean>;
    markAttendanceOverwriteForCompany(companyCode: string, employeeId: string, date: string, attStatus: string, otHours: number, advanceAmount: number, punchIn: string, punchOut: string, lat: number, lng: number, source: string): Promise<void>;
    overwritePayroll(month: bigint, year: bigint, generatedBy: string): Promise<{
        generatedCount: bigint;
    }>;
    regularizeAttendance(id: string, newStatus: string, newOtHours: number, reason: string, changedBy: string): Promise<boolean>;
    regularizeAttendanceForCompany(companyCode: string, id: string, newStatus: string, newOtHours: number, reason: string, changedBy: string): Promise<boolean>;
    rejectRegularizationRequest(id: string, approvedBy: string): Promise<boolean>;
    removeSupervisor(phone: string): Promise<boolean>;
    savePayrollForCompany(companyCode: string, records: Array<TenantPayrollRecord>): Promise<bigint>;
    setAdminPassword(oldPassword: string, newPassword: string): Promise<boolean>;
    setPayrollPT(employeeId: string, month: bigint, year: bigint, ptAmount: number): Promise<boolean>;
    setTenantKV(companyCode: string, key: string, value: string): Promise<boolean>;
    updateAttendanceAdvanceForCompany(companyCode: string, employeeId: string, date: string, advanceAmount: number, source: string): Promise<boolean>;
    updateAttendanceOT(employeeId: string, date: string, otHours: number, source: string): Promise<boolean>;
    updateAttendanceOTForCompany(companyCode: string, employeeId: string, date: string, otHours: number, source: string): Promise<boolean>;
    updateCompany(id: string, companyName: string, legalName: string, brandName: string, address: string, state: string, country: string, adminUsername: string, planStatus: string, moduleAccess: Array<string>, logoDataUrl: string, notes: string): Promise<boolean>;
    updateCompanyAdminPassword(companyId: string, newPassword: string): Promise<boolean>;
    updateCompanyStatus(id: string, status: string): Promise<boolean>;
    updateDepartment(id: string, name: string, status: string): Promise<boolean>;
    updateEmployee(id: string, emp: Employee): Promise<boolean>;
    updateEmployeeForCompany(companyCode: string, id: string, emp: TenantEmployee): Promise<boolean>;
    updatePayrollDeductionForCompany(companyCode: string, employeeId: string, month: bigint, year: bigint, ptDeduction: number, advanceDeduction: number, otherDeduction: number): Promise<boolean>;
    updateSite(id: string, name: string, status: string, lat: number, lng: number, radiusMeters: number): Promise<boolean>;
    updateTrade(id: string, name: string, status: string): Promise<boolean>;
    validateCompanySession(token: string): Promise<CompanySession | null>;
    validateSuperAdminSession(token: string): Promise<SuperAdminSession | null>;
    verifyAdminPassword(password: string): Promise<boolean>;
    verifySupervisorPin(phone: string, pin: string): Promise<boolean>;
}
