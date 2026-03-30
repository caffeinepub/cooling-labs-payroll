# HumanskeyAI — Critical Fix + Super Admin SaaS Upgrade

## Current State

HumanskeyAI is a multi-tenant SaaS workforce/payroll platform. Backend is Motoko canister (ICP). Core modules (employees, attendance, payroll) are canister-backed. Authentication uses canister-issued session tokens.

Known problems:
1. `canisterAuthService.loginCompanyCanister` falls through to localStorage auth when canister returns `success:false` — this means wrong-browser credentials can still log in via stale local data, and cross-browser consistency breaks.
2. `Company` type lacks `notes` and `updatedAt` fields — no proper edit tracking.
3. `getPlatformStats` uses `employeesV2.size()` (legacy global employees) instead of `tenantEmployees.size()` — cross-tenant stats are wrong.
4. Super Admin panel is basic — no rich dashboard, no tenant summary, no platform settings, no notes/edit tracking.
5. `updateCompany` does not accept or persist `notes`.

## Requested Changes (Diff)

### Add
- `CompanyFull` type in Motoko with `notes: Text` and `updatedAt: Int` fields
- `stable var companiesFull: [CompanyFull]` with migration from old `companies: [Company]`
- `getTenantSummary(companyCode)` canister query — returns employee/attendance/payroll counts per company
- `getPlatformStats` extended: adds `trialCompanies`, `paidCompanies`, `totalUsers` and uses `tenantEmployees.size()`
- New `PlatformSettings.tsx` Super Admin page with default module config, default plan, branding defaults
- Super Admin Dashboard: 8 stat cards, recent tenants table, quick action cards
- Companies page: full edit panel with all fields including notes/remarks, password reset action, tenant summary modal, status/plan badges, created/updated dates

### Modify
- `updateCompany` Motoko: accept `notes` param, set `updatedAt = Time.now()` on save
- `bootstrapDefaultCompanies` → `bootstrapDefaultCompaniesFull()` using new `CompanyFull` type
- `loginCompany` Motoko: use `companiesFull` instead of `companies`
- `canisterAuthService.loginCompanyCanister`: ONLY fall back to local on thrown exception (canister unreachable), NOT on `success:false` return — this is the root cross-browser auth bug
- `canisterAuthService.loginSuperAdminCanister`: same fix — no local fallback on `success:false`
- `tenantStorage.ts` Company interface: add `notes?`, `updatedAt?` fields
- `backend.d.ts` Company interface: add `notes`, `updatedAt` fields; update `updateCompany` signature; add `getTenantSummary`
- `canisterCompanyService.ts`: update mappers and function signatures for new fields
- `SuperAdminDashboard.tsx`: canister-backed stats, rich layout
- `Companies.tsx`: full-featured edit panel, tenant summary view, all company actions
- `App.tsx`: add platform settings route

### Remove
- Local auth fallback on `success:false` responses (keep only for thrown errors)
- Platform stats reading from localStorage (use canister exclusively)

## Implementation Plan

1. Update `src/backend/main.mo`: Add CompanyFull type, stable var, migration, update all company functions, fix stats, add getTenantSummary
2. Update `src/frontend/src/backend.d.ts`: new Company fields, new method signatures
3. Update `src/frontend/src/services/canisterAuthService.ts`: fix fallback bug
4. Update `src/frontend/src/services/canisterCompanyService.ts`: map new fields, update call signatures
5. Update `src/frontend/src/services/tenantStorage.ts`: add notes/updatedAt to Company interface
6. Frontend Super Admin upgrade: Dashboard, Companies, PlatformSettings, routing
