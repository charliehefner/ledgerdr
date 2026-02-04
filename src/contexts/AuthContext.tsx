import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { UserRole, canAccessSection, canWriteSection, Section, getDefaultRouteForRole } from "@/lib/permissions";

export type { UserRole };

interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  canModifySettings: boolean;
  canAccessSection: (section: Section) => boolean;
  canWriteSection: (section: Section) => boolean;
  getDefaultRoute: () => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user role from user_roles table
  // Returns null if fetch fails - caller must handle logout
  const fetchUserRole = async (userId: string): Promise<UserRole | null> => {
    const { data, error } = await supabase.rpc('get_user_role', { _user_id: userId });
    
    if (error) {
      console.error('Error fetching user role:', error);
      return null; // Signal failure - do not default to any role
    }
    
    if (!data) {
      console.error('No role found for user:', userId);
      return null;
    }
    
    return data as UserRole;
  };

  // Set up auth state listener BEFORE checking session
  useEffect(() => {
    let isMounted = true;

    // Helper to set user with role - logs out if role fetch fails
    const setUserWithRole = async (authUser: User): Promise<boolean> => {
      const role = await fetchUserRole(authUser.id);
      
      if (!role) {
        // Role fetch failed - force logout for security
        console.error('Role fetch failed, forcing logout for security');
        await supabase.auth.signOut();
        if (isMounted) {
          setUser(null);
          setSession(null);
        }
        return false;
      }
      
      if (isMounted) {
        setUser({
          id: authUser.id,
          email: authUser.email || '',
          role,
        });
      }
      return true;
    };

    // First set up the auth state change listener for ONGOING changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!isMounted) return;
        
        setSession(currentSession);
        
        if (currentSession?.user) {
          // Await role fetch to prevent rendering with undefined role
          await setUserWithRole(currentSession.user);
        } else {
          setUser(null);
        }
      }
    );

    // INITIAL load - controls isLoading state
    const initializeAuth = async () => {
      try {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (!isMounted) return;

        setSession(existingSession);
        
        if (existingSession?.user) {
          await setUserWithRole(existingSession.user);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        const role = await fetchUserRole(data.user.id);
        setUser({
          id: data.user.id,
          email: data.user.email || '',
          role,
        });
        setSession(data.session);
        return { success: true };
      }

      return { success: false, error: 'Login failed' };
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, error: 'An unexpected error occurred' };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  // Accountant cannot modify settings/structural changes
  const canModifySettingsValue = user?.role === "admin";

  // Permission helper functions
  const checkAccessSection = (section: Section) => canAccessSection(user?.role, section);
  const checkWriteSection = (section: Section) => canWriteSection(user?.role, section);
  const getDefaultRoute = () => getDefaultRouteForRole(user?.role || "viewer");

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      isLoading, 
      login, 
      logout, 
      canModifySettings: canModifySettingsValue,
      canAccessSection: checkAccessSection,
      canWriteSection: checkWriteSection,
      getDefaultRoute,
    }}>
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
