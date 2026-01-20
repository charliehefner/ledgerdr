import { createContext, useContext, useState, ReactNode } from "react";

export type UserRole = "admin" | "accountant";

interface User {
  username: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  canModifySettings: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Simple hardcoded credentials (NOT for production use)
const USERS: Record<string, { password: string; role: UserRole }> = {
  charles: { password: "1234", role: "admin" },
  accountant: { password: "1234", role: "accountant" },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = sessionStorage.getItem("auth_user");
    return stored ? JSON.parse(stored) : null;
  });

  const login = (username: string, password: string): boolean => {
    const normalizedUsername = username.toLowerCase().trim();
    const userConfig = USERS[normalizedUsername];
    
    if (userConfig && userConfig.password === password) {
      const newUser = { username: normalizedUsername, role: userConfig.role };
      setUser(newUser);
      sessionStorage.setItem("auth_user", JSON.stringify(newUser));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem("auth_user");
  };

  // Accountant cannot modify settings/structural changes
  const canModifySettings = user?.role === "admin";

  return (
    <AuthContext.Provider value={{ user, login, logout, canModifySettings }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
