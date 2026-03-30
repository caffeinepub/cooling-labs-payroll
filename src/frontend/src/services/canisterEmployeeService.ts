/**
 * canisterEmployeeService.ts
 * Wraps canister tenant-aware employee methods.
 *
 * KEY FIX: After loading employees from canister, we:
 * 1. Build an oldId→newId remap by matching on employeeId (human code)
 * 2. Remap attendance and payroll localStorage records to use canister IDs
 * 3. Overwrite workforceStorage with canister employees
 *    so payroll engine always uses consistent IDs
 */
import type { Employee } from "../types";
import { backendService } from "./backendService";
import { getActiveCompanyId, getTenantKey } from "./tenantStorage";
import * as workforceStorage from "./workforceStorage";

type TenantEmployeeRaw = Record<string, unknown>;

function mapFromCanister(raw: TenantEmployeeRaw): Employee {
  return {
    id: String(raw.id ?? ""),
    employeeId: String(raw.employeeId ?? ""),
    name: String(raw.name ?? ""),
    mobile: String(raw.mobile ?? ""),
    site: String(raw.site ?? ""),
    tradeId: String(raw.tradeId ?? ""),
    departmentId: String(raw.departmentId ?? ""),
    status: String(raw.status ?? "active"),
    salaryMode: String(raw.salaryMode ?? "auto"),
    cityType: String(raw.cityType ?? "non-metro"),
    basicSalary: Number(raw.basicSalary ?? 0),
    hra: Number(raw.hra ?? 0),
    conveyance: Number(raw.conveyance ?? 0),
    specialAllowance: Number(raw.specialAllowance ?? 0),
    otherAllowance: Number(raw.otherAllowance ?? 0),
    otRate: Number(raw.otRate ?? 0),
    pfApplicable: Boolean(raw.pfApplicable),
    esiApplicable: Boolean(raw.esiApplicable),
    aadhaarNumber: String(raw.aadhaarNumber ?? ""),
    panNumber: String(raw.panNumber ?? ""),
    uanNumber: String(raw.uanNumber ?? ""),
    esiNumber: String(raw.esiNumber ?? ""),
    bankAccountHolderName: String(raw.bankAccountHolderName ?? ""),
    bankAccountNumber: String(raw.bankAccountNumber ?? ""),
    ifscCode: String(raw.ifscCode ?? ""),
    bankName: String(raw.bankName ?? ""),
    branchAddress: String(raw.branchAddress ?? ""),
    dateOfJoining: String(raw.dateOfJoining ?? ""),
    createdAt: BigInt(
      typeof raw.createdAt === "bigint"
        ? raw.createdAt
        : ((raw.createdAt as number) ?? 0),
    ),
  };
}

function mapToCanister(emp: Employee, companyCode: string): TenantEmployeeRaw {
  return {
    id: emp.id,
    companyCode,
    employeeId: emp.employeeId,
    name: emp.name,
    mobile: emp.mobile,
    site: emp.site,
    tradeId: emp.tradeId,
    departmentId: emp.departmentId,
    status: emp.status,
    salaryMode: emp.salaryMode ?? "auto",
    cityType: emp.cityType ?? "non-metro",
    basicSalary: emp.basicSalary,
    hra: emp.hra ?? 0,
    conveyance: emp.conveyance ?? 0,
    specialAllowance: emp.specialAllowance ?? 0,
    otherAllowance: emp.otherAllowance ?? 0,
    otRate: emp.otRate ?? 0,
    pfApplicable: emp.pfApplicable,
    esiApplicable: emp.esiApplicable,
    aadhaarNumber: emp.aadhaarNumber ?? "",
    panNumber: emp.panNumber ?? "",
    uanNumber: emp.uanNumber ?? "",
    esiNumber: emp.esiNumber ?? "",
    bankAccountHolderName: emp.bankAccountHolderName ?? "",
    bankAccountNumber: emp.bankAccountNumber ?? "",
    ifscCode: emp.ifscCode ?? "",
    bankName: emp.bankName ?? "",
    branchAddress: emp.branchAddress ?? "",
    dateOfJoining: emp.dateOfJoining ?? "",
    createdAt: emp.createdAt ?? BigInt(0),
  };
}

