'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { createAuthClient } from '@/lib/supabase/client';
import type { User, Session, SupabaseClient } from '@supabase/supabase-js';

const SESSION_CACHE_KEY = 'fv_cached_session';
const USER_CACHE_KEY = 'fv_cached_user';

export type SubscriptionStatus = {
  tier: string;
  status: string;
  isActive: boolean;
};

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isOffline: boolean;
  subscription: SubscriptionStatus | null;
}

interface AuthContextValue extends AuthState {
  supabase: SupabaseClient | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function cacheSession(session: Session | null, user: User | null) {
  try {
    if (session && user) {
      localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(session));
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_CACHE_KEY);
      localStorage.removeItem(USER_CACHE_KEY);
    }
  } catch {
    // localStorage unavailable (private browsing, etc.)
  }
}

function getCachedSession(): { session: Session | null; user: User | null } {
  try {
    const sessionStr = localStorage.getItem(SESSION_CACHE_KEY);
    const userStr = localStorage.getItem(USER_CACHE_KEY);
    if (sessionStr && userStr) {
      return {
        session: JSON.parse(sessionStr),
        user: JSON.parse(userStr),
      };
    }
  } catch {
    // localStorage unavailable or corrupted
  }
  return { session: null, user: null };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabaseRef = useRef<SupabaseClient | null>(null);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);

  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    isOffline: false,
    subscription: null,
  });

  // Initialize Supabase client (client-side only)
  useEffect(() => {
    if (!supabaseRef.current) {
      try {
        supabaseRef.current = createAuthClient();
      } catch {
        // Env vars missing (build time) — stay in loading state
        setState((s) => ({ ...s, isLoading: false }));
        return;
      }
    }
    setSupabase(supabaseRef.current);
  }, []);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setState((s) => ({ ...s, isOffline: false }));
    const handleOffline = () => setState((s) => ({ ...s, isOffline: true }));

    setState((s) => ({ ...s, isOffline: !navigator.onLine }));
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch subscription status for a given user
  const fetchSubscription = useCallback(async (userId: string): Promise<SubscriptionStatus | null> => {
    if (!supabase) return null;
    try {
      const { data } = await supabase
        .from('user_subscriptions')
        .select('tier, status')
        .eq('user_id', userId)
        .single();

      if (data) {
        return {
          tier: data.tier,
          status: data.status,
          isActive: data.tier !== 'free' && ['active', 'grace_period', 'trialing'].includes(data.status),
        };
      }
    } catch {
      // No subscription row or query error — treat as free
    }
    return null;
  }, [supabase]);

  // Initialize auth state once supabase client is ready
  useEffect(() => {
    if (!supabase) return;
    let mounted = true;

    async function init() {
      try {
        const { data: { session } } = await supabase!.auth.getSession();
        if (!mounted) return;

        if (session?.user) {
          const sub = await fetchSubscription(session.user.id);
          if (!mounted) return;
          setState((s) => ({ ...s, user: session.user, session, isLoading: false, subscription: sub }));
          cacheSession(session, session.user);
        } else {
          // No active session — try cached for offline
          const cached = getCachedSession();
          if (cached.user && !navigator.onLine) {
            setState((s) => ({
              ...s,
              user: cached.user,
              session: cached.session,
              isLoading: false,
              isOffline: true,
            }));
          } else {
            // Online but no session — clear cache
            cacheSession(null, null);
            setState((s) => ({ ...s, user: null, session: null, isLoading: false }));
          }
        }
      } catch {
        // Network error — use cached session
        const cached = getCachedSession();
        if (mounted) {
          setState((s) => ({
            ...s,
            user: cached.user,
            session: cached.session,
            isLoading: false,
            isOffline: true,
          }));
        }
      }
    }

    init();

    // Listen for auth state changes (sign in, sign out, token refresh)
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        const user = session?.user ?? null;
        const sub = user ? await fetchSubscription(user.id) : null;
        if (!mounted) return;
        setState((s) => ({ ...s, user, session, subscription: sub }));
        cacheSession(session, user);
      }
    );

    return () => {
      mounted = false;
      authSubscription.unsubscribe();
    };
  }, [supabase, fetchSubscription]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: new Error('Auth not initialized') };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  }, [supabase]);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    if (!supabase) return { error: new Error('Auth not initialized') };
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    return { error: error as Error | null };
  }, [supabase]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    cacheSession(null, null);
  }, [supabase]);

  const resetPassword = useCallback(async (email: string) => {
    if (!supabase) return { error: new Error('Auth not initialized') };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    return { error: error as Error | null };
  }, [supabase]);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        supabase,
        signIn,
        signUp,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
