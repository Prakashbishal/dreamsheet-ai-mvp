import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, ExternalLink, FileDown, KeyRound, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import type { DreamKeyDisplayPlan, DreamKeyPlanId } from '../config/dreamKeyPlans';
import {
  beginDreamKeyCheckout,
  DreamKeyServiceError,
  getDreamKeyBalance,
  getDreamKeyBillingHistory,
  getDreamKeyCheckoutStatus,
  getDreamKeyPlans,
  redeemDreamKeyCode,
} from '../services/dreamKeyService';
import type { DreamKeyBalance, DreamKeyBillingHistoryEntry } from '../types/dreamKey';
import { BrandMark } from './BrandMark';
import { DreamKeyMark } from './DreamKeyMark';

interface DreamKeyPlansPageProps {
  onBack: () => void;
  onStartDreamSheet: () => void;
}

type CheckoutReturn =
  | { outcome: 'none' }
  | { outcome: 'cancelled' }
  | { outcome: 'success'; sessionId: string | null };

interface CheckoutConfirmation {
  message: string;
  confirmed: boolean;
  retryable: boolean;
  balance: DreamKeyBalance | null;
}

function readCheckoutReturn(): CheckoutReturn {
  const parameters = new URLSearchParams(window.location.search);
  const outcome = parameters.get('dreamkey_checkout');
  if (outcome === 'cancelled') return { outcome: 'cancelled' };
  if (outcome === 'success') {
    return { outcome: 'success', sessionId: parameters.get('session_id') };
  }
  return { outcome: 'none' };
}

async function loadCheckoutConfirmation(sessionId: string): Promise<CheckoutConfirmation> {
  const status = await getDreamKeyCheckoutStatus(sessionId);
  if (!status || status.status === 'pending') {
    return {
      message: 'Payment confirmation is still processing. Your DREAMKey will appear automatically after the secure webhook completes.',
      confirmed: false,
      retryable: true,
      balance: null,
    };
  }
  if (status.kind === 'purchase' && status.status === 'paid' && status.keysGranted === 1) {
    const balance = await getDreamKeyBalance();
    return {
      message: `Payment confirmed. +1 DREAMKey granted; ${balance.available} currently available.`,
      confirmed: true,
      retryable: false,
      balance,
    };
  }
  if (status.kind === 'subscription'
    && ['active', 'cancelled'].includes(status.status)
    && status.keysGranted > 0) {
    const balance = await getDreamKeyBalance();
    return {
      message: `Subscription payment confirmed. +${status.keysGranted} DREAMKey${status.keysGranted === 1 ? '' : 's'} granted so far; ${balance.available} currently available.`,
      confirmed: true,
      retryable: false,
      balance,
    };
  }
  if (status.status === 'failed' || status.status === 'past_due') {
    return {
      message: 'The payment was not completed. No DREAMKey has been issued.',
      confirmed: false,
      retryable: false,
      balance: null,
    };
  }
  return {
    message: 'This checkout is not eligible for a new DREAMKey. Please contact support if you believe this is incorrect.',
    confirmed: false,
    retryable: false,
    balance: null,
  };
}

function formatMoney(amountMinor: number | null, currency: string | null): string {
  if (amountMinor === null || !currency) return 'Amount unavailable';
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amountMinor / 100);
  } catch {
    return `${currency} ${(amountMinor / 100).toFixed(2)}`;
  }
}

function formatPaymentDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatReference(value: string | null): string {
  if (!value) return 'Unavailable';
  return value.length <= 20 ? value : `${value.slice(0, 9)}...${value.slice(-7)}`;
}

