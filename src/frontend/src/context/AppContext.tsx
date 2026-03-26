import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
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

export function AppProvider({ children }: { children: ReactNode }) {
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
      setAttendanceSynced(true);
      void syncPayrollFromCanister();
      console.log(
        `[AppContext] Attendance synced: ${result.count} records from ${result.source}`,
      );
    } catch (e) {
      console.warn("[AppContext] Attendance sync failed:", e);
      setAttendanceSynced(true); // Don't block UI
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
      return;
    }
    setLoading(true);
    refreshTrades();
    refreshDepartments();
    refreshSites();
    void refreshEmployees();
    void refreshSupervisors();
    // Sync attendance from canister — seeds localStorage so all pages have fresh data
    void refreshAttendance();
    setLoading(false);
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
