import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
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
  refreshEmployees: () => Promise<void>;
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
  refreshEmployees: async () => {},
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

  const refreshEmployees = useCallback(async () => {
    const result = workforceStorage.getEmployees();
    setEmployees(result.allEmployees);
    setActiveEmployees(result.activeEmployees);
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
    setLoading(true);
    refreshTrades();
    refreshDepartments();
    refreshSites();
    void refreshEmployees();
    void refreshSupervisors();
    setLoading(false);
  }, [
    refreshEmployees,
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
        refreshEmployees,
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