/**
 * Overwrite workforceStorage with canister employees so that payroll engine,
 * which calls workforceStorage.getEmployees(), always uses canister-consistent IDs.
 */
function seedWorkforceStorage(employees: Employee[]): void {
  const companyCode = getActiveCompanyId();
  const key = getTenantKey(companyCode, "clf_employees");
  try {
    const raw = employees.map((e) => ({
      ...e,
      createdAt: Number(e.createdAt),
    }));
    localStorage.setItem(key, JSON.stringify(raw));
  } catch (e) {
    console.warn("[CanisterEmp] Failed to seed workforceStorage:", e);
  }
}

/**
 * After loading canister employees, build a remapping from any old localStorage
 * employee IDs to the canister IDs by matching on the human-readable employeeId
 * (e.g. EMP001). Then remap attendance and payroll records in localStorage so
 * payroll calculation finds the correct attendance and displays correct names.
 */
function remapStorageIds(
  canisterEmployees: Employee[],
  localEmployees: Employee[],
): void {
  const companyCode = getActiveCompanyId();

  // Build old-ID → new-ID map by matching on employeeId (human code)
  const idMap: Record<string, string> = {};
  for (const le of localEmployees) {
    const ce = canisterEmployees.find(
      (c) => c.employeeId === le.employeeId && c.id !== le.id,
    );
    if (ce) {
      idMap[le.id] = ce.id;
    }
  }

  if (Object.keys(idMap).length === 0) return;
  console.log(
    "[CanisterEmp] Remapping IDs in localStorage:",
    Object.keys(idMap).length,
    "employee ID changes",
  );

  // Remap attendance records
  const attKey = getTenantKey(companyCode, "clf_attendance");
  try {
    const raw = localStorage.getItem(attKey);
    if (raw) {
      const records = JSON.parse(raw);
      const remapped = records.map((r: Record<string, unknown>) => ({
        ...r,
        employeeId: idMap[String(r.employeeId)] ?? r.employeeId,
      }));
      localStorage.setItem(attKey, JSON.stringify(remapped));
      console.log(
        "[CanisterEmp] Remapped",
        records.length,
        "attendance records",
      );
    }
  } catch (e) {
    console.warn("[CanisterEmp] Attendance remap failed:", e);
  }

  // Remap payroll records
  const payrollKey = getTenantKey(companyCode, "clf_payroll");
  try {
    const raw = localStorage.getItem(payrollKey);
    if (raw) {
      const records = JSON.parse(raw);
      const remapped = records.map((r: Record<string, unknown>) => ({
        ...r,
        employeeId: idMap[String(r.employeeId)] ?? r.employeeId,
      }));
      localStorage.setItem(payrollKey, JSON.stringify(remapped));
      console.log("[CanisterEmp] Remapped", records.length, "payroll records");
    }
  } catch (e) {
    console.warn("[CanisterEmp] Payroll remap failed:", e);
  }
}

