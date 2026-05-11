// /* -----------------------------------------------------
//    Hook
// ----------------------------------------------------- */
// export const useAuth = () => {
//   const context = useContext(AuthContext);
//   if (!context)
//     throw new Error("useAuth must be used within an AuthProvider");
//   return context;
// };
import { createContext, useContext, useState, useEffect, useRef } from "react";
import { jwtDecode } from "jwt-decode";
// import { getSocket } from "@/lib/websocket";
import axios from "axios";
// import { domain } from '@/lib/constants'

/* -----------------------------------------------------
   Flatten Permissions (underscore + nested)
----------------------------------------------------- */
const flattenPermissions = (permissionTree: any[] = []) => {
  const result: Record<string, any> = {};

  const traverse = (nodes: any[], target: Record<string, any>) => {
    for (const node of nodes) {
      const hasChildren = node.children && node.children.length > 0;

      if (hasChildren) {
        target[node.name] = target[node.name] || {};
        target[node.name].value = !!node.value;
        traverse(node.children, target[node.name]);
      } else {
        target[node.name] = !!node.value;
      }
    }
  };

  traverse(permissionTree, result);
  return result;
};

/* -----------------------------------------------------
   User + Context Interfaces
----------------------------------------------------- */
interface User {
  id?: string;
  email?: string;
  location?: string;
  initials?: string;
  name?: string;
  timezone?: string;
  access?: Record<string, any>;
}

interface AuthContextType {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  refreshAuth: () => void;
  refreshTokenFromBackend: () => void;
}

/* -----------------------------------------------------
   Auth Context Implementation
----------------------------------------------------- */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const didMount = useRef(false);

  const refreshAuth = () => {
    const token = localStorage.getItem("token");
    if (!token) {
      if (user !== null) setUser(null);
      return;
    }

    try {
      const decoded: any = jwtDecode(token);

      const flattenedAccess = decoded.permissions
        ? flattenPermissions(decoded.permissions)
        : {};

      const siteAccess = decoded.site_access || {};
      flattenedAccess["site_access"] = { ...siteAccess };
      for (const [key, value] of Object.entries(siteAccess)) {
        flattenedAccess[`site_access.${key}`] = value;
      }

      const updatedUser: User = {
        id: decoded.id,
        email: decoded.email,
        location: decoded.location,
        initials: decoded.initials,
        name: decoded.name,
        timezone: decoded.timezone,
        access: flattenedAccess,
      };

      if (JSON.stringify(updatedUser) !== JSON.stringify(user)) {
        setUser(updatedUser);
      }
    } catch (err) {
      console.error("Failed to decode token:", err);
      if (user !== null) setUser(null);
    }
  };

  /* -----------------------------------------------------
     Fetch fresh JWT from backend
  ----------------------------------------------------- */
  // const refreshTokenFromBackend = async () => {
  //   try {
  //     const response = await axios.post(
  //       `${domain}/api/auth/refresh-token`,
  //     );
  //     const newToken = response.data.token;
  //     if (newToken) {
  //       localStorage.setItem("token", newToken);
  //       refreshAuth();
  //     }
  //   } catch (err) {
  //     console.error("Failed to refresh token from backend:", err);
  //   }
  // };
  const refreshTokenFromBackend = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No token found in localStorage");

      // Decode the user ID from token (optional, or get from your auth context)
      const decoded: any = jwtDecode(token);
      const userId = decoded?.id;

      if (!userId) throw new Error("User ID missing in token");

      const response = await axios.post(
        `/login-auth/refresh-token`,
        { userId } // 🔥 send userId explicitly in body
      );

      const newToken = response.data.token;
      if (newToken) {
        localStorage.setItem("token", newToken);
        refreshAuth();
      }
    } catch (err) {
      console.error("Failed to refresh token from backend:", err);
    }
  };

  /* -----------------------------------------------------
     Socket Integration
  ----------------------------------------------------- */
  useEffect(() => {
    if (didMount.current) return;
    refreshAuth();
    didMount.current = true;


  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, refreshAuth, refreshTokenFromBackend }}>
      {children}
    </AuthContext.Provider>
  );
};

/* -----------------------------------------------------
   Hook
----------------------------------------------------- */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context)
    throw new Error("useAuth must be used within an AuthProvider");
  return context;
};