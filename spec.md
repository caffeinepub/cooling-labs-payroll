# Cooling Labs Payroll — Regularization Engine Upgrade

## Current State

The Regularization module (`pages/attendance/Regularization.tsx`) currently:
- Only supports status correction (old/new status dropdown)
- Has a basic request list with no OT/Advance fields visible
- Has no auto-fetch of current attendance values when employee+date is selected
- Approve/Reject buttons have no remark dialog
- On approval: `regularizationStorage.approveRegularizationRequest` updates the attendance record but does NOT update any existing saved payroll record for that month
- No "recalculation needed" indicator when payroll has already been generated for the month
- Audit trail exists but is not comprehensive (no old/new OT/advance values)

The `regularizationStorage.ts` already accepts `opts.oldOtHours`, `opts.newOtHours`, `opts.oldAdvance`, `opts.newAdvance`, `opts.requestType` — but the UI never uses them.

`attendanceStorage.ts` has `updateAttendanceAdvance`, `updateAttendanceOT`, `regularizeAttendance` — all working.

`payrollStorage.ts` has `overwritePayroll` (regenerate) and `setAdvanceDeduction`, `manualOverridePayroll` — these must be called after approval to sync payroll.

## Requested Changes (Diff)

### Add
- Request type selector: Status Only / OT Only / Advance Only / Combined
- OT fields: Old OT Hours, New OT Hours (shown when type includes OT)
- Advance fields: Old Advance, New Advance (shown when type includes Advance)
- Auto-fetch current attendance values (status, OT, advance) when employee + date is selected
- Approve-with-remark dialog (modal with text input before confirming approve)
- Reject-with-remark dialog (modal with text input before confirming reject)
- "Recalculation Needed" badge on approved requests when payroll already exists for that month
- Visible OT/Advance correction badges in the request list rows
- Duplicate pending request guard: block submission if pending request exists for same employee+date+type
- Payroll live update on approval: after updating attendance record, also update the saved payroll record (if it exists) using `setAdvanceDeduction` / `updateAttendanceOT` and recompute via `overwritePayroll` for that employee/month
- Enhanced audit trail: log old+new values for status, OT, and advance separately

### Modify
- `Regularization.tsx`: expand create form with request type + conditional OT/Advance fields, auto-fetch, improved request table with OT/Advance visibility
- `regularizationStorage.ts` → `approveRegularizationRequest`: after updating attendance, also call payroll sync to update saved payroll record
- Approve/Reject handlers: open remark dialog instead of firing immediately
- Request table: show OT and Advance columns, colour-code by correction type

### Remove
- Nothing removed; backward compat maintained

## Implementation Plan

1. Add `syncPayrollAfterApproval(employeeId, date)` helper in `regularizationStorage.ts` that:
   - Reads the attendance record after update
   - Reads payroll record for that employee/month via `getPayrollWithBreakdown`
   - If payroll exists, calls `overwritePayroll` for that month/year to regenerate from latest attendance
   - Returns whether payroll existed (for UI badge)

2. Update `approveRegularizationRequest` to call this helper and return `{ payrollUpdated: boolean }`

3. Rebuild `Regularization.tsx`:
   - Request type enum: `status | ot | advance | combined`
   - Show OT fields only when type includes OT; Advance fields only when type includes Advance
   - On employee+date change: auto-look up attendance record and populate Old Status, Old OT, Old Advance
   - Submission validation: require at least one actual change; block if no change detected
   - Duplicate pending block: check existing pending requests for same emp+date+type
   - Request table: add OT Hrs (old→new) and Advance (old→new) columns with type badges
   - Approve button → opens ApproveRemarkDialog; Reject button → opens RejectRemarkDialog
   - On approval, if payroll was updated show toast with "Payroll recalculated" note
   - Audit log section: show all fields including OT and Advance old/new
