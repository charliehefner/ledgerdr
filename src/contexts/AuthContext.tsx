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
  /** True if the user's role requires MFA and it's not yet verified this session */
  mfaRequired: boolean;
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
  const [mfaRequired, setMfaRequired] = useState(false);

  const MFA_ROLES: UserRole[] = ["admin", "accountant"];

  // Fetch user role using security definer function (bypasses RLS)
  // Returns null if fetch fails - caller must handle logout
  const fetchUserRole = async (userId: string, retries = 3): Promise<UserRole | null> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Generous timeout for poor connections (25s)
        const timeoutPromise = new Promise<{ data: null; error: Error }>((_, reject) =>
          setTimeout(() => reject(new Error('Role fetch timeout after 25s')), 25000)
        );
        
        const rpcPromise = supabase.rpc('get_user_role', { _user_id: userId });
        
        const { data, error } = await Promise.race([rpcPromise, timeoutPromise]);
        
        if (error) {
          console.error('[Auth] Error fetching user role:', error);
          if (attempt < retries) {
            await new Promise(r => setTimeout(r, 2000 * attempt));
            continue;
          }
          return null;
        }
        
        if (!data) {
          console.error('[Auth] No role found for user:', userId);
          return null;
        }
        
        return data as UserRole;
      } catch (err) {
        console.error(`[Auth] Role fetch attempt ${attempt} failed:`, err);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 2000 * attempt));
          continue;
        }
        return null;
      }
    }
    return null;
  };

  // Set up auth state listener BEFORE checking session
  useEffect(() => {
    let isMounted = true;

    // Helper to set user with role - logs out if role fetch fails
    const setUserWithRole = async (authUser: User): Promise<boolean> => {
      try {
        const role = await fetchUserRole(authUser.id);
        
        if (!role) {
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

          // Check MFA requirement for admin/accountant
          if (MFA_ROLES.includes(role)) {
            try {
              const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
              if (aalData && aalData.currentLevel !== 'aal2') {
                setMfaRequired(true);
              } else {
                setMfaRequired(false);
              }
            } catch {
              setMfaRequired(false);
            }
          } else {
            setMfaRequired(false);
          }
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

    // Listener for ONGOING auth changes (does NOT control isLoading)
    // This fires on login/logout/token refresh - we only update session/user state
    // but do NOT force logout on role fetch failure here (login() handles that)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (!isMounted) return;
        
        setSession(currentSession);
        
        if (currentSession?.user) {
          // Defer role fetch - fire and forget, don't force logout on failure
          setTimeout(async () => {
            if (!isMounted) return;
            try {
              const role = await fetchUserRole(currentSession.user.id);
              if (role && isMounted) {
                setUser({
                  id: currentSession.user.id,
                  email: currentSession.user.email || '',
                  role,
                });
              }
            } catch (err) {
              console.error('[Auth] onAuthStateChange role fetch error (non-fatal):', err);
            }
          }, 0);
        } else {
          setUser(null);
          setIsLoading(false);
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
      } catch (err) {
        console.error('[Auth] Error in initializeAuth:', err);
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
      mfaRequired,
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
