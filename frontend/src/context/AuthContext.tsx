import { createContext, useContext, useState, useEffect, useRef } from "react";
import { jwtDecode } from "jwt-decode";

interface User {
  id?: string;
  email?: string;
  location?: string;
  initials?: string;
  name?: string;
  timezone?: string;
  access?: any;
}

interface AuthContextType {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  refreshAuth: () => void; // new method
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  // const refreshAuth = () => {
  //   const token = localStorage.getItem("token");
  //   if (!token) {
  //     setUser(null);
  //     return;
  //   }

  //   try {
  //     const decoded: any = jwtDecode(token);
  //     setUser(decoded);
  //   } catch (err) {
  //     console.error("Failed to decode token:", err);
  //     setUser(null);
  //   }
  // };

  // useEffect(() => {
  //   refreshAuth(); // Load user on first mount
  // }, []);

  const didMount = useRef(false);

  const refreshAuth = () => {
    const token = localStorage.getItem("token");
    if (!token) {
      if (user !== null) setUser(null);
      return;
    }

    try {
      const decoded: any = jwtDecode(token);
      if (JSON.stringify(decoded) !== JSON.stringify(user)) {
        setUser(decoded);
      }
    } catch (err) {
      console.error(err);
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
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};