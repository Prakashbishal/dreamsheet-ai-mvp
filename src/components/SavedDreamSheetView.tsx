import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Download, Mail } from 'lucide-react';
import type { Domain } from '../types';
import type { SavedDreamSheet } from '../services/submissionService';
import { PrintableDreamSheet } from './PrintableDreamSheet';

interface SavedDreamSheetViewProps {
  submission: SavedDreamSheet;
  onBack: () => void;
  initialIntent?: 'view' | 'download' | 'email';
}

interface StoredPlanData {
  clientName?: string;
  coachName?: string;
  planNotes?: string;
  planCreatedAt?: string;
  finalDomains?: Domain[];
  domains?: Domain[];
}

function readPlanData(value: unknown): StoredPlanData {
  return value && typeof value === 'object' ? value as StoredPlanData : {};
}

function isDomain(value: unknown): value is Domain {
  if (!value || typeof value !== 'object') return false;
  const domain = value as Partial<Domain>;
  return typeof domain.id === 'string' && typeof domain.name === 'string' && Array.isArray(domain.subAreas);
}

export function SavedDreamSheetView({ submission, onBack, initialIntent = 'view' }: SavedDreamSheetViewProps) {
  const printableRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef<string | null>(null);
  const initialDownloadStartedRef = useRef(false);
  const [email, setEmail] = useState('');
  const [action, setAction] = useState<'download' | 'email' | null>(null);
  const [emailPhase, setEmailPhase] = useState<'creating' | 'sending' | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const plan = useMemo(() => readPlanData(submission.plan_data), [submission.plan_data]);
  const domains = useMemo(() => {
    const candidates = Array.isArray(plan.finalDomains) ? plan.finalDomains : Array.isArray(plan.domains) ? plan.domains : [];
    return candidates.filter(isDomain);
  }, [plan.domains, plan.finalDomains]);
  const clientName = plan.clientName || submission.client_name || '';
  const coachName = plan.coachName || submission.coach_name || '';
  const issuedDateValue = submission.created_at || plan.planCreatedAt;
  const issuedDate = issuedDateValue && !Number.isNaN(new Date(issuedDateValue).getTime())
    ? new Date(issuedDateValue).toLocaleDateString('en-GB')
    : 'Date unavailable';

  const handleDownload = async () => {
    if (action || !printableRef.current) return;
    setAction('download');
    setStatus(null);
    try {
      const { createDreamSheetFilename, generateDreamSheetPdf } = await import('../services/pdfService');
      const pdf = await generateDreamSheetPdf(printableRef.current);
      const url = URL.createObjectURL(pdf);
      const link = document.createElement('a');
      link.href = url;
      link.download = createDreamSheetFilename(clientName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch {
      setStatus({ type: 'error', message: "We couldn't create this PDF right now. Please try again." });
    } finally {
      setAction(null);
    }
  };

  const handleEmail = async () => {
    const recipient = email.trim();
    if (action) return;
    if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(recipient)) {
      setStatus({ type: 'error', message: 'Please enter a valid email address.' });
      return;
    }
    if (!printableRef.current) return;

    const requestId = requestIdRef.current || crypto.randomUUID();
    requestIdRef.current = requestId;
    setAction('email');
    setEmailPhase('creating');
    setStatus(null);
    try {
      const [{ createDreamSheetFilename, generateDreamSheetPdf, MAX_EMAIL_PDF_BYTES }, { sendDreamSheetEmail }] = await Promise.all([
        import('../services/pdfService'),
        import('../services/emailService'),
      ]);
      const pdf = await generateDreamSheetPdf(printableRef.current);
      if (pdf.size > MAX_EMAIL_PDF_BYTES) {
        setStatus({ type: 'error', message: 'This plan is too large to email. Please download the PDF instead.' });
        return;
      }
      setEmailPhase('sending');
      await sendDreamSheetEmail({ recipientEmail: recipient, coacheeName: clientName, coachName, requestId, pdf, filename: createDreamSheetFilename(clientName) });
      requestIdRef.current = null;
      setStatus({ type: 'success', message: 'Your DREAMsheet has been sent successfully.' });
    } catch {
      setStatus({ type: 'error', message: "We couldn't send your DREAMsheet right now. Please try again in a moment." });
    } finally {
      setAction(null);
      setEmailPhase(null);
    }
  };

  useEffect(() => {
    if (initialIntent === 'download' && domains.length > 0 && !initialDownloadStartedRef.current) {
      initialDownloadStartedRef.current = true;
      void handleDownload();
    }
  }, [initialIntent, domains.length]);

  return (
    <main className="min-h-screen bg-stone-100 text-stone-900">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-stone-950 px-4 py-4 text-white shadow-lg">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400">DREAMsheet AI</p><h1 className="mt-1 text-xl font-semibold">Completed Strategic Plan</h1></div>
          <button type="button" onClick={onBack} className="flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold hover:bg-white/10"><ArrowLeft size={17} /> Back to My DREAMsheets</button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-7">
        <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <button type="button" onClick={handleDownload} disabled={action !== null || domains.length === 0} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"><Download size={17} /> {action === 'download' ? 'Creating PDF…' : 'Download PDF'}</button>
            <label className="flex-1 text-xs font-bold uppercase tracking-wider text-stone-500">Email PDF
              <input type="email" value={email} onChange={event => { setEmail(event.target.value); requestIdRef.current = null; setStatus(null); }} disabled={action !== null || domains.length === 0} autoFocus={initialIntent === 'email'} placeholder="you@example.com" className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3 text-sm font-normal normal-case tracking-normal outline-none focus:border-emerald-600" />
            </label>
            <button type="button" onClick={handleEmail} disabled={action !== null || domains.length === 0 || !email.trim()} className="flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-5 py-3 text-sm font-bold text-white hover:bg-stone-800 disabled:opacity-60"><Mail size={17} /> {emailPhase === 'creating' ? 'Creating PDF…' : emailPhase === 'sending' ? 'Sending…' : 'Email PDF'}</button>
          </div>
          {status && <p role={status.type === 'error' ? 'alert' : 'status'} aria-live="polite" className={`mt-3 text-sm font-semibold ${status.type === 'success' ? 'text-emerald-700' : 'text-red-700'}`}>{status.message}</p>}
        </div>

        {domains.length === 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">This saved DREAMsheet does not contain readable completed-plan data.</div>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-white shadow-xl"><PrintableDreamSheet ref={printableRef} domains={domains} clientName={clientName} coachName={coachName} issuedDate={issuedDate} planNotes={plan.planNotes} /></div>
        )}
      </section>
    </main>
  );
}
