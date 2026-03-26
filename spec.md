# HumanskeyAI — Step 5: Payroll Backend Migration

## Current State
- Employees: backed by ICP canister (canisterEmployeeService.ts)
- Attendance: backed by ICP canister (canisterAttendanceService.ts), synced to localStorage on login
- Payroll: **localStorage only** — does not persist across browsers/devices
- Payroll calculation formula: correct (paidDays/totalDaysInMonth) already in payrollStorage.ts
- Dashboard reads payroll from localStorage

## Requested Changes (Diff)

### Add
- `TenantPayrollRecord` type in Motoko with companyCode + all earned/deduction/breakdown fields
- `tenantPayroll` stable var in canister
- 3 new canister methods: `getPayrollByCompanyAndMonth`, `savePayrollForCompany`, `deletePayrollForCompanyAndMonth`
- `canisterPayrollService.ts`: sync, generate, overwrite backed by canister
- `TenantPayrollRecord` interface in backend.d.ts
- Payroll sync in AppContext on login (alongside employee/attendance sync)

### Modify
- `Payroll.tsx`: generate/overwrite calls become async, routed through canisterPayrollService
- `payrollStorage.ts`: export `loadAllRawForMonth` helper for canister sync
- `backend.d.ts`: add new payroll canister method signatures
- `AppContext.tsx`: call syncPayrollFromCanister on login

### Remove
- Nothing removed — localStorage remains as fast read cache

## Implementation Plan
1. Add TenantPayrollRecord type + stable var + 3 methods to main.mo
2. Add types and method signatures to backend.d.ts
3. Create canisterPayrollService.ts:
   - syncPayrollFromCanister(): fetch from canister → overwrite localStorage payroll key
   - generateAndSavePayroll(month, year): run existing computation, read resulting records from localStorage, bulk-save to canister
   - overwriteAndSavePayroll(month, year): delete from canister, run overwrite computation, bulk-save to canister
4. Update Payroll.tsx: wrap generate/overwrite with async canister service calls
5. Update AppContext: add syncPayrollFromCanister call on login
6. Payroll formula validation: confirm earned = (monthly/totalDays) × paidDays applied correctly
