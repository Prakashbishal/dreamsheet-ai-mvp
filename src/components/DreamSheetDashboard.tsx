import { useEffect, useState } from 'react';
import { ArrowRight, Calendar, Download, FileText, LogOut, Mail, Plus, RefreshCw } from 'lucide-react';
import { getMyDreamSheets, type SavedDreamSheet } from '../services/submissionService';

interface DreamSheetDashboardProps {
  userEmail: string;
  refreshToken: number;
  onCreate: () => void;
  onOpen: (id: string, intent?: 'view' | 'download' | 'email') => void;
  onLogout: () => Promise<void>;
  externalError?: string;
}

function formatDate(value: string | null): string {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getDomainNames(submission: SavedDreamSheet): string[] {
  if (Array.isArray(submission.domains)) return submission.domains.filter((value): value is string => typeof value === 'string' && Boolean(value.trim()));
  return [];
}

export function DreamSheetDashboard({ userEmail, refreshToken, onCreate, onOpen, onLogout, externalError }: DreamSheetDashboardProps) {
  const [submissions, setSubmissions] = useState<SavedDreamSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  const loadSubmissions = async () => {
    setLoading(true);
    setError('');
    try {
      setSubmissions(await getMyDreamSheets());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Your DREAMsheets could not be loaded.');
    } finally {
      setLoading(false);
    }
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
    <main className="min-h-screen bg-[#FDFCFB] text-stone-900">
      <header className="border-b border-white/10 bg-stone-950 text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-emerald-400">DREAMsheet AI</p>
            <h1 className="mt-2 text-3xl font-light">My DREAMsheets</h1>
            <p className="mt-1 text-sm text-stone-400">{userEmail}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={onCreate} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700"><Plus size={17} /> Create New DREAMsheet</button>
            <button type="button" onClick={handleLogout} disabled={signingOut} className="flex items-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-sm font-bold text-stone-200 hover:bg-white/10 disabled:opacity-60"><LogOut size={17} /> {signingOut ? 'Signing out…' : 'Logout'}</button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-10">
        <div className="mb-7 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Your strategic plans</p>
            <h2 className="mt-2 text-2xl font-semibold">My DREAMsheets</h2>
          </div>
          <button type="button" onClick={() => void loadSubmissions()} disabled={loading} className="rounded-xl border border-stone-200 bg-white p-3 text-stone-500 hover:text-emerald-700 disabled:opacity-50" title="Refresh DREAMsheets"><RefreshCw size={17} className={loading ? 'animate-spin' : ''} /></button>
        </div>

        {(error || externalError) && <p role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error || externalError}</p>}

        {loading ? (
          <div className="rounded-3xl border border-stone-200 bg-white p-12 text-center text-sm text-stone-500">Loading your DREAMsheets…</div>
        ) : submissions.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-10 text-center shadow-sm">
            <FileText size={34} className="mx-auto text-emerald-600" />
            <h3 className="mt-5 text-xl font-semibold">You haven't created a DREAMsheet yet.</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-stone-500">Start your first guided strategic plan and it will appear here once saved.</p>
            <button type="button" onClick={onCreate} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 text-sm font-bold text-white hover:bg-emerald-700">Create Your First DREAMsheet <ArrowRight size={17} /></button>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {submissions.map(submission => {
              const domains = getDomainNames(submission);
              return (
                <article key={submission.id} className="flex flex-col rounded-3xl border border-stone-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><FileText size={21} /></div>
                    <span className="flex items-center gap-1.5 text-xs text-stone-400"><Calendar size={13} /> {formatDate(submission.created_at)}</span>
                  </div>
                  <h3 className="mt-5 text-xl font-semibold">{submission.client_name || 'DREAMsheet Strategic Plan'}</h3>
                  {submission.coach_name && <p className="mt-1 text-sm text-stone-500">Coach: {submission.coach_name}</p>}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {domains.slice(0, 4).map(domain => <span key={domain} className="rounded-full bg-stone-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-stone-600">{domain}</span>)}
                    {domains.length > 4 && <span className="rounded-full bg-stone-100 px-3 py-1 text-[10px] font-bold text-stone-500">+{domains.length - 4}</span>}
                  </div>
                  <div className="mt-auto grid grid-cols-3 gap-2 pt-7">
                    <button type="button" onClick={() => onOpen(submission.id, 'view')} className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-2 py-2.5 text-xs font-bold text-white hover:bg-emerald-700">View <ArrowRight size={14} /></button>
                    <button type="button" onClick={() => onOpen(submission.id, 'download')} className="flex items-center justify-center gap-1.5 rounded-xl border border-stone-200 px-2 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-50"><Download size={14} /> PDF</button>
                    <button type="button" onClick={() => onOpen(submission.id, 'email')} className="flex items-center justify-center gap-1.5 rounded-xl border border-stone-200 px-2 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-50"><Mail size={14} /> Email</button>
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
