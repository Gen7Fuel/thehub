import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { authService } from "@/api/auth/auth.service";
import { isApiError } from "@/api/core/errors";

interface PermissionNode {
  name: string;
  value: boolean;
  children?: PermissionNode[];
}

interface User {
  id?: string;
  email?: string;
  location?: string;
  initials?: string;
  name?: string;
  timezone?: string | null;
  access?: Record<string, any>;
}

interface Session extends Omit<User, "access"> {
  id: string;
  permissions: PermissionNode[];
  site_access?: Record<string, unknown> | null;
}

function flattenPermissions(nodes: PermissionNode[]): Record<string, any> {
  return Object.fromEntries(nodes.map(({ name, value, children }) => [
    name,
    children?.length ? { ...flattenPermissions(children), value: !!value } : !!value,
  ]));
}

function userFromSession({ permissions, site_access, ...profile }: Session): User {
  const access = flattenPermissions(permissions);
  const siteAccess = { ...site_access };
  access.site_access = siteAccess;
  for (const [key, value] of Object.entries(siteAccess)) {
    access[`site_access.${key}`] = value;
  }
  return { ...profile, access };
}

interface AuthContextType {
  user: User | null;
  refreshAuth: () => Promise<void>;
  clearSession: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => !!localStorage.getItem("token"));
  const [loadFailed, setLoadFailed] = useState(false);
  const requestVersion = useRef(0);
  const didLoad = useRef(false);

  const clearSession = useCallback(() => {
    requestVersion.current += 1;
    localStorage.removeItem("token");
    setUser(null);
  }, []);

  const refreshAuth = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      clearSession();
      return;
    }

    const version = ++requestVersion.current;
    const isCurrent = () => version === requestVersion.current && localStorage.getItem("token") === token;
    try {
      const session = await authService.getSession<Session>();
      if (!isCurrent()) return;

      setUser(userFromSession(session));
    } catch (error) {
      if (!isCurrent()) return;
      if (isApiError(error) && (error.status === 401 || error.status === 403 || error.status === 431)) {
        clearSession();
      }
      throw error;
    }
  }, [clearSession]);

  const loadSession = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      await refreshAuth();
    } catch {
      setLoadFailed(!!localStorage.getItem("token"));
    } finally {
      setLoading(false);
    }
  }, [refreshAuth]);

  useEffect(() => {
    if (didLoad.current) return;
    didLoad.current = true;
    // Remove the permissions snapshot saved by the earlier session implementation.
    localStorage.removeItem("hub.session");
    if (!localStorage.getItem("token")) {
      setLoading(false);
      return;
    }
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (!loadFailed) return;
    const retryOnReconnect = () => void loadSession();
    window.addEventListener("online", retryOnReconnect);
    return () => window.removeEventListener("online", retryOnReconnect);
  }, [loadFailed, loadSession]);

  if (loading) {
    return <div role="status" className="grid min-h-screen place-items-center">Loading session…</div>;
  }

  if (loadFailed) {
    return (
      <div role="alert" className="grid min-h-screen place-content-center gap-3 text-center">
        <p>Could not load your session.</p>
        <button type="button" className="underline" onClick={() => void loadSession()}>Retry</button>
      </div>
    );
  }

  return <AuthContext.Provider value={{ user, refreshAuth, clearSession }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
