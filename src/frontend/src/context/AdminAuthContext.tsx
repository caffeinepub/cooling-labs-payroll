import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

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
  login: (password: string) => Promise<boolean>;
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

const LOGGED_IN_KEY = "adminLoggedIn";
const PASSWORD_KEY = "adminPassword";
const ADMIN_NAME_KEY = "adminName";
const SESSION_KEY = "clf_session";
const DEFAULT_PASSWORD = "admin123";

function getStoredPassword(): string {
  return localStorage.getItem(PASSWORD_KEY) || DEFAULT_PASSWORD;
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [adminLoggedIn, setAdminLoggedIn] = useState(() => {
    return localStorage.getItem(LOGGED_IN_KEY) === "true";
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
    return localStorage.getItem(ADMIN_NAME_KEY) || "Administrator";
  });

  // Sync adminLoggedIn from session on mount
  useEffect(() => {
    if (session?.role === "admin") {
      setAdminLoggedIn(true);
    }
  }, [session]);

  const login = useCallback(async (password: string): Promise<boolean> => {
    setLoggingIn(true);
    try {
      const stored = getStoredPassword();
      if (password === stored) {
        const name = localStorage.getItem(ADMIN_NAME_KEY) || "Administrator";
        const user: SessionUser = { role: "admin", name };
        localStorage.setItem(LOGGED_IN_KEY, "true");
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
        setAdminLoggedIn(true);
        setSession(user);
        return true;
      }
      return false;
    } finally {
      setLoggingIn(false);
    }
  }, []);

  const loginSupervisor = useCallback((user: SessionUser) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    setSession(user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(LOGGED_IN_KEY);
    localStorage.removeItem(SESSION_KEY);
    setAdminLoggedIn(false);
    setSession(null);
  }, []);

  const changePassword = useCallback(
    async (oldPw: string, newPw: string): Promise<boolean> => {
      const stored = getStoredPassword();
      if (oldPw !== stored) return false;
      localStorage.setItem(PASSWORD_KEY, newPw);
      return true;
    },
    [],
  );

  const updateAdminProfile = useCallback(
    (name: string) => {
      localStorage.setItem(ADMIN_NAME_KEY, name);
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
