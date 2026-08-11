import { useEffect, useState } from 'react';
import { ArrowRight, Calendar, Clock3, Download, FileText, LogOut, Mail, Plus, RefreshCw, UserRound } from 'lucide-react';
import { getMyDreamSheets, getMyRecentDrafts, type SavedDreamSheet } from '../services/submissionService';
import { BrandMark } from './BrandMark';

interface DreamSheetDashboardProps {
  userEmail: string;
  refreshToken: number;
  onCreate: () => void;
  onContinueDraft: (id: string) => void;
  onOpen: (id: string, intent?: 'view' | 'download' | 'email') => void;
  onLogout: () => Promise<void>;
  externalError?: string;
}

function formatDate(value: string | null): string {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatUpdatedAt(value: string | null): string {
  if (!value) return 'Update time unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Update time unavailable'
    : date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getDomainNames(submission: SavedDreamSheet): string[] {
  if (Array.isArray(submission.domains) && submission.domains.length) {
    return submission.domains.filter((value): value is string => typeof value === 'string' && Boolean(value.trim()));
  }

  if (submission.plan_data && typeof submission.plan_data === 'object' && !Array.isArray(submission.plan_data)) {
    const plan = submission.plan_data as Record<string, unknown>;
    if (Array.isArray(plan.selectedRoles)) {
      const selectedRoles = plan.selectedRoles.filter((value): value is string => typeof value === 'string' && Boolean(value.trim()));
      if (selectedRoles.length) return selectedRoles;
    }
    if (Array.isArray(plan.domains)) {
      return plan.domains.flatMap(domain => {
        if (!domain || typeof domain !== 'object' || Array.isArray(domain)) return [];
        const name = (domain as Record<string, unknown>).name;
        return typeof name === 'string' && name.trim() ? [name] : [];
      });
    }
  }
  return [];
}

export function DreamSheetDashboard({ userEmail, refreshToken, onCreate, onContinueDraft, onOpen, onLogout, externalError }: DreamSheetDashboardProps) {
  const [submissions, setSubmissions] = useState<SavedDreamSheet[]>([]);
  const [drafts, setDrafts] = useState<SavedDreamSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draftError, setDraftError] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  const loadSubmissions = async () => {
    setLoading(true);
    setError('');
    setDraftError('');

    const [completedResult, draftResult] = await Promise.allSettled([
      getMyDreamSheets(),
      getMyRecentDrafts(),
    ]);

    if (completedResult.status === 'fulfilled') {
      setSubmissions(completedResult.value);
    } else {
      setError(completedResult.reason instanceof Error ? completedResult.reason.message : 'Your DREAMSheets could not be loaded.');
    }

    if (draftResult.status === 'fulfilled') {
      setDrafts(draftResult.value);
    } else {
      setDraftError(draftResult.reason instanceof Error ? draftResult.reason.message : 'Your unfinished drafts could not be loaded.');
    }

    setLoading(false);
  };

  useEffect(() => {
    void loadSubmissions();
  }, [refreshToken]);

  const handleLogout = async () => {
    setSigningOut(true);
    setError('');
    try {
      await onLogout();
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : 'You could not be signed out. Please try again.');
      setSigningOut(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F8F7F4] text-stone-900">
      <header className="relative overflow-hidden border-b border-white/10 bg-stone-950 text-white">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(16,185,129,0.14),transparent_32%),radial-gradient(circle_at_82%_10%,rgba(255,255,255,0.05),transparent_24%)]" />
        <div className="relative mx-auto max-w-6xl px-5 py-6 sm:px-6 sm:py-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <BrandMark tone="light" size="lg" />
            <div className="flex flex-col gap-3 sm:items-end">
              <div className="flex min-w-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-stone-300">
                <UserRound size={14} className="shrink-0 text-emerald-400" />
                <span className="truncate">{userEmail}</span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={signingOut}
                className="inline-flex items-center justify-center gap-2 self-start rounded-lg px-2 py-1 text-xs font-bold text-stone-400 outline-none transition hover:text-white focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60 sm:self-auto"
              >
                <LogOut size={14} /> {signingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-6 border-t border-white/10 pt-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-400">Your planning workspace</p>
              <h1 className="mt-3 text-3xl font-light tracking-[-0.035em] sm:text-4xl">My DREAMSheets</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-stone-400">Return to your strategic plans or create a fresh space for the next goal that matters.</p>
            </div>
            <button
              type="button"
              onClick={onCreate}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-950/30 outline-none transition hover:-translate-y-0.5 hover:bg-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950"
            >
              <Plus size={17} /> Create New DREAMSheet
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-12">
        {error || externalError ? (
          <p role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{externalError || error}</p>
        ) : null}

        {draftError ? (
          <p role="status" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{draftError} Your completed DREAMSheets are still available below.</p>
        ) : null}

        {!loading && drafts.length > 0 ? (
          <div className="mb-12">
            <div className="mb-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-700">Work in progress</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Continue your DREAMSheet</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">Pick up securely from your latest cloud-saved progress.</p>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {drafts.map(draft => {
                const domains = getDomainNames(draft);
                return (
                  <article key={draft.id} className="group flex flex-col overflow-hidden rounded-3xl border border-amber-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-amber-300 hover:shadow-[0_18px_45px_rgba(28,25,23,0.09)] focus-within:border-amber-400">
                    <div className="h-1 bg-gradient-to-r from-amber-500 via-amber-300 to-emerald-300" />
                    <div className="flex flex-1 flex-col p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 transition group-hover:bg-amber-100"><FileText size={21} /></div>
                        <span className="flex items-center gap-1.5 text-right text-xs text-stone-500"><Clock3 size={13} className="shrink-0" /> {formatUpdatedAt(draft.updated_at)}</span>
                      </div>
                      <h3 className="mt-5 text-xl font-semibold tracking-tight">{draft.client_name || 'Unfinished DREAMSheet'}</h3>
                      {draft.coach_name ? <p className="mt-1 text-sm text-stone-500">Coach: {draft.coach_name}</p> : null}
                      <div className="mt-4 flex min-h-7 flex-wrap gap-2">
                        {domains.slice(0, 4).map(domain => <span key={domain} className="rounded-full bg-stone-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-stone-600">{domain}</span>)}
                        {domains.length > 4 ? <span className="rounded-full bg-stone-100 px-3 py-1 text-[10px] font-bold text-stone-500">+{domains.length - 4}</span> : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => onContinueDraft(draft.id)}
                        className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-5 py-3 text-sm font-bold text-white outline-none transition hover:bg-stone-800 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
                      >
                        Continue <ArrowRight size={16} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="mb-7 flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-700">Saved strategic plans</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Your DREAMSheets</h2>
          </div>
          <button
            type="button"
            onClick={() => void loadSubmissions()}
            disabled={loading}
            className="rounded-xl border border-stone-200 bg-white p-3 text-stone-500 shadow-sm outline-none transition hover:border-emerald-200 hover:text-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50"
            aria-label="Refresh DREAMSheets"
            title="Refresh DREAMSheets"
          >
            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {loading ? (
          <div role="status" className="grid gap-5 md:grid-cols-2 lg:grid-cols-3" aria-label="Loading your DREAMSheets">
            {[0, 1, 2].map(item => (
              <div key={item} className="h-64 animate-pulse rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
                <div className="h-11 w-11 rounded-2xl bg-stone-100" />
                <div className="mt-7 h-5 w-2/3 rounded bg-stone-100" />
                <div className="mt-3 h-3 w-1/2 rounded bg-stone-100" />
                <div className="mt-16 h-10 rounded-xl bg-stone-100" />
              </div>
            ))}
            <span className="sr-only">Loading your DREAMSheets…</span>
          </div>
        ) : submissions.length === 0 ? (
          <div className="relative overflow-hidden rounded-[2rem] border border-dashed border-stone-300 bg-white px-6 py-14 text-center shadow-sm sm:px-10">
            <div aria-hidden="true" className="absolute left-1/2 top-0 h-40 w-80 -translate-x-1/2 rounded-full bg-emerald-50 blur-3xl" />
            <div className="relative">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-700"><FileText size={27} /></div>
              <div className="mt-5"><BrandMark variant="compact" size="sm" /></div>
              <h3 className="mt-4 text-xl font-semibold">{drafts.length ? 'No completed DREAMSheets yet.' : 'You haven’t created a DREAMSheet yet.'}</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-500">{drafts.length ? 'Continue an unfinished plan above, or start a fresh DREAMSheet.' : 'Start a guided strategic plan. Once saved, it will be ready for you here.'}</p>
              <button type="button" onClick={onCreate} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 text-sm font-bold text-white outline-none transition hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">Create Your First DREAMSheet <ArrowRight size={17} /></button>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {submissions.map(submission => {
              const domains = getDomainNames(submission);
              return (
                <article key={submission.id} className="group flex flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-[0_18px_45px_rgba(28,25,23,0.09)] focus-within:border-emerald-300">
                  <div className="h-1 bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-200 opacity-70" />
                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 transition group-hover:bg-emerald-100"><FileText size={21} /></div>
                      <span className="flex items-center gap-1.5 text-xs text-stone-400"><Calendar size={13} /> {formatDate(submission.created_at)}</span>
                    </div>
                    <h3 className="mt-5 text-xl font-semibold tracking-tight">{submission.client_name || 'DREAMSheet Strategic Plan'}</h3>
                    {submission.coach_name ? <p className="mt-1 text-sm text-stone-500">Coach: {submission.coach_name}</p> : null}
                    <div className="mt-4 flex min-h-7 flex-wrap gap-2">
                      {domains.slice(0, 4).map(domain => <span key={domain} className="rounded-full bg-stone-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-stone-600">{domain}</span>)}
                      {domains.length > 4 ? <span className="rounded-full bg-stone-100 px-3 py-1 text-[10px] font-bold text-stone-500">+{domains.length - 4}</span> : null}
                    </div>
                    <div className="mt-auto grid grid-cols-3 gap-2 pt-7">
                      <button type="button" onClick={() => onOpen(submission.id, 'view')} className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-2 py-2.5 text-xs font-bold text-white outline-none transition hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500">View <ArrowRight size={14} /></button>
                      <button type="button" onClick={() => onOpen(submission.id, 'download')} className="flex items-center justify-center gap-1.5 rounded-xl border border-stone-200 px-2 py-2.5 text-xs font-bold text-stone-700 outline-none transition hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-emerald-500"><Download size={14} /> PDF</button>
                      <button type="button" onClick={() => onOpen(submission.id, 'email')} className="flex items-center justify-center gap-1.5 rounded-xl border border-stone-200 px-2 py-2.5 text-xs font-bold text-stone-700 outline-none transition hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-emerald-500"><Mail size={14} /> Email</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
