import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, KeyRound, Loader2, LockKeyhole, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type AuthMode = 'LOGIN' | 'SIGN_UP' | 'FORGOT_PASSWORD' | 'CHECK_EMAIL' | 'RESET_PASSWORD';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthScreen() {
  const { passwordRecovery, sendPasswordReset, signIn, signUp, updatePassword } = useAuth();
  const [mode, setMode] = useState<AuthMode>(passwordRecovery ? 'RESET_PASSWORD' : 'LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (passwordRecovery) setMode('RESET_PASSWORD');
  }, [passwordRecovery]);

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setPassword('');
    setConfirmPassword('');
    setMessage('');
  };

  const validateCredentials = () => {
    if (mode !== 'RESET_PASSWORD' && !EMAIL_PATTERN.test(email.trim())) return 'Please enter a valid email address.';
    if (mode !== 'FORGOT_PASSWORD' && password.length < 8) return 'Your password must contain at least 8 characters.';
    if ((mode === 'SIGN_UP' || mode === 'RESET_PASSWORD') && password !== confirmPassword) return 'The passwords do not match.';
    return '';
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validationMessage = validateCredentials();
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    setSubmitting(true);
    setMessage('');
    try {
      if (mode === 'LOGIN') {
        await signIn(email.trim(), password);
      } else if (mode === 'SIGN_UP') {
        const result = await signUp(email.trim(), password);
        if (result.requiresEmailConfirmation) changeMode('CHECK_EMAIL');
      } else if (mode === 'FORGOT_PASSWORD') {
        await sendPasswordReset(email.trim());
        changeMode('CHECK_EMAIL');
      } else if (mode === 'RESET_PASSWORD') {
        await updatePassword(password);
        setMessage('Your password has been updated. You can continue to your DREAMsheets.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const title = mode === 'LOGIN' ? 'Welcome back'
    : mode === 'SIGN_UP' ? 'Create your account'
      : mode === 'FORGOT_PASSWORD' ? 'Reset your password'
        : mode === 'RESET_PASSWORD' ? 'Choose a new password'
          : 'Check your email';

  return (
    <main className="min-h-screen bg-stone-950 px-4 py-10 text-stone-900 flex items-center justify-center">
      <section className="w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-white shadow-2xl">
        <header className="bg-stone-950 px-7 py-7 text-white border-b-4 border-emerald-600">
          <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-emerald-400">DREAMsheet AI</p>
          <h1 className="mt-3 text-3xl font-light tracking-tight">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-stone-400">Create clarity. Build direction. Take action.</p>
        </header>

        {mode === 'CHECK_EMAIL' ? (
          <div className="space-y-6 p-7 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><Mail size={26} /></div>
            <p className="text-sm leading-relaxed text-stone-600">We have sent an email with the next step. Please check your inbox and spam folder.</p>
            <button type="button" onClick={() => changeMode('LOGIN')} className="w-full rounded-xl bg-stone-900 px-5 py-3.5 text-sm font-bold text-white hover:bg-stone-800">Return to sign in</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 p-7">
            {mode !== 'RESET_PASSWORD' && (
              <label className="block space-y-2 text-xs font-bold uppercase tracking-wider text-stone-500">
                Email
                <span className="relative block">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" disabled={submitting} className="w-full rounded-xl border border-stone-200 py-3.5 pl-11 pr-4 text-sm font-normal normal-case tracking-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20" required />
                </span>
              </label>
            )}

            {mode !== 'FORGOT_PASSWORD' && (
              <label className="block space-y-2 text-xs font-bold uppercase tracking-wider text-stone-500">
                {mode === 'RESET_PASSWORD' ? 'New password' : 'Password'}
                <span className="relative block">
                  <LockKeyhole size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete={mode === 'LOGIN' ? 'current-password' : 'new-password'} minLength={8} disabled={submitting} className="w-full rounded-xl border border-stone-200 py-3.5 pl-11 pr-4 text-sm font-normal normal-case tracking-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20" required />
                </span>
              </label>
            )}

            {(mode === 'SIGN_UP' || mode === 'RESET_PASSWORD') && (
              <label className="block space-y-2 text-xs font-bold uppercase tracking-wider text-stone-500">
                Confirm password
                <input type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} disabled={submitting} className="w-full rounded-xl border border-stone-200 px-4 py-3.5 text-sm font-normal normal-case tracking-normal outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20" required />
              </label>
            )}

            {message && <p role="alert" aria-live="polite" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</p>}

            <button disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? <><Loader2 size={17} className="animate-spin" /> Please wait…</> : <>{mode === 'LOGIN' ? 'Sign In' : mode === 'SIGN_UP' ? 'Create Account' : mode === 'FORGOT_PASSWORD' ? 'Send Reset Email' : 'Update Password'} <ArrowRight size={17} /></>}
            </button>

            <div className="space-y-3 border-t border-stone-100 pt-5 text-center text-sm">
              {mode === 'LOGIN' && <><button type="button" onClick={() => changeMode('FORGOT_PASSWORD')} className="block w-full text-stone-500 hover:text-emerald-700">Forgot password?</button><button type="button" onClick={() => changeMode('SIGN_UP')} className="block w-full font-bold text-emerald-700">Create Account</button></>}
              {(mode === 'SIGN_UP' || mode === 'FORGOT_PASSWORD') && <button type="button" onClick={() => changeMode('LOGIN')} className="font-bold text-emerald-700">Back to sign in</button>}
            </div>
          </form>
        )}
        <footer className="flex items-center justify-center gap-2 bg-stone-50 px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400"><KeyRound size={13} /> Secure account access</footer>
      </section>
    </main>
  );
}
