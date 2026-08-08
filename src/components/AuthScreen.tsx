import { useEffect, useState, type FormEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { BrandMark } from './BrandMark';

type AuthMode = 'LOGIN' | 'SIGN_UP' | 'FORGOT_PASSWORD' | 'CHECK_EMAIL' | 'RESET_PASSWORD';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MODE_COPY: Record<AuthMode, { eyebrow: string; title: string; description: string }> = {
  LOGIN: {
    eyebrow: 'Welcome back',
    title: 'Continue with clarity.',
    description: 'Sign in to return to your plans and keep moving your priorities forward.',
  },
  SIGN_UP: {
    eyebrow: 'Begin your journey',
    title: 'Create your account.',
    description: 'A secure place for the DREAMSheets you create, refine and put into action.',
  },
  FORGOT_PASSWORD: {
    eyebrow: 'Account recovery',
    title: 'Reset your password.',
    description: 'Enter your account email and we will send you a secure reset link.',
  },
  CHECK_EMAIL: {
    eyebrow: 'One more step',
    title: 'Check your email.',
    description: 'We have sent the next step to your inbox. It may take a moment to arrive.',
  },
  RESET_PASSWORD: {
    eyebrow: 'Secure your account',
    title: 'Choose a new password.',
    description: 'Use at least eight characters and choose something unique to this account.',
  },
};

function BreathingVisual({ reducedMotion }: { reducedMotion: boolean }) {
  const [phase, setPhase] = useState<'INHALE' | 'EXHALE'>('INHALE');

  useEffect(() => {
    if (reducedMotion) return;
    const interval = window.setInterval(() => {
      setPhase(value => value === 'INHALE' ? 'EXHALE' : 'INHALE');
    }, 5_000);
    return () => window.clearInterval(interval);
  }, [reducedMotion]);

  return (
    <div className="relative flex h-24 w-24 items-center justify-center sm:h-52 sm:w-52" aria-label={reducedMotion ? 'Pause and reflect' : phase}>
      {[1, 0.78, 0.56].map((scale, index) => (
        <motion.span
          key={scale}
          aria-hidden="true"
          className="absolute rounded-full border border-emerald-300/15 dark:border-emerald-200/20"
          style={{ height: `${scale * 100}%`, width: `${scale * 100}%` }}
          animate={reducedMotion ? { opacity: 0.45, scale: 1 } : { opacity: [0.22, 0.52, 0.22], scale: [0.92, 1.04, 0.92] }}
          transition={reducedMotion ? undefined : { delay: index * 0.35, duration: 10, ease: 'easeInOut', repeat: Infinity }}
        />
      ))}
      <motion.div
        aria-hidden="true"
        className="absolute h-12 w-12 rounded-full bg-emerald-400/20 shadow-[0_0_70px_rgba(16,185,129,0.28)] dark:bg-emerald-400/25 sm:h-20 sm:w-20"
        animate={reducedMotion ? { scale: 1 } : { scale: [0.86, 1.12, 0.86] }}
        transition={reducedMotion ? undefined : { duration: 10, ease: 'easeInOut', repeat: Infinity }}
      />
      <div className="relative z-10 text-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={reducedMotion ? 'PAUSE' : phase}
            className="block text-[8px] font-bold tracking-[0.28em] text-emerald-200 sm:text-[10px] sm:tracking-[0.38em]"
            initial={reducedMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -4 }}
          >
            {reducedMotion ? 'PAUSE' : phase}
          </motion.span>
        </AnimatePresence>
        <span className="mt-1.5 block text-[7px] tracking-[0.12em] text-stone-500 sm:mt-2 sm:text-[9px] sm:tracking-[0.18em]">REFLECT · PROCEED</span>
      </div>
    </div>
  );
}