export async function loadEmployeesFromCanister(): Promise<{
  allEmployees: Employee[];
  activeEmployees: Employee[];
  source: "canister" | "local";
}> {
  const companyCode = getActiveCompanyId();
  try {
    const result = (await backendService.getEmployeesByCompany(
      companyCode,
    )) as {
      allEmployees: TenantEmployeeRaw[];
      activeEmployees: TenantEmployeeRaw[];
    };
    const all = (result.allEmployees ?? []).map(mapFromCanister);
    const active = (result.activeEmployees ?? []).map(mapFromCanister);

    if (all.length > 0) {
      console.log(
        "[CanisterEmp] Loaded",
        all.length,
        "employees from canister for",
        companyCode,
      );

      // Get local employees BEFORE overwriting, for ID remapping
      const localEmployees = workforceStorage.getEmployees().allEmployees;

      // Remap attendance + payroll records to use canister IDs
      remapStorageIds(all, localEmployees);

      // Overwrite workforceStorage with canister employees so payroll engine uses correct IDs
      seedWorkforceStorage(all);

      return { allEmployees: all, activeEmployees: active, source: "canister" };
    }

    // Canister has no employees — attempt one-time migration from localStorage
    const local = workforceStorage.getEmployees();
    if (local.allEmployees.length > 0) {
      console.log(
        "[CanisterEmp] Migrating",
        local.allEmployees.length,
        "employees from localStorage to canister...",
      );
      for (const emp of local.allEmployees) {
        try {
          await backendService.createEmployeeForCompany(
            companyCode,
            mapToCanister(emp, companyCode),
          );
        } catch (e) {
          console.warn("[CanisterEmp] Migration failed for", emp.employeeId, e);
        }
      }
      // Re-fetch from canister after migration
      const afterMigration = (await backendService.getEmployeesByCompany(
        companyCode,
      )) as {
        allEmployees: TenantEmployeeRaw[];
        activeEmployees: TenantEmployeeRaw[];
      };
      const allAfter = (afterMigration.allEmployees ?? []).map(mapFromCanister);
      const activeAfter = (afterMigration.activeEmployees ?? []).map(
        mapFromCanister,
      );

      // After migration, IDs may have changed — remap stored data
      remapStorageIds(allAfter, local.allEmployees);
      seedWorkforceStorage(allAfter);

      console.log(
        "[CanisterEmp] After migration:",
        allAfter.length,
        "employees in canister",
      );
      return {
        allEmployees: allAfter,
        activeEmployees: activeAfter,
        source: "canister",
      };
    }

    return { allEmployees: [], activeEmployees: [], source: "canister" };
  } catch (err) {
    console.warn(
      "[CanisterEmp] Canister load failed, falling back to localStorage:",
      err,
    );
    const local = workforceStorage.getEmployees();
    return { ...local, source: "local" };
  }
}

export async function createEmployeeInCanister(
  emp: Omit<Employee, "id"> & { id?: string },
): Promise<{ success: boolean; source: "canister" | "local" }> {
  const companyCode = getActiveCompanyId();
  // Always write to localStorage as backup
  const localOk = workforceStorage.createEmployee(emp);
  try {
    // Use the id assigned by localStorage (from nextId()), or empty for canister to assign
    const empWithId: Employee = {
      ...(emp as Employee),
      id: emp.id ?? "",
      createdAt: emp.createdAt ?? BigInt(0),
    };
    await backendService.createEmployeeForCompany(
      companyCode,
      mapToCanister(empWithId, companyCode),
    );
    return { success: localOk, source: "canister" };
  } catch (err) {
    console.warn(
      "[CanisterEmp] Canister create failed, using localStorage only:",
      err,
    );
    return { success: localOk, source: "local" };
  }
}

export async function updateEmployeeInCanister(
  id: string,
  emp: Partial<Employee>,
): Promise<{ success: boolean; source: "canister" | "local" }> {
  const companyCode = getActiveCompanyId();
  // Always write to localStorage as backup
  const localOk = workforceStorage.updateEmployee(id, emp);
  try {
    const current = workforceStorage
      .getEmployees()
      .allEmployees.find((e) => e.id === id);
    if (current) {
      const merged: Employee = { ...current, ...emp, id };
      await backendService.updateEmployeeForCompany(
        companyCode,
        id,
        mapToCanister(merged, companyCode),
      );
    }
    return { success: localOk, source: "canister" };
  } catch (err) {
    console.warn(
      "[CanisterEmp] Canister update failed, using localStorage only:",
      err,
    );
    return { success: localOk, source: "local" };
  }
}
