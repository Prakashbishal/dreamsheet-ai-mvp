import { useEffect, useRef } from 'react';
import { ArrowRight, KeyRound, LockKeyhole } from 'lucide-react';
import { DreamKeyMark } from './DreamKeyMark';

interface DreamKeyUnlockGateProps {
  selectedDomainTitle: string;
  availableKeys: number | null;
  checking: boolean;
  unlocking: boolean;
  unlockAnimationActive: boolean;
  message?: string;
  draftReady: boolean;
  onUnlockWithDreamKey: () => void;
  onGetDreamKey: () => void;
  onUnlockAnimationComplete: () => void;
}

const PREVIEW_QUESTIONS = [
  'Where are you trying to get to?',
  'What is your current reality?',
  'What could get in your way?',
] as const;

export function DreamKeyUnlockGate({
  selectedDomainTitle,
  availableKeys,
  checking,
  unlocking,
  unlockAnimationActive,
  message,
  draftReady,
  onUnlockWithDreamKey,
  onGetDreamKey,
  onUnlockAnimationComplete,
}: DreamKeyUnlockGateProps) {
  const hasAvailableKey = availableKeys !== null && availableKeys > 0;
  const completionRef = useRef(onUnlockAnimationComplete);
  completionRef.current = onUnlockAnimationComplete;

  useEffect(() => {
    if (!unlockAnimationActive) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const completionTimer = window.setTimeout(
      () => completionRef.current(),
      reducedMotion ? 220 : 1650,
    );
    const soundHookTimer = window.setTimeout(() => {
      // TODO(DREAMKey sound): invoke a future optional lock-click sound hook here.
    }, reducedMotion ? 80 : 1120);

    return () => {
      window.clearTimeout(completionTimer);
      window.clearTimeout(soundHookTimer);
    };
  }, [unlockAnimationActive]);

  return (
    <section
      aria-labelledby="dreamkey-unlock-heading"
      aria-busy={unlocking || unlockAnimationActive}
      className="relative overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-2xl shadow-stone-900/10 dark:border-white/10 dark:bg-stone-900 dark:text-stone-100 dark:shadow-black/30"
    >
      <div aria-hidden="true" className={`dreamkey-unlock-preview pointer-events-none select-none p-6 opacity-45 blur-[3px] sm:p-8 ${unlockAnimationActive ? 'dreamkey-unlock-preview--revealing' : ''}`}>
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-700 dark:text-emerald-400">Discovery - {selectedDomainTitle}</p>
        <div className="mt-6 space-y-5">
          {PREVIEW_QUESTIONS.map(question => (
            <div key={question}>
              <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">{question}</p>
              <div className="mt-2 h-16 rounded-xl bg-stone-100 dark:bg-white/10" />
            </div>
          ))}
        </div>
      </div>

      {unlockAnimationActive ? (
        <div className="dreamkey-unlock-animation absolute inset-0 z-20" aria-hidden="true">
          <div className="dreamkey-unlock-reveal-veil" />
          <div className="dreamkey-unlock-pulse" />
          <div className="dreamkey-animation-lock">
            <span className="dreamkey-animation-lock__shackle" />
            <span className="dreamkey-animation-lock__body"><span className="dreamkey-animation-lock__keyhole" /></span>
          </div>
          <div className="dreamkey-animation-key">
            <DreamKeyMark variant="compact" size="lg" />
            <span className="dreamkey-animation-key__shaft" />
            <span className="dreamkey-animation-key__tooth" />
          </div>
          <p className="dreamkey-animation-label">DREAMKey secured</p>
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-white/45 via-white/90 to-white p-5 dark:from-stone-950/35 dark:via-stone-950/90 dark:to-stone-950 sm:p-8">
          <div className="w-full max-w-lg rounded-[1.75rem] border border-stone-200/80 bg-white/95 p-6 text-center shadow-2xl backdrop-blur-md dark:border-white/10 dark:bg-stone-900/95 sm:p-8">
            <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-900 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-200">
              <LockKeyhole size={13} /> Discovery locked
            </div>
            <div className="mx-auto mt-5 w-fit"><DreamKeyMark variant="compact" size="lg" /></div>
            <h2 id="dreamkey-unlock-heading" className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">Unlock your Discovery Session</h2>
            <p className="mt-3 text-sm leading-6 text-stone-600 dark:text-stone-400">Use 1 DREAMKey to unlock the complete {selectedDomainTitle} journey, including discovery, goals, actions and your finished strategic plan.</p>
            <p className="mt-4 text-sm font-bold text-emerald-700 dark:text-emerald-400">
              {checking ? 'Checking your wallet...' : availableKeys === null ? 'Wallet temporarily unavailable' : `${availableKeys} DREAMKey${availableKeys === 1 ? '' : 's'} available`}
            </p>
            {message ? <p role="status" className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-900 dark:bg-amber-300/10 dark:text-amber-200">{message}</p> : null}
            <button
              type="button"
              onClick={onUnlockWithDreamKey}
              disabled={checking || unlocking || !draftReady}
              className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white outline-none transition hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:focus-visible:ring-offset-stone-900"
            >
              <KeyRound size={17} /> {unlocking ? 'Securing your DREAMKey...' : !draftReady ? 'Saving secure draft...' : availableKeys === null ? 'Try secure unlock' : hasAvailableKey ? 'Use 1 DREAMKey' : 'Get a DREAMKey'}
            </button>
            <button
              type="button"
              onClick={onGetDreamKey}
              disabled={checking || unlocking}
              className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-stone-200 px-5 py-3 text-sm font-bold text-stone-800 outline-none transition hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-white/10 dark:text-stone-200 dark:hover:bg-white/5"
            >
              {hasAvailableKey ? 'Manage DREAMKeys' : 'Get a DREAMKey'} <ArrowRight size={16} />
            </button>
            <button type="button" onClick={onGetDreamKey} disabled={checking || unlocking} className="mt-4 rounded-lg px-3 py-2 text-sm font-bold text-emerald-700 outline-none hover:text-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 dark:text-emerald-400 dark:hover:text-emerald-300">
              Have a DREAMKey code?
            </button>
          </div>
        </div>
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {unlockAnimationActive ? 'DREAMKey secured. Discovery unlocked.' : ''}
      </span>
    </section>
  );
}