export function AuthScreen() {
  const { passwordRecovery, sendPasswordReset, signIn, signUp, updatePassword } = useAuth();
  const reducedMotion = Boolean(useReducedMotion());
  const [mode, setMode] = useState<AuthMode>(passwordRecovery ? 'RESET_PASSWORD' : 'LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'error' | 'success'>('error');

  useEffect(() => {
    if (passwordRecovery) setMode('RESET_PASSWORD');
  }, [passwordRecovery]);

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setMessage('');
    setMessageTone('error');
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
      setMessageTone('error');
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
        setMessageTone('success');
        setMessage('Your password has been updated. You can continue to your DREAMSheets.');
      }
    } catch (error) {
      setMessageTone('error');
      setMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const copy = MODE_COPY[mode];
  const motionProps = reducedMotion
    ? { initial: false as const, animate: { opacity: 1 } }
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

  return (
    <main className="auth-surface relative min-h-dvh overflow-x-clip bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100 lg:h-dvh lg:overflow-y-auto">
      <div aria-hidden="true" className="absolute inset-0 hidden grid-cols-2 lg:grid">
        <div className="bg-[#07110d] bg-[radial-gradient(circle_at_20%_18%,rgba(16,185,129,0.15),transparent_36%),radial-gradient(circle_at_85%_80%,rgba(16,185,129,0.06),transparent_34%)]" />
        <div className="bg-stone-50 dark:bg-[#151311]" />
      </div>
      <div aria-hidden="true" className="absolute inset-y-0 left-1/2 hidden w-28 -translate-x-1/2 bg-gradient-to-r from-transparent via-stone-800/[0.04] to-transparent dark:via-black/10 lg:block" />
      <div className="relative mx-auto grid min-h-dvh w-full min-w-0 max-w-[1460px] lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.75fr)] lg:gap-12 lg:px-8 xl:gap-20 2xl:px-10">
        <motion.section
          className="relative flex min-h-[320px] min-w-0 flex-col justify-between overflow-hidden border-b border-white/10 bg-[#07110d] px-6 py-7 text-white sm:px-10 sm:py-9 lg:h-full lg:min-h-0 lg:border-b-0 lg:bg-transparent lg:px-0 lg:py-7 xl:py-9"
          {...motionProps}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        >
          <div aria-hidden="true" className="absolute -left-28 top-1/3 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: reducedMotion ? 0 : 0.1, duration: 0.45 }}
          >
            <BrandMark tone="light" size="lg" />
          </motion.div>

          <div className="relative z-10 grid items-end gap-7 sm:grid-cols-[1fr_auto] lg:my-auto lg:block lg:py-4">
            <div className="max-w-xl">
              <motion.p
                className="mb-4 text-[10px] font-bold uppercase tracking-[0.34em] text-emerald-300"
                initial={reducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: reducedMotion ? 0 : 0.2 }}
              >
                Clarity for meaningful progress
              </motion.p>
              <motion.h1
                className="text-4xl font-light leading-[1.03] tracking-[-0.045em] text-stone-50 sm:text-5xl lg:text-5xl xl:text-6xl"
                initial={reducedMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reducedMotion ? 0 : 0.24, duration: 0.55 }}
              >
                Turn intention<br />into direction.
              </motion.h1>
              <p className="mt-5 max-w-lg text-sm leading-7 text-stone-400 sm:text-base">
                Shape ambitious goals into a clear, structured plan you can return to and act on.
              </p>
            </div>
            <div className="mt-4 flex sm:mt-0 lg:mt-7 xl:mt-9">
              <BreathingVisual reducedMotion={reducedMotion} />
            </div>
          </div>

          <p className="relative z-10 text-[10px] font-semibold uppercase tracking-[0.24em] text-stone-500">
            Create clarity. Build direction. Take action.
          </p>
        </motion.section>

        <section className="relative flex min-w-0 items-center justify-center bg-stone-50 px-4 py-8 dark:bg-[#151311] sm:px-8 sm:py-10 lg:h-full lg:min-h-0 lg:bg-transparent lg:px-0 lg:py-6 dark:lg:bg-transparent">
          <motion.div
            className="w-full min-w-0 max-w-[480px]"
            initial={reducedMotion ? false : { opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: reducedMotion ? 0 : 0.12, duration: 0.5, ease: 'easeOut' }}
          >
            <div className="mb-8 lg:hidden">
              <div className="dark:hidden"><BrandMark tone="dark" size="md" /></div>
              <div className="hidden dark:block"><BrandMark tone="light" size="md" /></div>
            </div>
            <div className="min-w-0 rounded-[1.75rem] border border-stone-200/80 bg-white/90 p-6 shadow-[0_24px_70px_rgba(28,25,23,0.10)] backdrop-blur-sm dark:border-white/10 dark:bg-stone-900/90 dark:shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:p-8">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={mode}
                  initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  <header className="mb-7">
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-700 dark:text-emerald-400">{copy.eyebrow}</p>
                    <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-stone-950 dark:text-stone-50">{copy.title}</h2>
                    <p className="mt-3 text-sm leading-6 text-stone-500 dark:text-stone-400">{copy.description}</p>
                  </header>

                  {mode === 'CHECK_EMAIL' ? (
                    <div className="text-center">
                      <motion.div
                        className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300"
                        initial={reducedMotion ? false : { opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                      >
                        <Mail size={28} />
                        <CheckCircle2 className="absolute -bottom-1 -right-1 rounded-full bg-white text-emerald-600 dark:bg-stone-900 dark:text-emerald-400" size={24} />
                      </motion.div>
                      <p className="mx-auto mt-6 max-w-sm text-sm leading-6 text-stone-600 dark:text-stone-300">
                        Follow the secure link in the email to continue. Check your spam folder if it does not appear.
                      </p>
                      <motion.button
                        type="button"
                        onClick={() => changeMode('LOGIN')}
                        className="mt-7 w-full rounded-xl bg-stone-950 px-5 py-3.5 text-sm font-bold text-white outline-none transition-colors hover:bg-stone-800 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-white dark:focus-visible:ring-offset-stone-900"
                        whileHover={reducedMotion ? undefined : { y: -1 }}
                        whileTap={reducedMotion ? undefined : { scale: 0.99 }}
                      >
                        Return to Sign In
                      </motion.button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="min-w-0 space-y-5">
                      {mode !== 'RESET_PASSWORD' ? (
                        <label className="block text-xs font-bold tracking-wide text-stone-600 dark:text-stone-300">
                          Email address
                          <span className="relative mt-2 block">
                            <Mail size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500" />
                            <input
                              type="email"
                              value={email}
                              onChange={event => setEmail(event.target.value)}
                              autoComplete="email"
                              disabled={submitting}
                              className="auth-field w-full rounded-xl border border-stone-200 bg-stone-50/70 py-3.5 pl-11 pr-4 text-sm font-normal text-stone-900 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-stone-950/60 dark:text-stone-100 dark:focus:border-emerald-500 dark:focus:bg-stone-950 dark:focus:ring-emerald-400/10"
                              required
                            />
                          </span>
                        </label>
                      ) : null}

                      {mode !== 'FORGOT_PASSWORD' ? (
                        <label className="block text-xs font-bold tracking-wide text-stone-600 dark:text-stone-300">
                          {mode === 'RESET_PASSWORD' ? 'New password' : 'Password'}
                          <span className="relative mt-2 block">
                            <LockKeyhole size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500" />
                            <input
                              type={showPassword ? 'text' : 'password'}
                              value={password}
                              onChange={event => setPassword(event.target.value)}
                              autoComplete={mode === 'LOGIN' ? 'current-password' : 'new-password'}
                              minLength={8}
                              disabled={submitting}
                              className="auth-field w-full rounded-xl border border-stone-200 bg-stone-50/70 py-3.5 pl-11 pr-12 text-sm font-normal text-stone-900 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-stone-950/60 dark:text-stone-100 dark:focus:border-emerald-500 dark:focus:bg-stone-950 dark:focus:ring-emerald-400/10"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(value => !value)}
                              aria-label={showPassword ? 'Hide password' : 'Show password'}
                              className="absolute right-3 top-1/2 rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-stone-500 dark:hover:bg-white/10 dark:hover:text-stone-200"
                            >
                              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                            </button>
                          </span>
                        </label>
                      ) : null}

                      {mode === 'SIGN_UP' || mode === 'RESET_PASSWORD' ? (
                        <label className="block text-xs font-bold tracking-wide text-stone-600 dark:text-stone-300">
                          Confirm password
                          <span className="relative mt-2 block">
                            <KeyRound size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500" />
                            <input
                              type={showConfirmPassword ? 'text' : 'password'}
                              value={confirmPassword}
                              onChange={event => setConfirmPassword(event.target.value)}
                              autoComplete="new-password"
                              minLength={8}
                              disabled={submitting}
                              className="auth-field w-full rounded-xl border border-stone-200 bg-stone-50/70 py-3.5 pl-11 pr-12 text-sm font-normal text-stone-900 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-stone-950/60 dark:text-stone-100 dark:focus:border-emerald-500 dark:focus:bg-stone-950 dark:focus:ring-emerald-400/10"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(value => !value)}
                              aria-label={showConfirmPassword ? 'Hide confirmed password' : 'Show confirmed password'}
                              className="absolute right-3 top-1/2 rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-stone-500 dark:hover:bg-white/10 dark:hover:text-stone-200"
                            >
                              {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                            </button>
                          </span>
                        </label>
                      ) : null}

                      <div className="min-h-[3.25rem]">
                        <AnimatePresence initial={false}>
                          {message ? (
                            <motion.p
                              role={messageTone === 'error' ? 'alert' : 'status'}
                              aria-live="polite"
                              className={`rounded-xl border px-4 py-3 text-sm ${messageTone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200' : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100'}`}
                              initial={reducedMotion ? false : { opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={reducedMotion ? undefined : { opacity: 0, y: -4 }}
                            >
                              {message}
                            </motion.p>
                          ) : null}
                        </AnimatePresence>
                      </div>

                      <motion.button
                        disabled={submitting}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-700/15 outline-none transition-colors hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:focus-visible:ring-emerald-400 dark:focus-visible:ring-offset-stone-900"
                        whileHover={reducedMotion || submitting ? undefined : { y: -1 }}
                        whileTap={reducedMotion || submitting ? undefined : { scale: 0.99 }}
                      >
                        {submitting ? (
                          <><Loader2 size={17} className="animate-spin" /> Please wait…</>
                        ) : (
                          <>{mode === 'LOGIN' ? 'Sign In' : mode === 'SIGN_UP' ? 'Create Account' : mode === 'FORGOT_PASSWORD' ? 'Send Reset Email' : 'Update Password'} <ArrowRight size={17} /></>
                        )}
                      </motion.button>

                      <div className="space-y-3 border-t border-stone-100 pt-5 text-center text-sm dark:border-white/10">
                        {mode === 'LOGIN' ? (
                          <>
                            <button type="button" onClick={() => changeMode('FORGOT_PASSWORD')} className="block w-full rounded-lg py-1 text-stone-500 outline-none transition hover:text-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-stone-400 dark:hover:text-emerald-300">Forgot your password?</button>
                            <p className="text-stone-500 dark:text-stone-400">New to DREAMSheet AI? <button type="button" onClick={() => changeMode('SIGN_UP')} className="rounded font-bold text-emerald-700 outline-none hover:text-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300">Create an account</button></p>
                          </>
                        ) : null}
                        {mode === 'SIGN_UP' || mode === 'FORGOT_PASSWORD' ? (
                          <button type="button" onClick={() => changeMode('LOGIN')} className="rounded-lg px-3 py-1 font-bold text-emerald-700 outline-none hover:text-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300">Back to Sign In</button>
                        ) : null}
                      </div>
                    </form>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="mt-5 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400 dark:text-stone-500">
              <ShieldCheck size={14} /> Secure account access
            </div>
          </motion.div>
        </section>
      </div>
    </main>
  );
}
