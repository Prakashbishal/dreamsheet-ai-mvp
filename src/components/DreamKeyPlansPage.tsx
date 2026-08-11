import { useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, ShieldCheck, Sparkles } from 'lucide-react';
import type { DreamKeyDisplayPlan, DreamKeyPlanId } from '../config/dreamKeyPlans';
import {
  beginDreamKeyCheckout,
  DreamKeyIntegrationPendingError,
  DreamKeyServiceError,
  getDreamKeyPlans,
  redeemDreamKeyCode,
} from '../services/dreamKeyService';
import { BrandMark } from './BrandMark';
import { DreamKeyMark } from './DreamKeyMark';

interface DreamKeyPlansPageProps {
  onBack: () => void;
}

const CHECKOUT_PENDING_MESSAGE = 'Secure checkout is being connected. No payment has been taken and no DREAMKey has been issued.';

export function DreamKeyPlansPage({ onBack }: DreamKeyPlansPageProps) {
  const plans = getDreamKeyPlans();
  const [pendingPlanId, setPendingPlanId] = useState<DreamKeyPlanId | null>(null);
  const [code, setCode] = useState('');
  const [applyingCode, setApplyingCode] = useState(false);
  const [commerceMessage, setCommerceMessage] = useState('');

  const handlePlanAction = async (plan: DreamKeyDisplayPlan) => {
    setCommerceMessage('');

    if (plan.billingType === 'enterprise') {
      setCommerceMessage('Teams & Coaches enquiries will be available when the commercial contact route is connected.');
      return;
    }

    setPendingPlanId(plan.id);
    try {
      await beginDreamKeyCheckout(plan.id);
    } catch (error) {
      if (!(error instanceof DreamKeyIntegrationPendingError)) {
        console.error('Could not begin DREAMKey checkout.', error);
      }
      setCommerceMessage(CHECKOUT_PENDING_MESSAGE);
    } finally {
      setPendingPlanId(null);
    }
  };

  const handleApplyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedCode = code.trim();
    if (!normalizedCode) return;

    setApplyingCode(true);
    setCommerceMessage('');
    try {
      const result = await redeemDreamKeyCode(normalizedCode);
      if (result.kind === 'free') {
        setCommerceMessage(result.keysGranted === 1
          ? '1 DREAMKey has been added to your account.'
          : `${result.keysGranted} DREAMKeys have been added to your account.`);
      } else {
        setCommerceMessage('This code is valid and can be applied when secure checkout is connected.');
      }
    } catch (error) {
      if (error instanceof DreamKeyServiceError) {
        setCommerceMessage(error.message);
      } else {
        console.error('Could not apply DREAMKey code.', error);
        setCommerceMessage('This DREAMKey code could not be applied. Please try again.');
      }
    } finally {
      setApplyingCode(false);
    }
  };

  return (
    <main className="min-h-dvh overflow-x-clip bg-stone-50 text-stone-950 dark:bg-[#12110f] dark:text-stone-100">
      <header className="relative overflow-hidden border-b border-white/10 bg-stone-950 text-white">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(16,185,129,0.16),transparent_34%),radial-gradient(circle_at_88%_20%,rgba(245,158,11,0.10),transparent_30%)]" />
        <div className="relative mx-auto max-w-7xl px-5 py-6 sm:px-8 sm:py-8">
          <div className="flex items-center justify-between gap-4">
            <BrandMark tone="light" size="md" />
            <button
              type="button"
              onClick={onBack}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-stone-200 outline-none transition hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <ArrowLeft size={16} /> Dashboard
            </button>
          </div>

          <div className="grid items-center gap-10 pb-8 pt-14 md:pb-12 md:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,32rem)]">
            <div className="max-w-3xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-400">One Key. One Journey.</p>
              <h1 className="mt-5 text-4xl font-light tracking-[-0.045em] sm:text-5xl lg:text-6xl">Unlock Your Next Chapter</h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-stone-300 sm:text-lg">
                A DREAMKey unlocks a complete DREAMSheet journey — from discovery and reflection through goals, actions and your finished strategic plan.
              </p>
            </div>
            <DreamKeyMark
              variant="brand"
              decorative={false}
              className="mx-auto w-full max-w-2xl lg:mx-0 lg:justify-self-end"
            />
          </div>
        </div>
      </header>

      <section aria-labelledby="dreamkey-plans-heading" className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-700 dark:text-emerald-400">Choose your path</p>
          <h2 id="dreamkey-plans-heading" className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">DREAMKeys for the way you plan</h2>
          <p className="mt-4 text-sm leading-7 text-stone-600 dark:text-stone-400 sm:text-base">
            DREAMKeys give you access to complete DREAMSheet journeys. Choose the option that fits how you want to use DREAMSheet.
          </p>
        </div>

        {commerceMessage ? (
          <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-center text-sm font-semibold leading-6 text-amber-950 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100" role="status" aria-live="polite">
            {commerceMessage}
          </div>
        ) : null}

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {plans.map(plan => (
            <article
              key={plan.id}
              className={plan.featured
                ? 'relative flex min-w-0 flex-col rounded-[1.8rem] border border-emerald-400 bg-stone-950 p-6 text-white shadow-[0_24px_65px_rgba(6,78,59,0.20)] dark:border-emerald-400/70 dark:bg-stone-900'
                : 'relative flex min-w-0 flex-col rounded-[1.8rem] border border-stone-200 bg-white/90 p-6 shadow-[0_18px_45px_rgba(28,25,23,0.07)] backdrop-blur-sm dark:border-white/10 dark:bg-stone-900/85 dark:shadow-black/25'}
            >
              {plan.headline ? (
                <span className={plan.featured
                  ? 'mb-5 w-fit rounded-full bg-emerald-400 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-stone-950'
                  : 'mb-5 w-fit rounded-full bg-stone-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-stone-600 dark:bg-white/10 dark:text-stone-300'}>
                  {plan.headline}
                </span>
              ) : <div className="mb-5 h-6" aria-hidden="true" />}

              <DreamKeyMark variant="compact" size="md" tone={plan.featured ? 'light' : 'dark'} />
              <h3 className="mt-5 text-xl font-semibold tracking-tight">{plan.name}</h3>
              <p className={plan.featured ? 'mt-3 min-h-20 text-sm leading-6 text-stone-300' : 'mt-3 min-h-20 text-sm leading-6 text-stone-600 dark:text-stone-400'}>{plan.description}</p>

              <div className={plan.featured ? 'mt-5 border-y border-white/10 py-5' : 'mt-5 border-y border-stone-100 py-5 dark:border-white/10'}>
                <p className="text-lg font-semibold">{plan.priceLabel}</p>
                {plan.billingLabel ? <p className={plan.featured ? 'mt-1 text-xs text-stone-400' : 'mt-1 text-xs text-stone-500 dark:text-stone-400'}>{plan.billingLabel}</p> : null}
                <p className={plan.featured ? 'mt-4 text-sm font-bold text-emerald-300' : 'mt-4 text-sm font-bold text-emerald-700 dark:text-emerald-400'}>{plan.keyAllowanceLabel}</p>
              </div>

              <ul className="mt-5 space-y-3 text-sm leading-5">
                {plan.features.map(feature => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <Check size={16} className={plan.featured ? 'mt-0.5 shrink-0 text-emerald-300' : 'mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400'} />
                    <span className={plan.featured ? 'text-stone-300' : 'text-stone-600 dark:text-stone-300'}>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => void handlePlanAction(plan)}
                disabled={pendingPlanId !== null}
                className={plan.featured
                  ? 'mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-stone-950 outline-none transition hover:bg-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950 disabled:cursor-not-allowed disabled:opacity-60'
                  : 'mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-stone-950 px-4 py-3 text-sm font-bold text-white outline-none transition hover:bg-stone-800 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-white dark:focus-visible:ring-offset-stone-900'}
              >
                {pendingPlanId === plan.id ? 'Preparing…' : plan.ctaLabel} <ArrowRight size={16} />
              </button>
            </article>
          ))}
        </div>

        <div className="mt-10 grid gap-6 rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-stone-900 sm:p-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center">
          <div className="flex items-start gap-4">
            <DreamKeyMark variant="compact" size="md" />
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Have a DREAMKey code?</h2>
              <p className="mt-2 text-sm leading-6 text-stone-500 dark:text-stone-400">Codes may later provide a complimentary DREAMKey, a discount, or approved partner access.</p>
            </div>
          </div>
          <form onSubmit={handleApplyCode} className="flex min-w-0 flex-col gap-3 sm:flex-row">
            <div className="min-w-0 flex-1">
              <label htmlFor="dreamkey-code" className="sr-only">Enter DREAMKey code</label>
              <input
                id="dreamkey-code"
                type="text"
                value={code}
                onChange={event => setCode(event.target.value)}
                autoComplete="off"
                placeholder="Enter code"
                className="min-h-12 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-white/10 dark:bg-stone-950 dark:text-stone-100 dark:focus:border-emerald-400"
              />
            </div>
            <button
              type="submit"
              disabled={!code.trim() || applyingCode}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white outline-none transition hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:focus-visible:ring-offset-stone-900"
            >
              {applyingCode ? 'Checking…' : 'Apply Code'}
            </button>
          </form>
        </div>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 text-center text-xs leading-5 text-stone-500 dark:text-stone-400 sm:flex-row">
          <span className="inline-flex items-center gap-2"><ShieldCheck size={15} className="text-emerald-600 dark:text-emerald-400" /> No payment details are collected on this page.</span>
          <span aria-hidden="true" className="hidden text-stone-300 dark:text-stone-700 sm:inline">•</span>
          <span className="inline-flex items-center gap-2"><Sparkles size={15} className="text-amber-600 dark:text-amber-400" /> Secure hosted checkout will be connected in a future stage.</span>
        </div>
      </section>
    </main>
  );
}
