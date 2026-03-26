/**
 * canisterEmployeeService.ts
 * Wraps canister tenant-aware employee methods with localStorage fallback.
 */
import type { Employee } from "../types";
import { backendService } from "./backendService";
import { getActiveCompanyId } from "./tenantStorage";
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
