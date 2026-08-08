import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

export class AuthServiceError extends Error {
  constructor(public readonly code: 'CONFIGURATION' | 'AUTH_FAILED', message: string) {
    super(message);
    this.name = 'AuthServiceError';
  }
}

export interface SignUpResult {
  user: User | null;
  session: Session | null;
  requiresEmailConfirmation: boolean;
}

function requireSupabase() {
  if (!supabase) {
    throw new AuthServiceError('CONFIGURATION', 'Authentication is temporarily unavailable. Please try again later.');
  }
  return supabase;
}

function throwAuthError(message: string): never {
  throw new AuthServiceError('AUTH_FAILED', message);
}

export async function signUp(email: string, password: string): Promise<SignUpResult> {
  const client = requireSupabase();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throwAuthError('We could not create your account. Please check your details and try again.');
  return { user: data.user, session: data.session, requiresEmailConfirmation: !data.session };
}

export async function signIn(email: string, password: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throwAuthError('The email or password was not recognised. Please try again.');
}

export async function signOut(): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.signOut();
  if (error) throwAuthError('We could not sign you out. Please try again.');
}

export async function sendPasswordReset(email: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  if (error) throwAuthError('We could not send a password reset email. Please try again.');
}

export async function updatePassword(password: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.auth.updateUser({ password });
  if (error) throwAuthError('We could not update your password. Please request a new reset link and try again.');
}

export async function getCurrentSession(): Promise<Session | null> {
  const client = requireSupabase();
  const { data, error } = await client.auth.getSession();
  if (error) throwAuthError('We could not verify your session. Please sign in again.');
  return data.session;
}
