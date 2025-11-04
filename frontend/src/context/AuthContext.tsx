// import { createContext, useContext, useState, useEffect, useRef } from "react";
// import { jwtDecode } from "jwt-decode";

// interface User {
//   id?: string;
//   email?: string;
//   isSupport?: boolean;
//   location?: string;
//   initials?: string;
//   name?: string;
//   timezone?: string;
//   access?: any;
// }

// interface AuthContextType {
//   user: User | null;
//   setUser: React.Dispatch<React.SetStateAction<User | null>>;
//   refreshAuth: () => void; // new method
// }

// const AuthContext = createContext<AuthContextType | undefined>(undefined);

// export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
//   const [user, setUser] = useState<User | null>(null);
//   const didMount = useRef(false);

//   const refreshAuth = () => {
//     const token = localStorage.getItem("token");
//     if (!token) {
//       if (user !== null) setUser(null);
//       return;
//     }

//     try {
//       const decoded: any = jwtDecode(token);
//       if (JSON.stringify(decoded) !== JSON.stringify(user)) {
//         setUser(decoded);
//       }
//     } catch (err) {
//       console.error(err);
//       if (user !== null) setUser(null);
//     }
//   };

//   useEffect(() => {
//     if (didMount.current) return;
//     refreshAuth();
//     didMount.current = true;
//   }, []);

//   return (
//     <AuthContext.Provider value={{ user, setUser, refreshAuth }}>
//       {children}
//     </AuthContext.Provider>
//   );
// };

// export const useAuth = () => {
//   const context = useContext(AuthContext);
//   if (!context) throw new Error("useAuth must be used within an AuthProvider");
//   return context;
// };

// new permissions auth context
import { createContext, useContext, useState, useEffect, useRef } from "react";
import { jwtDecode } from "jwt-decode";

// Utility: flatten permission tree to dot-notation
const flattenPermissions = (permissionTree: any[] = []) => {
  const result: Record<string, boolean> = {};

  const traverse = (nodes: any[], prefix = "") => {
    nodes.forEach((node) => {
      const key = prefix ? `${prefix}.${node.name}` : node.name;
      result[key] = !!node.value;
      if (node.children && node.children.length > 0) {
        traverse(node.children, key);
      }
    });
  };

  traverse(permissionTree);
  return result;
};

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
}

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

      // flatten normal permissions if present
      const flattenedAccess = decoded.permissions
        ? flattenPermissions(decoded.permissions)
        : {};

      // merge site_access into access
      const siteAccess = decoded.site_access || {};
      flattenedAccess["site_access"] = { ...siteAccess };

      const updatedUser: User = {
        id: decoded.id,
        email: decoded.email,
        location: decoded.location,
        initials: decoded.initials,
        name: decoded.name,
        timezone: decoded.timezone,
        access: flattenedAccess,
      };

      // only update if data actually changed
      if (JSON.stringify(updatedUser) !== JSON.stringify(user)) {
        setUser(updatedUser);
      }
    } catch (err) {
      console.error("Failed to decode token:", err);
      if (user !== null) setUser(null);
    }
  };

  useEffect(() => {
    if (didMount.current) return;
    refreshAuth();
    didMount.current = true;
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context)
    throw new Error("useAuth must be used within an AuthProvider");
  return context;
};