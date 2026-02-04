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
    try {
      console.log('[Auth] Starting role fetch for:', userId);
      
      // Direct query to user_roles table instead of RPC to avoid any potential issues
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();
      
      console.log('[Auth] Role query result:', { data, error });
      
      if (error) {
        console.error('[Auth] Error fetching user role:', error);
        return null;
      }
      
      if (!data?.role) {
        console.error('[Auth] No role found for user:', userId);
        return null;
      }
      
      return data.role as UserRole;
    } catch (err) {
      console.error('[Auth] Role fetch failed:', err);
      return null;
    }
  };

  // Set up auth state listener BEFORE checking session
  useEffect(() => {
    let isMounted = true;
    console.log('[Auth] Starting auth initialization...');

    // Helper to set user with role - logs out if role fetch fails
    const setUserWithRole = async (authUser: User): Promise<boolean> => {
      try {
        console.log('[Auth] Fetching role for user:', authUser.id);
        const role = await fetchUserRole(authUser.id);
        console.log('[Auth] Role result:', role);
        
        if (!role) {
          // Role fetch failed - force logout for security
          console.error('[Auth] Role fetch failed, forcing logout for security');
          await supabase.auth.signOut();
          if (isMounted) {
            setUser(null);
            setSession(null);
            setIsLoading(false); // Ensure loading stops
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
      } catch (err) {
        console.error('[Auth] Error in setUserWithRole:', err);
        if (isMounted) {
          setUser(null);
          setSession(null);
          setIsLoading(false);
        }
        return false;
      }
    };

    // First set up the auth state change listener for ONGOING changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log('[Auth] onAuthStateChange event:', event);
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
        console.log('[Auth] Getting existing session...');
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        console.log('[Auth] Existing session:', existingSession ? 'found' : 'none');
        if (!isMounted) return;

        setSession(existingSession);
        
        if (existingSession?.user) {
          console.log('[Auth] User found, fetching role...');
          await setUserWithRole(existingSession.user);
        }
      } catch (err) {
        console.error('[Auth] Error in initializeAuth:', err);
      } finally {
        console.log('[Auth] Setting isLoading to false');
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
        
        if (!role) {
          // Role fetch failed - logout and report error
          await supabase.auth.signOut();
          return { success: false, error: 'Unable to fetch user permissions. Please contact an administrator.' };
        }
        
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
