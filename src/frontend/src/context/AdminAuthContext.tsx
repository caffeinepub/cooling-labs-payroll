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
  getCompanySessionCached,
  loginCompanyCanister,
  logoutCompany,
  validateCompanySession,
} from "../services/canisterAuthService";
import {
  getCompanyByCode,
  getCompanySession as localGetCompanySession,
  setCompanySession as localSetCompanySession,
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
  activeCompanyCode: string;
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
  activeCompanyCode: "COOLABS",
});

const SESSION_KEY = "clf_session";

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [adminLoggedIn, setAdminLoggedIn] = useState(() => {
    // Check canister session cache or legacy
    const cached = getCompanySessionCached();
    if (cached) return true;
    const local = localGetCompanySession();
    if (local && local.role === "company_admin") return true;
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
    const cached = getCompanySessionCached();
    if (cached) return cached.username || "Administrator";
    const local = localGetCompanySession();
    if (local) return local.username || "Administrator";
    return localStorage.getItem("adminName") || "Administrator";
  });

  const [activeCompanyCode, setActiveCompanyCode] = useState(() => {
    const cached = getCompanySessionCached();
    if (cached) return cached.companyCode;
    const local = localGetCompanySession();
    if (local) return local.companyCode;
    return "COOLABS";
  });

  // On mount: validate existing canister session (async)
  // biome-ignore lint/correctness/useExhaustiveDependencies: run only on mount
  useEffect(() => {
    if (!adminLoggedIn) return;
    validateCompanySession()
      .then((s) => {
        if (s) {
          setActiveCompanyCode(s.companyCode);
          setAdminName(s.username);
        } else {
          // Session expired on canister
          const local = localGetCompanySession();
          if (!local) {
            setAdminLoggedIn(false);
            setSession(null);
          }
        }
      })
      .catch(() => {
        // Canister unreachable; keep cached state
      });
  }, []);

  const login = useCallback(
    async (
      companyCode: string,
      username: string,
      password: string,
    ): Promise<boolean> => {
      setLoggingIn(true);
      try {
        const result = await loginCompanyCanister(
          companyCode.trim().toUpperCase(),
          username.trim(),
          password,
        );
        if (!result.success || !result.session) return false;

        const user: SessionUser = { role: "admin", name: username };
        localStorage.setItem("adminLoggedIn", "true");
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
        setAdminLoggedIn(true);
        setSession(user);
        setAdminName(username);
        setActiveCompanyCode(result.session.companyCode);
        console.log(
          `[Auth] Logged in via ${result.source}: ${result.session.companyCode}`,
        );
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
    // Keep company session in sync for tenant-awareness
    const existing = localGetCompanySession();
    if (existing) {
      localSetCompanySession({
        ...existing,
        role: "supervisor",
        username: user.username || user.name,
        siteId: user.siteId,
      });
    }
  }, []);

  const logout = useCallback(async () => {
    await logoutCompany();
    localStorage.removeItem("adminLoggedIn");
    localStorage.removeItem(SESSION_KEY);
    setAdminLoggedIn(false);
    setSession(null);
    setActiveCompanyCode("COOLABS");
  }, []);

  const changePassword = useCallback(
    async (oldPw: string, newPw: string): Promise<boolean> => {
      const cached = getCompanySessionCached();
      if (!cached) return false;
      const company = getCompanyByCode(cached.companyCode);
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
        activeCompanyCode,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}
