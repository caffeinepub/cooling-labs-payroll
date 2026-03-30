import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { syncAttendanceFromCanister } from "../services/canisterAttendanceService";
import { loadEmployeesFromCanister } from "../services/canisterEmployeeService";
import { syncPayrollFromCanister } from "../services/canisterPayrollService";
import * as mastersStorage from "../services/mastersStorage";
import * as workforceStorage from "../services/workforceStorage";
import type { Department, Employee, Site, Supervisor, Trade } from "../types";
import { useAdminAuth } from "./AdminAuthContext";

interface AppContextType {
  employees: Employee[];
  activeEmployees: Employee[];
  trades: Trade[];
  activeTrades: Trade[];
  departments: Department[];
  activeDepartments: Department[];
  sites: Site[];
  activeSites: Site[];
  supervisors: Supervisor[];
  isAdmin: boolean;
  loading: boolean;
  attendanceSynced: boolean;
  refreshEmployees: () => Promise<void>;
  refreshAttendance: () => Promise<void>;
  refreshTrades: () => void;
  refreshDepartments: () => void;
  refreshSites: () => void;
  refreshSupervisors: () => Promise<void>;
}

const AppContext = createContext<AppContextType>({
  employees: [],
  activeEmployees: [],
  trades: [],
  activeTrades: [],
  departments: [],
  activeDepartments: [],
  sites: [],
  activeSites: [],
  supervisors: [],
  isAdmin: false,
  loading: true,
  attendanceSynced: false,
  refreshEmployees: async () => {},
  refreshAttendance: async () => {},
  refreshTrades: () => {},
  refreshDepartments: () => {},
  refreshSites: () => {},
  refreshSupervisors: async () => {},
});

export function AppContextProvider({
  children,
}: { children: React.ReactNode }) {
  const { adminLoggedIn } = useAdminAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeEmployees, setActiveEmployees] = useState<Employee[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [activeTrades, setActiveTrades] = useState<Trade[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [activeDepartments, setActiveDepartments] = useState<Department[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [activeSites, setActiveSites] = useState<Site[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [loading, setLoading] = useState(true);
  const [attendanceSynced, setAttendanceSynced] = useState(false);

  const refreshEmployees = useCallback(async () => {
    try {
      const result = await loadEmployeesFromCanister();
      setEmployees(result.allEmployees);
      setActiveEmployees(result.activeEmployees);
    } catch {
      const result = workforceStorage.getEmployees();
      setEmployees(result.allEmployees);
      setActiveEmployees(result.activeEmployees);
    }
  }, []);

  const refreshAttendance = useCallback(async () => {
    try {
      setAttendanceSynced(false);
      const result = await syncAttendanceFromCanister();
      // Sync payroll BEFORE setting attendanceSynced=true so Payroll.tsx reads
      // from a fully-populated localStorage, not an empty one.
      await syncPayrollFromCanister();
      setAttendanceSynced(true);
      console.log(
        `[AppContext] Attendance synced: ${result.count} records from ${result.source}`,
      );
    } catch (e) {
      console.warn("[AppContext] Attendance sync failed:", e);
      // Still mark as synced so the UI doesn't hang, but payroll will
      // handle its own error state when it tries to fetch directly.
      setAttendanceSynced(true);
    }
  }, []);

  const refreshTrades = useCallback(() => {
    const result = mastersStorage.getTrades();
    setTrades(result.trades);
    setActiveTrades(result.activeTrades);
  }, []);

  const refreshDepartments = useCallback(() => {
    const result = mastersStorage.getDepartments();
    setDepartments(result.departments);
    setActiveDepartments(result.activeDepartments);
  }, []);

  const refreshSites = useCallback(() => {
    const result = mastersStorage.getSites();
    setSites(result.sites);
    setActiveSites(result.activeSites);
  }, []);

  const refreshSupervisors = useCallback(async () => {
    setSupervisors(workforceStorage.getSupervisors());
  }, []);

  useEffect(() => {
    if (!adminLoggedIn) {
      setAttendanceSynced(false);
      setEmployees([]);
      setActiveEmployees([]);
      return;
    }

    setLoading(true);
    // Load masters from localStorage (no canister backing yet)
    refreshTrades();
    refreshDepartments();
    refreshSites();
    void refreshSupervisors();

    // Sequentially await canister calls so data is populated BEFORE loading=false
    const initialize = async () => {
      try {
        await refreshEmployees();
        await refreshAttendance(); // awaits both attendance AND payroll sync before setting attendanceSynced=true
      } catch (e) {
        console.warn("[AppContext] Initialization error:", e);
      } finally {
        setLoading(false);
      }
    };
    void initialize();
  }, [
    adminLoggedIn,
    refreshEmployees,
    refreshAttendance,
    refreshTrades,
    refreshDepartments,
    refreshSites,
    refreshSupervisors,
  ]);

  return (
    <AppContext.Provider
      value={{
        employees,
        activeEmployees,
        trades,
        activeTrades,
        departments,
        activeDepartments,
        sites,
        activeSites,
        supervisors,
        isAdmin: adminLoggedIn,
        loading,
        attendanceSynced,
        refreshEmployees,
        refreshAttendance,
        refreshTrades,
        refreshDepartments,
        refreshSites,
        refreshSupervisors,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}

export const AppProvider = AppContextProvider;
