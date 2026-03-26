import Array "mo:base/Array";
import Char "mo:base/Char";
import Float "mo:base/Float";
import Int "mo:base/Int";
import Nat "mo:base/Nat";
import Text "mo:base/Text";
import Time "mo:base/Time";

persistent actor {

  // ── V1 Types (migration from very first schema) ───────────────────────────────

  type SiteV1 = { id : Text; name : Text; status : Text; createdAt : Int };
  type EmployeeV1 = { id : Text; employeeId : Text; name : Text; mobile : Text; site : Text; tradeId : Text; departmentId : Text; status : Text; basicSalary : Float; otRate : Float; pfApplicable : Bool; esiApplicable : Bool; createdAt : Int };
  type AttendanceRecordV1 = { id : Text; employeeId : Text; date : Text; status : Text; otHours : Float; isRegularized : Bool; regularizationReason : Text; changedBy : Text; updatedAt : Int; createdAt : Int };
  type SupervisorV1 = { phone : Text; name : Text; siteId : Text; active : Bool };

  // ── V2 Types (previous stable schema — used only for migration) ─────────────────
  // PayrollRecord WITHOUT ptDeduction — matches the existing stable var on-chain.

  type PayrollRecordV2 = {
    id : Text; employeeId : Text; month : Nat; year : Nat;
    basicSalary : Float; hra : Float; conveyance : Float;
    specialAllowance : Float; otherAllowance : Float;
    otAmount : Float; grossPay : Float;
    pfDeduction : Float; esiDeduction : Float; netPay : Float;
    generatedAt : Int;
  };

  // V1 payroll (even older, no hra/conveyance etc.)
  type PayrollRecordV1 = { id : Text; employeeId : Text; month : Nat; year : Nat; basicSalary : Float; otAmount : Float; grossPay : Float; pfDeduction : Float; esiDeduction : Float; netPay : Float; generatedAt : Int };

  // ── Current Types ─────────────────────────────────────────────────────

  type Trade = { id : Text; name : Text; status : Text; createdAt : Int };
  type Department = { id : Text; name : Text; status : Text; createdAt : Int };
  type Site = { id : Text; name : Text; status : Text; lat : Float; lng : Float; radiusMeters : Float; createdAt : Int };

  type Employee = { id : Text; employeeId : Text; name : Text; mobile : Text; site : Text; tradeId : Text; departmentId : Text; status : Text; salaryMode : Text; cityType : Text; basicSalary : Float; hra : Float; conveyance : Float; specialAllowance : Float; otherAllowance : Float; otRate : Float; pfApplicable : Bool; esiApplicable : Bool; createdAt : Int };

  type AttendanceRecord = { id : Text; employeeId : Text; date : Text; status : Text; otHours : Float; punchIn : Text; punchOut : Text; lat : Float; lng : Float; isFlagged : Bool; flagReason : Text; isRegularized : Bool; regularizationReason : Text; changedBy : Text; updatedAt : Int; createdAt : Int };

  // PayrollRecord WITH ptDeduction — current schema (V3)
  type PayrollRecord = {
    id : Text; employeeId : Text; month : Nat; year : Nat;
    basicSalary : Float; hra : Float; conveyance : Float;
    specialAllowance : Float; otherAllowance : Float;
    otAmount : Float; grossPay : Float;
    pfDeduction : Float; esiDeduction : Float; ptDeduction : Float; netPay : Float;
    generatedAt : Int;
  };

  type PayrollSummary = { totalEmployees : Nat; totalGross : Float; totalDeductions : Float; totalNetPay : Float };

  type PayrollBreakdown = { record : PayrollRecord; presentDays : Float; halfDays : Float; lopDays : Float; paidDays : Float; otHours : Float; totalDaysInMonth : Nat };

  type AuditLog = { id : Text; entityType : Text; entityId : Text; oldValue : Text; newValue : Text; changedBy : Text; timestamp : Int; reason : Text };

  type Advance = { id : Text; employeeId : Text; amount : Float; date : Text; site : Text; createdAt : Int };

  type Supervisor = { phone : Text; name : Text; siteId : Text; pin : Text; active : Bool };

  type RegularizationRequest = { id : Text; employeeId : Text; date : Text; oldStatus : Text; requestedStatus : Text; reason : Text; requestedBy : Text; approvalStatus : Text; approvedBy : Text; approvedAt : Int; createdAt : Int };

  // ── Stable vars — V1 (original schema names, loaded from old canister state) ────────

  stable var sites : [SiteV1] = [];
  stable var employees : [EmployeeV1] = [];
  stable var attendance : [AttendanceRecordV1] = [];
  stable var payroll : [PayrollRecordV1] = [];
  stable var supervisors : [SupervisorV1] = [];

  // ── Stable vars — V2 (previous deployed schema, now renamed for migration) ───────
  // payrollV2 used the OLD PayrollRecord type (without ptDeduction).
  // We declare it here with the OLD type so Motoko can read the existing
  // stable memory, then migrate it to payrollV3 in postupgrade.

  stable var trades : [Trade] = [];
  stable var departments : [Department] = [];
  stable var sitesV2 : [Site] = [];
  stable var employeesV2 : [Employee] = [];
  stable var attendanceV2 : [AttendanceRecord] = [];
  stable var payrollV2 : [PayrollRecordV2] = [];   // OLD type — kept for migration only
  stable var auditLogs : [AuditLog] = [];
  stable var advances : [Advance] = [];
  stable var supervisorsV2 : [Supervisor] = [];
  stable var regularizationRequests : [RegularizationRequest] = [];
  stable var adminPasswordHash : Text = "admin123";
  stable var counter : Nat = 0;
  stable var migrated : Bool = false;

  // ── V3 stable var — current schema with ptDeduction ────────────────────────

  stable var payrollV3 : [PayrollRecord] = [];
  stable var migratedPayrollV3 : Bool = false;

  // ── Migration ───────────────────────────────────────────────────────────

  system func postupgrade() {
    // V1 → V2 migration (original empty-schema canister)
    if (not migrated) {
      if (sites.size() > 0) {
        sitesV2 := Array.map(sites, func(s : SiteV1) : Site { { id = s.id; name = s.name; status = s.status; lat = 0.0; lng = 0.0; radiusMeters = 0.0; createdAt = s.createdAt } });
        sites := [];
      };
      if (employees.size() > 0) {
        employeesV2 := Array.map(employees, func(e : EmployeeV1) : Employee { { id = e.id; employeeId = e.employeeId; name = e.name; mobile = e.mobile; site = e.site; tradeId = e.tradeId; departmentId = e.departmentId; status = e.status; salaryMode = "auto"; cityType = "non-metro"; basicSalary = e.basicSalary; hra = 0.0; conveyance = 0.0; specialAllowance = 0.0; otherAllowance = 0.0; otRate = e.otRate; pfApplicable = e.pfApplicable; esiApplicable = e.esiApplicable; createdAt = e.createdAt } });
        employees := [];
      };
      if (attendance.size() > 0) {
        attendanceV2 := Array.map(attendance, func(a : AttendanceRecordV1) : AttendanceRecord { { id = a.id; employeeId = a.employeeId; date = a.date; status = a.status; otHours = a.otHours; punchIn = ""; punchOut = ""; lat = 0.0; lng = 0.0; isFlagged = false; flagReason = ""; isRegularized = a.isRegularized; regularizationReason = a.regularizationReason; changedBy = a.changedBy; updatedAt = a.updatedAt; createdAt = a.createdAt } });
        attendance := [];
      };
      if (payroll.size() > 0) {
        // Migrate old V1 payroll records into payrollV2 (no-ptDeduction schema)
        payrollV2 := Array.map(payroll, func(p : PayrollRecordV1) : PayrollRecordV2 { { id = p.id; employeeId = p.employeeId; month = p.month; year = p.year; basicSalary = p.basicSalary; hra = 0.0; conveyance = 0.0; specialAllowance = 0.0; otherAllowance = 0.0; otAmount = p.otAmount; grossPay = p.grossPay; pfDeduction = p.pfDeduction; esiDeduction = p.esiDeduction; netPay = p.netPay; generatedAt = p.generatedAt } });
        payroll := [];
      };
      if (supervisors.size() > 0) {
        supervisorsV2 := Array.map(supervisors, func(s : SupervisorV1) : Supervisor { { phone = s.phone; name = s.name; siteId = s.siteId; pin = "1234"; active = s.active } });
        supervisors := [];
      };
      migrated := true;
    };
    // V2 → V3 payroll migration: add ptDeduction = 0.0 to all existing records
    if (not migratedPayrollV3) {
      if (payrollV2.size() > 0) {
        payrollV3 := Array.map(payrollV2, func(p : PayrollRecordV2) : PayrollRecord {
          { id = p.id; employeeId = p.employeeId; month = p.month; year = p.year;
            basicSalary = p.basicSalary; hra = p.hra; conveyance = p.conveyance;
            specialAllowance = p.specialAllowance; otherAllowance = p.otherAllowance;
            otAmount = p.otAmount; grossPay = p.grossPay;
            pfDeduction = p.pfDeduction; esiDeduction = p.esiDeduction;
            ptDeduction = 0.0; netPay = p.netPay; generatedAt = p.generatedAt }
        });
        payrollV2 := []; // clear old stable var to save memory
      };
      migratedPayrollV3 := true;
    };
  };

  // ── Helpers ───────────────────────────────────────────────────────────

  func nextId() : Text { counter += 1; Nat.toText(counter) # "-" # Int.toText(Time.now()) };
  func charToLower(c : Char) : Char { if (c >= 'A' and c <= 'Z') Char.fromNat32(Char.toNat32(c) + 32) else c };
  func toLower(t : Text) : Text { Text.map(t, charToLower) };

  func daysInMonth(year : Nat, month : Nat) : Nat {
    if (month == 2) {
      let leap = (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0);
      if (leap) 29 else 28;
    } else if (month == 4 or month == 6 or month == 9 or month == 11) { 30 } else { 31 };
  };

  func padMonth(m : Nat) : Text { if (m < 10) "0" # Nat.toText(m) else Nat.toText(m) };

  // ── Admin ─────────────────────────────────────────────────────────────

  public func isCallerAdmin() : async Bool { true };
  public query func verifyAdminPassword(password : Text) : async Bool { password == adminPasswordHash };
  public func setAdminPassword(oldPassword : Text, newPassword : Text) : async Bool {
    if (oldPassword != adminPasswordHash) return false;
    adminPasswordHash := newPassword;
    true;
  };

  // ── Trades ────────────────────────────────────────────────────────────

  public query func getTrades() : async { trades : [Trade]; activeTrades : [Trade] } {
    let active = Array.filter(trades, func(t : Trade) : Bool { t.status == "active" });
    { trades = trades; activeTrades = active };
  };
  public func createTrade(name : Text) : async Bool {
    let lower = toLower(Text.trim(name, #char ' '));
    if (Array.find(trades, func(t : Trade) : Bool { toLower(t.name) == lower }) != null) return false;
    trades := Array.append(trades, [{ id = nextId(); name = Text.trim(name, #char ' '); status = "active"; createdAt = Time.now() }]); true;
  };
  public func updateTrade(id : Text, name : Text, status : Text) : async Bool {
    var found = false;
    trades := Array.map(trades, func(t : Trade) : Trade { if (t.id == id) { found := true; { t with name = Text.trim(name, #char ' '); status = status } } else t }); found;
  };

  // ── Departments ───────────────────────────────────────────────────────

  public query func getDepartments() : async { departments : [Department]; activeDepartments : [Department] } {
    let active = Array.filter(departments, func(d : Department) : Bool { d.status == "active" });
    { departments = departments; activeDepartments = active };
  };
  public func createDepartment(name : Text) : async Bool {
    let lower = toLower(Text.trim(name, #char ' '));
    if (Array.find(departments, func(d : Department) : Bool { toLower(d.name) == lower }) != null) return false;
    departments := Array.append(departments, [{ id = nextId(); name = Text.trim(name, #char ' '); status = "active"; createdAt = Time.now() }]); true;
  };
  public func updateDepartment(id : Text, name : Text, status : Text) : async Bool {
    var found = false;
    departments := Array.map(departments, func(d : Department) : Department { if (d.id == id) { found := true; { d with name = Text.trim(name, #char ' '); status = status } } else d }); found;
  };

  // ── Sites ─────────────────────────────────────────────────────────────

  public query func getSites() : async { sites : [Site]; activeSites : [Site] } {
    let active = Array.filter(sitesV2, func(s : Site) : Bool { s.status == "active" });
    { sites = sitesV2; activeSites = active };
  };
  public func createSite(name : Text, lat : Float, lng : Float, radiusMeters : Float) : async Bool {
    let lower = toLower(Text.trim(name, #char ' '));
    if (Array.find(sitesV2, func(s : Site) : Bool { toLower(s.name) == lower }) != null) return false;
    sitesV2 := Array.append(sitesV2, [{ id = nextId(); name = Text.trim(name, #char ' '); status = "active"; lat = lat; lng = lng; radiusMeters = radiusMeters; createdAt = Time.now() }]); true;
  };
  public func updateSite(id : Text, name : Text, status : Text, lat : Float, lng : Float, radiusMeters : Float) : async Bool {
    var found = false;
    sitesV2 := Array.map(sitesV2, func(s : Site) : Site { if (s.id == id) { found := true; { s with name = Text.trim(name, #char ' '); status = status; lat = lat; lng = lng; radiusMeters = radiusMeters } } else s }); found;
  };

  // ── Employees ─────────────────────────────────────────────────────────

  public query func getEmployees() : async { allEmployees : [Employee]; activeEmployees : [Employee] } {
    let active = Array.filter(employeesV2, func(e : Employee) : Bool { e.status == "active" });
    { allEmployees = employeesV2; activeEmployees = active };
  };
  public query func getEmployeesBySite(siteId : Text) : async { allEmployees : [Employee]; activeEmployees : [Employee] } {
    let filtered = Array.filter(employeesV2, func(e : Employee) : Bool { e.site == siteId });
    let active = Array.filter(filtered, func(e : Employee) : Bool { e.status == "active" });
    { allEmployees = filtered; activeEmployees = active };
  };
  public func createEmployee(emp : Employee) : async Bool {
    if (Array.find(employeesV2, func(e : Employee) : Bool { e.employeeId == emp.employeeId }) != null) return false;
    employeesV2 := Array.append(employeesV2, [{ emp with id = nextId(); createdAt = Time.now() }]); true;
  };
  public func updateEmployee(id : Text, emp : Employee) : async Bool {
    var found = false;
    employeesV2 := Array.map(employeesV2, func(e : Employee) : Employee { if (e.id == id) { found := true; { emp with id = id; createdAt = e.createdAt } } else e }); found;
  };

  // ── Attendance ────────────────────────────────────────────────────────

  public func markAttendance(employeeId : Text, date : Text, attStatus : Text, otHours : Float, punchIn : Text, punchOut : Text, lat : Float, lng : Float, source : Text) : async Bool {
    if (Array.find(attendanceV2, func(a : AttendanceRecord) : Bool { a.employeeId == employeeId and a.date == date }) != null) return false;
    attendanceV2 := Array.append(attendanceV2, [{ id = nextId(); employeeId = employeeId; date = date; status = attStatus; otHours = otHours; punchIn = punchIn; punchOut = punchOut; lat = lat; lng = lng; isFlagged = false; flagReason = ""; isRegularized = false; regularizationReason = ""; changedBy = source; updatedAt = Time.now(); createdAt = Time.now() }]); true;
  };
  public func updateAttendanceOT(employeeId : Text, date : Text, otHours : Float, source : Text) : async Bool {
    var found = false;
    attendanceV2 := Array.map(attendanceV2, func(a : AttendanceRecord) : AttendanceRecord { if (a.employeeId == employeeId and a.date == date) { found := true; { a with otHours = a.otHours + otHours; changedBy = source; updatedAt = Time.now() } } else a }); found;
  };
  public func bulkMarkAttendance(records : [(Text, Text, Text, Float)], source : Text) : async { successCount : Nat; skippedCount : Nat; errors : [Text] } {
    var success : Nat = 0; var skipped : Nat = 0;
    for ((empId, date, attStatus, otHours) in records.vals()) {
      if (Array.find(attendanceV2, func(a : AttendanceRecord) : Bool { a.employeeId == empId and a.date == date }) != null) { skipped += 1; }
      else { attendanceV2 := Array.append(attendanceV2, [{ id = nextId(); employeeId = empId; date = date; status = attStatus; otHours = otHours; punchIn = ""; punchOut = ""; lat = 0.0; lng = 0.0; isFlagged = false; flagReason = ""; isRegularized = false; regularizationReason = ""; changedBy = source; updatedAt = Time.now(); createdAt = Time.now() }]); success += 1; };
    };
    { successCount = success; skippedCount = skipped; errors = [] };
  };
  public query func getAttendanceByMonth(month : Text, year : Text) : async [AttendanceRecord] {
    let mm = if (Text.size(month) == 1) "0" # month else month;
    let prefix = year # mm;
    Array.filter(attendanceV2, func(a : AttendanceRecord) : Bool { Text.startsWith(a.date, #text prefix) });
  };
  public query func getAllAttendance() : async [AttendanceRecord] { attendanceV2 };
  public query func getAttendanceBySite(siteId : Text, month : Text, year : Text) : async [AttendanceRecord] {
    let mm = if (Text.size(month) == 1) "0" # month else month;
    let prefix = year # mm;
    let siteEmpIds = Array.map(Array.filter(employeesV2, func(e : Employee) : Bool { e.site == siteId }), func(e : Employee) : Text { e.id });
    Array.filter(attendanceV2, func(a : AttendanceRecord) : Bool {
      Text.startsWith(a.date, #text prefix) and Array.find(siteEmpIds, func(id : Text) : Bool { id == a.employeeId }) != null;
    });
  };
  public func regularizeAttendance(id : Text, newStatus : Text, newOtHours : Float, reason : Text, changedBy : Text) : async Bool {
    var found = false; var oldVal = "";
    attendanceV2 := Array.map(attendanceV2, func(a : AttendanceRecord) : AttendanceRecord {
      if (a.id == id) { found := true; oldVal := a.status # "|" # Float.toText(a.otHours); { a with status = newStatus; otHours = newOtHours; isRegularized = true; regularizationReason = reason; changedBy = changedBy; updatedAt = Time.now() } } else a;
    });
    if (found) { auditLogs := Array.append(auditLogs, [{ id = nextId(); entityType = "attendance"; entityId = id; oldValue = oldVal; newValue = newStatus # "|" # Float.toText(newOtHours); changedBy = changedBy; timestamp = Time.now(); reason = reason }]) };
    found;
  };
  public func flagAttendance(id : Text, reason : Text) : async Bool {
    var found = false;
    attendanceV2 := Array.map(attendanceV2, func(a : AttendanceRecord) : AttendanceRecord { if (a.id == id) { found := true; { a with isFlagged = true; flagReason = reason; updatedAt = Time.now() } } else a }); found;
  };

  // ── Regularization Requests ───────────────────────────────────────────

  public func createRegularizationRequest(employeeId : Text, date : Text, oldStatus : Text, requestedStatus : Text, reason : Text, requestedBy : Text) : async Bool {
    regularizationRequests := Array.append(regularizationRequests, [{ id = nextId(); employeeId = employeeId; date = date; oldStatus = oldStatus; requestedStatus = requestedStatus; reason = reason; requestedBy = requestedBy; approvalStatus = "pending"; approvedBy = ""; approvedAt = 0; createdAt = Time.now() }]); true;
  };
  public query func getRegularizationRequests() : async [RegularizationRequest] { regularizationRequests };
  public func approveRegularizationRequest(id : Text, approvedBy : Text) : async Bool {
    var found = false; var empId = ""; var dt = ""; var newSt = "";
    regularizationRequests := Array.map(regularizationRequests, func(r : RegularizationRequest) : RegularizationRequest {
      if (r.id == id and r.approvalStatus == "pending") { found := true; empId := r.employeeId; dt := r.date; newSt := r.requestedStatus; { r with approvalStatus = "approved"; approvedBy = approvedBy; approvedAt = Time.now() } } else r;
    });
    if (found) {
      attendanceV2 := Array.map(attendanceV2, func(a : AttendanceRecord) : AttendanceRecord {
        if (a.employeeId == empId and a.date == dt) { { a with status = newSt; isRegularized = true; changedBy = approvedBy; updatedAt = Time.now() } } else a;
      });
    };
    found;
  };
  public func rejectRegularizationRequest(id : Text, approvedBy : Text) : async Bool {
    var found = false;
    regularizationRequests := Array.map(regularizationRequests, func(r : RegularizationRequest) : RegularizationRequest {
      if (r.id == id and r.approvalStatus == "pending") { found := true; { r with approvalStatus = "rejected"; approvedBy = approvedBy; approvedAt = Time.now() } } else r;
    }); found;
  };

  // ── Advances ──────────────────────────────────────────────────────────

  public func addAdvance(employeeId : Text, amount : Float, date : Text, site : Text) : async Bool {
    advances := Array.append(advances, [{ id = nextId(); employeeId = employeeId; amount = amount; date = date; site = site; createdAt = Time.now() }]); true;
  };
  public query func getAdvancesByEmployee(employeeId : Text) : async [Advance] {
    Array.filter(advances, func(a : Advance) : Bool { a.employeeId == employeeId });
  };

  // ── Audit ─────────────────────────────────────────────────────────────

  public query func getAuditLogs() : async [AuditLog] { auditLogs };

  // ── Payroll ───────────────────────────────────────────────────────────

  func calcPayroll(emp : Employee, month : Nat, year : Nat) : PayrollRecord {
    let prefix = Nat.toText(year) # padMonth(month);
    let attRecs = Array.filter(attendanceV2, func(a : AttendanceRecord) : Bool {
      a.employeeId == emp.id and Text.startsWith(a.date, #text prefix);
    });
    var presentDays : Float = 0; var otTotalHours : Float = 0;
    for (a in attRecs.vals()) {
      if (a.status == "Present") presentDays += 1.0;
      if (a.status == "HalfDay") presentDays += 0.5;
      otTotalHours += a.otHours;
    };
    let totalDays : Float = Float.fromInt(daysInMonth(year, month));
    let ratio = if (totalDays > 0.0) presentDays / totalDays else 0.0;
    let earnedBasic = emp.basicSalary * ratio;
    let earnedHra = if (emp.salaryMode == "auto") { earnedBasic * (if (emp.cityType == "metro") 0.5 else 0.4) } else { emp.hra * ratio };
    let earnedConveyance = emp.conveyance * ratio;
    let earnedSpecial = emp.specialAllowance * ratio;
    let earnedOther = emp.otherAllowance * ratio;
    let otAmount = emp.otRate * otTotalHours;
    let grossPay = earnedBasic + earnedHra + earnedConveyance + earnedSpecial + earnedOther + otAmount;
    let pfDed = if (emp.pfApplicable) earnedBasic * 0.12 else 0.0;
    let esiDed = if (emp.esiApplicable) grossPay * 0.0075 else 0.0;
    { id = nextId(); employeeId = emp.id; month = month; year = year; basicSalary = earnedBasic; hra = earnedHra; conveyance = earnedConveyance; specialAllowance = earnedSpecial; otherAllowance = earnedOther; otAmount = otAmount; grossPay = grossPay; pfDeduction = pfDed; esiDeduction = esiDed; ptDeduction = 0.0; netPay = grossPay - pfDed - esiDed; generatedAt = Time.now() };
  };

  public func generatePayroll(month : Nat, year : Nat, _generatedBy : Text) : async { generatedCount : Nat } {
    var count : Nat = 0;
    for (emp in employeesV2.vals()) {
      if (emp.status == "active") {
        if (Array.find(payrollV3, func(p : PayrollRecord) : Bool { p.employeeId == emp.id and p.month == month and p.year == year }) == null) {
          payrollV3 := Array.append(payrollV3, [calcPayroll(emp, month, year)]); count += 1;
        };
      };
    };
    { generatedCount = count };
  };

  public func overwritePayroll(month : Nat, year : Nat, generatedBy : Text) : async { generatedCount : Nat } {
    payrollV3 := Array.filter(payrollV3, func(p : PayrollRecord) : Bool { not (p.month == month and p.year == year) });
    await generatePayroll(month, year, generatedBy);
  };

  public query func getPayrollByMonth(month : Nat, year : Nat) : async [PayrollRecord] {
    Array.filter(payrollV3, func(p : PayrollRecord) : Bool { p.month == month and p.year == year });
  };

  public query func getPayrollBySite(siteId : Text, month : Nat, year : Nat) : async [PayrollRecord] {
    let siteEmpIds = Array.map(Array.filter(employeesV2, func(e : Employee) : Bool { e.site == siteId }), func(e : Employee) : Text { e.id });
    Array.filter(payrollV3, func(p : PayrollRecord) : Bool {
      p.month == month and p.year == year and Array.find(siteEmpIds, func(id : Text) : Bool { id == p.employeeId }) != null;
    });
  };

  public query func getPayrollSummary(month : Nat, year : Nat) : async PayrollSummary {
    let recs = Array.filter(payrollV3, func(p : PayrollRecord) : Bool { p.month == month and p.year == year });
    var tg : Float = 0; var td : Float = 0; var tn : Float = 0;
    for (r in recs.vals()) { tg += r.grossPay; td += r.pfDeduction + r.esiDeduction + r.ptDeduction; tn += r.netPay; };
    { totalEmployees = recs.size(); totalGross = tg; totalDeductions = td; totalNetPay = tn };
  };

  public query func getPayrollWithBreakdown(month : Nat, year : Nat) : async [PayrollBreakdown] {
    let recs = Array.filter(payrollV3, func(p : PayrollRecord) : Bool { p.month == month and p.year == year });
    let totalDays = daysInMonth(year, month);
    let prefix = Nat.toText(year) # padMonth(month);
    Array.map(recs, func(p : PayrollRecord) : PayrollBreakdown {
      let attRecs = Array.filter(attendanceV2, func(a : AttendanceRecord) : Bool { a.employeeId == p.employeeId and Text.startsWith(a.date, #text prefix) });
      var present : Float = 0; var half : Float = 0; var ot : Float = 0;
      for (a in attRecs.vals()) {
        if (a.status == "Present") present += 1.0;
        if (a.status == "HalfDay") half += 1.0;
        ot += a.otHours;
      };
      let paid = present + half * 0.5;
      let lop = Float.fromInt(totalDays) - paid;
      { record = p; presentDays = present; halfDays = half; lopDays = if (lop > 0.0) lop else 0.0; paidDays = paid; otHours = ot; totalDaysInMonth = totalDays };
    });
  };

  public func setPayrollPT(employeeId : Text, month : Nat, year : Nat, ptAmount : Float) : async Bool {
    var found = false;
    payrollV3 := Array.map(payrollV3, func(p : PayrollRecord) : PayrollRecord {
      if (p.employeeId == employeeId and p.month == month and p.year == year) { found := true; { p with ptDeduction = ptAmount; netPay = p.grossPay - p.pfDeduction - p.esiDeduction - ptAmount } } else p;
    }); found;
  };

  public func manualOverridePayroll(employeeId : Text, month : Nat, year : Nat, basicSalary : Float, hra : Float, conveyance : Float, specialAllowance : Float, otherAllowance : Float, otAmount : Float, pfDeduction : Float, esiDeduction : Float, ptDeduction : Float, netPay : Float, overriddenBy : Text) : async Bool {
    var found = false; var oldVal = "";
    payrollV3 := Array.map(payrollV3, func(p : PayrollRecord) : PayrollRecord {
      if (p.employeeId == employeeId and p.month == month and p.year == year) {
        found := true;
        oldVal := "gross:" # Float.toText(p.grossPay) # "|net:" # Float.toText(p.netPay);
        let gross = basicSalary + hra + conveyance + specialAllowance + otherAllowance + otAmount;
        { p with basicSalary = basicSalary; hra = hra; conveyance = conveyance; specialAllowance = specialAllowance; otherAllowance = otherAllowance; otAmount = otAmount; grossPay = gross; pfDeduction = pfDeduction; esiDeduction = esiDeduction; ptDeduction = ptDeduction; netPay = netPay };
      } else p;
    });
    if (found) { auditLogs := Array.append(auditLogs, [{ id = nextId(); entityType = "payroll"; entityId = employeeId # "-" # Nat.toText(month) # "-" # Nat.toText(year); oldValue = oldVal; newValue = "manual override by " # overriddenBy; changedBy = overriddenBy; timestamp = Time.now(); reason = "Manual override" }]) };
    found;
  };

  // ── Supervisors ───────────────────────────────────────────────────────

  public query func getSupervisors() : async [Supervisor] { supervisorsV2 };
  public func addSupervisor(phone : Text, name : Text, siteId : Text, pin : Text) : async Bool {
    if (Array.find(supervisorsV2, func(s : Supervisor) : Bool { s.phone == phone }) != null) return false;
    supervisorsV2 := Array.append(supervisorsV2, [{ phone = phone; name = name; siteId = siteId; pin = pin; active = true }]); true;
  };
  public func removeSupervisor(phone : Text) : async Bool {
    let before = supervisorsV2.size();
    supervisorsV2 := Array.filter(supervisorsV2, func(s : Supervisor) : Bool { s.phone != phone });
    supervisorsV2.size() < before;
  };
  public query func verifySupervisorPin(phone : Text, pin : Text) : async Bool {
    Array.find(supervisorsV2, func(s : Supervisor) : Bool { s.phone == phone and s.pin == pin and s.active }) != null;
  };

};
