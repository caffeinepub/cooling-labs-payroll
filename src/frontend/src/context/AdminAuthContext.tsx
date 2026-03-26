import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  clearCompanySession,
  getCompanyByCode,
  getCompanySession,
  loginCompany,
  setCompanySession,
  updateCompany,
} from "../services/tenantStorage";

export type SessionRole = "admin" | "supervisor" | null;

interface SessionUser {
  role: SessionRole;
  name: string;
  phone?: string;
  siteId?: string;
  username?: string;
}

interface AdminAuthContextType {
  adminLoggedIn: boolean;
  session: SessionUser | null;
  loggingIn: boolean;
  login: (
    companyCode: string,
    username: string,
    password: string,
  ) => Promise<boolean>;
  loginSupervisor: (user: SessionUser) => void;
  logout: () => void;
  changePassword: (oldPw: string, newPw: string) => Promise<boolean>;
  updateAdminProfile: (name: string) => void;
  adminName: string;
}

const AdminAuthContext = createContext<AdminAuthContextType>({
  adminLoggedIn: false,
  session: null,
  loggingIn: false,
  login: async () => false,
  loginSupervisor: () => {},
  logout: () => {},
  changePassword: async () => false,
  updateAdminProfile: () => {},
  adminName: "Administrator",
});

const SESSION_KEY = "clf_session";

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [adminLoggedIn, setAdminLoggedIn] = useState(() => {
    // Check both legacy key and new tenant session
    const companySession = getCompanySession();
    if (companySession && companySession.role === "company_admin") return true;
    return localStorage.getItem("adminLoggedIn") === "true";
  });
  const [session, setSession] = useState<SessionUser | null>(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as SessionUser) : null;
    } catch {
      return null;
    }
  });
  const [loggingIn, setLoggingIn] = useState(false);
  const [adminName, setAdminName] = useState(() => {
    const companySession = getCompanySession();
    if (companySession) return companySession.username || "Administrator";
    return localStorage.getItem("adminName") || "Administrator";
  });

  // Sync adminLoggedIn from session on mount
  useEffect(() => {
    if (session?.role === "admin") {
      setAdminLoggedIn(true);
    }
  }, [session]);

  const login = useCallback(
    async (
      companyCode: string,
      username: string,
      password: string,
    ): Promise<boolean> => {
      setLoggingIn(true);
      try {
        const companySession = loginCompany(companyCode, username, password);
        if (!companySession) return false;
        const user: SessionUser = { role: "admin", name: username };
        localStorage.setItem("adminLoggedIn", "true");
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
        setAdminLoggedIn(true);
        setSession(user);
        setAdminName(username);
        return true;
      } finally {
        setLoggingIn(false);
      }
    },
    [],
  );

  const loginSupervisor = useCallback((user: SessionUser) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    setSession(user);
    // Also store in company session for tenant-awareness
    const existing = getCompanySession();
    if (existing) {
      setCompanySession({
        ...existing,
        role: "supervisor",
        username: user.username || user.name,
        siteId: user.siteId,
      });
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("adminLoggedIn");
    localStorage.removeItem(SESSION_KEY);
    clearCompanySession();
    setAdminLoggedIn(false);
    setSession(null);
  }, []);

  const changePassword = useCallback(
    async (oldPw: string, newPw: string): Promise<boolean> => {
      const companySession = getCompanySession();
      if (!companySession) return false;
      const company = getCompanyByCode(companySession.companyCode);
      if (!company) return false;
      if (company.adminPassword !== oldPw) return false;
      updateCompany(company.id, { adminPassword: newPw });
      return true;
    },
    [],
  );

  const updateAdminProfile = useCallback(
    (name: string) => {
      localStorage.setItem("adminName", name);
      setAdminName(name);
      const current = session;
      if (current?.role === "admin") {
        const updated = { ...current, name };
        localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
        setSession(updated);
      }
    },
    [session],
  );

  return (
    <AdminAuthContext.Provider
      value={{
        adminLoggedIn,
        session,
        loggingIn,
        login,
        loginSupervisor,
        logout,
        changePassword,
        updateAdminProfile,
        adminName,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}