export function DreamKeyPlansPage({ onBack, onStartDreamSheet }: DreamKeyPlansPageProps) {
  const plans = getDreamKeyPlans();
  const [checkoutReturn] = useState<CheckoutReturn>(readCheckoutReturn);
  const [pendingPlanId, setPendingPlanId] = useState<DreamKeyPlanId | null>(null);
  const [code, setCode] = useState('');
  const [applyingCode, setApplyingCode] = useState(false);
  const [commerceMessage, setCommerceMessage] = useState(() => {
    if (checkoutReturn.outcome === 'cancelled') {
      return 'Checkout was cancelled. No payment was confirmed and no DREAMKey has been issued.';
    }
    if (checkoutReturn.outcome === 'success') {
      return checkoutReturn.sessionId
        ? 'Payment received. Confirming your DREAMKey…'
        : 'Payment confirmation could not be checked because the checkout reference is missing.';
    }
    return '';
  });
  const [checkingPayment, setCheckingPayment] = useState(checkoutReturn.outcome === 'success' && Boolean(checkoutReturn.sessionId));
  const [checkoutConfirmed, setCheckoutConfirmed] = useState(false);
  const [checkoutRetryable, setCheckoutRetryable] = useState(false);
  const [balance, setBalance] = useState<DreamKeyBalance | null>(null);
  const [billingHistory, setBillingHistory] = useState<DreamKeyBillingHistoryEntry[]>([]);
  const [walletLoading, setWalletLoading] = useState(true);
  const [walletError, setWalletError] = useState('');

  const refreshWallet = async () => {
    setWalletLoading(true);
    setWalletError('');
    const [balanceResult, historyResult] = await Promise.allSettled([
      getDreamKeyBalance(),
      getDreamKeyBillingHistory(),
    ]);
    if (balanceResult.status === 'fulfilled') setBalance(balanceResult.value);
    else setWalletError('Your DREAMKey balance could not be refreshed.');
    if (historyResult.status === 'fulfilled') setBillingHistory(historyResult.value);
    else setWalletError(previous => previous || 'Your payment history could not be loaded.');
    setWalletLoading(false);
  };

  useEffect(() => {
    void refreshWallet();
  }, []);

  useEffect(() => {
    if (checkoutReturn.outcome === 'none') return;
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('dreamkey_checkout');
    cleanUrl.searchParams.delete('session_id');
    window.history.replaceState(
      window.history.state,
      '',
      `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`,
    );
  }, [checkoutReturn]);

  useEffect(() => {
    if (checkoutReturn.outcome !== 'success' || !checkoutReturn.sessionId) return;

    let cancelled = false;
    const checkUntilSettled = async () => {
      setCheckingPayment(true);
      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          const confirmation = await loadCheckoutConfirmation(checkoutReturn.sessionId!);
          if (cancelled) return;
          setCommerceMessage(confirmation.message);
          setCheckoutConfirmed(confirmation.confirmed);
          setCheckoutRetryable(confirmation.retryable);
          if (confirmation.balance) setBalance(confirmation.balance);
          if (confirmation.confirmed) void refreshWallet();
          if (!confirmation.retryable) return;
        } catch (error) {
          if (cancelled) return;
          console.error('Could not confirm DREAMKey checkout status.', error);
          setCommerceMessage('Payment confirmation is temporarily unavailable. No DREAMKey has been issued from this page. Please retry shortly.');
          setCheckoutRetryable(true);
          return;
        }
        await new Promise(resolve => window.setTimeout(resolve, 1500));
      }
      if (!cancelled) setCheckingPayment(false);
    };

    void checkUntilSettled().finally(() => {
      if (!cancelled) setCheckingPayment(false);
    });
    return () => {
      cancelled = true;
    };
  }, [checkoutReturn]);

  const retryCheckoutConfirmation = async () => {
    if (checkoutReturn.outcome !== 'success' || !checkoutReturn.sessionId) return;
    setCheckingPayment(true);
    try {
      const confirmation = await loadCheckoutConfirmation(checkoutReturn.sessionId);
      setCommerceMessage(confirmation.message);
      setCheckoutConfirmed(confirmation.confirmed);
      setCheckoutRetryable(confirmation.retryable);
      if (confirmation.balance) setBalance(confirmation.balance);
      if (confirmation.confirmed) await refreshWallet();
    } catch (error) {
      console.error('Could not confirm DREAMKey checkout status.', error);
      setCommerceMessage('Payment confirmation is temporarily unavailable. No DREAMKey has been issued from this page. Please retry shortly.');
      setCheckoutRetryable(true);
    } finally {
      setCheckingPayment(false);
    }
  };

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
      if (error instanceof DreamKeyServiceError) {
        setCommerceMessage(error.message);
      } else {
        console.error('Could not begin DREAMKey checkout.', error);
        setCommerceMessage('Secure checkout is temporarily unavailable. Please try again.');
      }
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
        await refreshWallet();
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

  const checkoutHistoryEntry = checkoutReturn.outcome === 'success'
    ? billingHistory.find(entry => entry.checkoutSessionId === checkoutReturn.sessionId) || null
    : null;

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
        <div className="mb-10 flex flex-col gap-5 rounded-[1.75rem] border border-stone-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-stone-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <DreamKeyMark variant="compact" size="md" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-400">Your wallet</p>
              {balance ? (
                <p className="mt-1 text-2xl font-semibold"><span className="text-emerald-700 dark:text-emerald-400">{balance.available}</span> available <span className="ml-2 text-sm font-medium text-stone-500">- {balance.reserved} reserved</span></p>
              ) : (
                <p className="mt-1 text-sm text-stone-500">{walletLoading ? 'Loading DREAMKeys...' : walletError}</p>
              )}
            </div>
          </div>
          <button type="button" onClick={() => void refreshWallet()} disabled={walletLoading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-stone-200 px-4 text-sm font-bold outline-none transition hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/5">
            <RefreshCw size={15} className={walletLoading ? 'animate-spin' : ''} /> Refresh wallet
          </button>
        </div>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-700 dark:text-emerald-400">Choose your path</p>
          <h2 id="dreamkey-plans-heading" className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">DREAMKeys for the way you plan</h2>
          <p className="mt-4 text-sm leading-7 text-stone-600 dark:text-stone-400 sm:text-base">
            DREAMKeys give you access to complete DREAMSheet journeys. Choose the option that fits how you want to use DREAMSheet.
          </p>
        </div>

        {commerceMessage ? (
          <div className={checkoutConfirmed
            ? 'mx-auto mt-8 max-w-3xl rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-center text-sm font-semibold leading-6 text-emerald-950 dark:border-emerald-300/20 dark:bg-emerald-300/10 dark:text-emerald-100'
            : 'mx-auto mt-8 max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-center text-sm font-semibold leading-6 text-amber-950 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100'} role="status" aria-live="polite">
            <p>{commerceMessage}</p>
            {checkoutConfirmed ? (
              <div className="mt-4">
                {checkoutHistoryEntry ? (
                  <dl className="mx-auto mb-4 grid max-w-2xl gap-3 rounded-xl border border-emerald-700/10 bg-white/60 p-4 text-left text-xs sm:grid-cols-2 dark:bg-stone-950/20">
                    <div><dt className="font-bold uppercase tracking-wide text-emerald-800/70 dark:text-emerald-200/70">Plan</dt><dd className="mt-1 font-semibold">{checkoutHistoryEntry.planName} - {checkoutHistoryEntry.kind === 'subscription' ? 'Subscription' : 'One-time'}</dd></div>
                    <div><dt className="font-bold uppercase tracking-wide text-emerald-800/70 dark:text-emerald-200/70">Payment</dt><dd className="mt-1 font-semibold">{formatMoney(checkoutHistoryEntry.amountMinor, checkoutHistoryEntry.currency)} - {formatPaymentDate(checkoutHistoryEntry.paidAt)}</dd></div>
                    <div><dt className="font-bold uppercase tracking-wide text-emerald-800/70 dark:text-emerald-200/70">DREAMKeys granted</dt><dd className="mt-1 font-semibold">+{checkoutHistoryEntry.keysGranted}</dd></div>
                    <div><dt className="font-bold uppercase tracking-wide text-emerald-800/70 dark:text-emerald-200/70">Reference</dt><dd className="mt-1 font-mono">{formatReference(checkoutHistoryEntry.reference)}</dd></div>
                  </dl>
                ) : null}
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button type="button" onClick={onStartDreamSheet} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-500"><KeyRound size={16} /> Start DREAMSheet</button>
                {checkoutHistoryEntry?.receiptUrl ? (
                  <a href={checkoutHistoryEntry.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-700/20 px-4 py-2.5 text-sm font-bold"><ExternalLink size={15} /> View receipt</a>
                ) : null}
                {checkoutHistoryEntry?.hostedInvoiceUrl ? (
                  <a href={checkoutHistoryEntry.hostedInvoiceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-700/20 px-4 py-2.5 text-sm font-bold"><ExternalLink size={15} /> View invoice</a>
                ) : null}
                </div>
              </div>
            ) : null}
            {checkoutReturn.outcome === 'success' && checkoutRetryable ? (
              <button
                type="button"
                onClick={() => void retryCheckoutConfirmation()}
                disabled={checkingPayment}
                className="mt-3 rounded-lg border border-current/20 px-4 py-2 text-xs font-bold outline-none transition hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-white/5"
              >
                {checkingPayment ? 'Checking…' : 'Check again'}
              </button>
            ) : null}
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

        <section aria-labelledby="dreamkey-history-heading" className="mt-10 rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-stone-900 sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-400">Payment proof</p>
              <h2 id="dreamkey-history-heading" className="mt-2 text-2xl font-semibold tracking-tight">DREAMKey payment history</h2>
            </div>
            {walletError ? <p role="status" className="text-xs text-amber-700 dark:text-amber-300">{walletError}</p> : null}
          </div>
          {walletLoading && billingHistory.length === 0 ? (
            <p className="mt-6 text-sm text-stone-500">Loading payment history...</p>
          ) : billingHistory.length === 0 ? (
            <p className="mt-6 rounded-2xl bg-stone-50 px-5 py-6 text-sm text-stone-500 dark:bg-white/5 dark:text-stone-400">No completed DREAMKey payments yet.</p>
          ) : (
            <div className="mt-6 space-y-3">
              {billingHistory.map(entry => (
                <article key={entry.id} className="grid gap-4 rounded-2xl border border-stone-200 p-5 dark:border-white/10 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.7fr))_auto] md:items-center">
                  <div><p className="font-bold">{entry.planName}</p><p className="mt-1 text-xs text-stone-500">{entry.kind === 'subscription' ? 'Subscription payment' : 'One-time payment'} - {entry.keysGranted} key{entry.keysGranted === 1 ? '' : 's'}</p></div>
                  <div><p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Amount</p><p className="mt-1 text-sm font-semibold">{formatMoney(entry.amountMinor, entry.currency)}</p></div>
                  <div><p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Paid</p><p className="mt-1 text-sm">{formatPaymentDate(entry.paidAt)}</p></div>
                  <div><p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Reference</p><p className="mt-1 font-mono text-xs">{formatReference(entry.reference)}</p></div>
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    {entry.receiptUrl ? <a href={entry.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-2 text-xs font-bold hover:bg-stone-50 dark:border-white/10 dark:hover:bg-white/5"><ExternalLink size={13} /> Receipt</a> : null}
                    {entry.hostedInvoiceUrl ? <a href={entry.hostedInvoiceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-2 text-xs font-bold hover:bg-stone-50 dark:border-white/10 dark:hover:bg-white/5"><ExternalLink size={13} /> Invoice</a> : null}
                    {entry.invoicePdfUrl ? <a href={entry.invoicePdfUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-2 text-xs font-bold hover:bg-stone-50 dark:border-white/10 dark:hover:bg-white/5"><FileDown size={13} /> PDF</a> : null}
                    {!entry.receiptUrl && !entry.hostedInvoiceUrl && !entry.invoicePdfUrl ? <span className="text-xs text-stone-400">Proof unavailable</span> : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 text-center text-xs leading-5 text-stone-500 dark:text-stone-400 sm:flex-row">
          <span className="inline-flex items-center gap-2"><ShieldCheck size={15} className="text-emerald-600 dark:text-emerald-400" /> No payment details are collected on this page.</span>
          <span aria-hidden="true" className="hidden text-stone-300 dark:text-stone-700 sm:inline">•</span>
          <span className="inline-flex items-center gap-2"><Sparkles size={15} className="text-amber-600 dark:text-amber-400" /> Single DREAMKey purchases use Stripe secure hosted checkout.</span>
        </div>
      </section>
    </main>
  );
}
