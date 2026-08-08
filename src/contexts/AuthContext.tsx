import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import * as authService from '../services/authService';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  passwordRecovery: boolean;
  signUp: typeof authService.signUp;
  signIn: typeof authService.signIn;
  signOut: typeof authService.signOut;
  sendPasswordReset: typeof authService.sendPasswordReset;
  updatePassword: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    let active = true;
    void authService.getCurrentSession()
      .then(currentSession => {
        if (active) setSession(currentSession);
      })
      .catch(() => {
        if (active) setSession(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const { data } = supabase?.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      if (event === 'SIGNED_OUT') setPasswordRecovery(false);
      setLoading(false);
    }) ?? { data: { subscription: null } };

    return () => {
      active = false;
      data.subscription?.unsubscribe();
    };
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    await authService.updatePassword(password);
    setPasswordRecovery(false);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user ?? null,
    session,
    loading,
    passwordRecovery,
    signUp: authService.signUp,
    signIn: authService.signIn,
    signOut: authService.signOut,
    sendPasswordReset: authService.sendPasswordReset,
    updatePassword,
  }), [loading, passwordRecovery, session, updatePassword]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
