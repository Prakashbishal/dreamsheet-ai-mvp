import { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutDashboard, LogOut } from 'lucide-react';
import App from './App';
import { AuthScreen } from './components/AuthScreen';
import { DreamSheetDashboard } from './components/DreamSheetDashboard';
import { SavedDreamSheetView } from './components/SavedDreamSheetView';
import { useAuth } from './contexts/AuthContext';
import { getMyDreamSheetById, type SavedDreamSheet } from './services/submissionService';

const ACTIVE_CREATION_KEY = 'dreamsheet_active_creation';
const LOCAL_PLAN_KEY = 'coaching_plan_state';
const SESSION_PLAN_KEY = 'dreamsheet_session_state';

type ProtectedView = 'dashboard' | 'journey' | 'saved';
type SavedIntent = 'view' | 'download' | 'email';

type DreamSheetShellHistory =
  | { view: 'dashboard' }
  | { view: 'journey'; fromDashboard?: boolean }
  | { view: 'saved'; savedId: string; fromDashboard?: boolean };

function getShellHistoryState(state: unknown = window.history.state): DreamSheetShellHistory | null {
  if (!state || typeof state !== 'object') return null;
  const shell = (state as Record<string, unknown>).dreamsheetShell;
  if (!shell || typeof shell !== 'object') return null;

  const value = shell as Record<string, unknown>;
  if (value.view === 'dashboard') return { view: 'dashboard' };
  if (value.view === 'journey') {
    return { view: 'journey', fromDashboard: value.fromDashboard === true };
  }
  if (value.view === 'saved' && typeof value.savedId === 'string' && value.savedId) {
    return { view: 'saved', savedId: value.savedId, fromDashboard: value.fromDashboard === true };
  }
  return null;
}

function mergeShellHistoryState(shell: DreamSheetShellHistory) {
  const currentState = window.history.state;
  const existingState = currentState && typeof currentState === 'object'
    ? currentState as Record<string, unknown>
    : {};
  return { ...existingState, dreamsheetShell: shell };
}

function replaceShellHistoryState(shell: DreamSheetShellHistory) {
  window.history.replaceState(mergeShellHistoryState(shell), '', window.location.href);
}

function pushShellHistoryState(shell: DreamSheetShellHistory) {
  window.history.pushState(mergeShellHistoryState(shell), '', window.location.href);
}

function getInitialProtectedView(): Exclude<ProtectedView, 'saved'> {
  if (typeof window === 'undefined') return 'dashboard';
  const shell = getShellHistoryState();
  if (shell?.view === 'dashboard' || shell?.view === 'journey') return shell.view;
  if (shell?.view === 'saved') return 'dashboard';
  return sessionStorage.getItem(ACTIVE_CREATION_KEY) === 'true' ? 'journey' : 'dashboard';
}

function clearDreamSheetWorkingState() {
  localStorage.removeItem(LOCAL_PLAN_KEY);
  sessionStorage.removeItem(SESSION_PLAN_KEY);
  sessionStorage.removeItem(ACTIVE_CREATION_KEY);
}

export default function AuthenticatedDreamSheetApp() {
  const { loading, passwordRecovery, signOut, user } = useAuth();
  const [view, setView] = useState<ProtectedView>(getInitialProtectedView);
  const [dashboardRefreshToken, setDashboardRefreshToken] = useState(0);
  const [savedDreamSheet, setSavedDreamSheet] = useState<SavedDreamSheet | null>(null);
  const [savedIntent, setSavedIntent] = useState<SavedIntent>('view');
  const [openingSaved, setOpeningSaved] = useState(false);
  const [shellError, setShellError] = useState('');
  const savedLoadRequestRef = useRef(0);
  const returningToDashboardRef = useRef(false);
  const displayedAuthScreenRef = useRef(false);

  const showDashboard = useCallback((replaceHistory = false) => {
    savedLoadRequestRef.current += 1;
    setOpeningSaved(false);
    setSavedDreamSheet(null);
    setShellError('');
    setDashboardRefreshToken(value => value + 1);
    setView('dashboard');
    if (replaceHistory) replaceShellHistoryState({ view: 'dashboard' });
  }, []);

  const loadSavedDreamSheet = useCallback(async (
    id: string,
    intent: SavedIntent,
    historyMode: 'push' | 'restore',
  ) => {
    const requestId = ++savedLoadRequestRef.current;
    setOpeningSaved(true);
    setShellError('');

    try {
      const submission = await getMyDreamSheetById(id);
      if (requestId !== savedLoadRequestRef.current) return;

      if (historyMode === 'restore') {
        const currentShell = getShellHistoryState();
        if (currentShell?.view !== 'saved' || currentShell.savedId !== id) return;
      } else {
        pushShellHistoryState({ view: 'saved', savedId: id, fromDashboard: true });
      }

      setSavedDreamSheet(submission);
      setSavedIntent(intent);
      setView('saved');
    } catch (error) {
      if (requestId !== savedLoadRequestRef.current) return;
      setSavedDreamSheet(null);
      setShellError(error instanceof Error ? error.message : 'This DREAMSheet could not be opened.');
      setView('dashboard');
      if (historyMode === 'restore') replaceShellHistoryState({ view: 'dashboard' });
    } finally {
      if (requestId === savedLoadRequestRef.current) setOpeningSaved(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && (!user || passwordRecovery)) displayedAuthScreenRef.current = true;
  }, [loading, passwordRecovery, user]);

  useEffect(() => {
    if (!user || passwordRecovery) return;

    const initialView = displayedAuthScreenRef.current ? 'dashboard' : getInitialProtectedView();
    displayedAuthScreenRef.current = false;
    setSavedDreamSheet(null);
    setShellError('');
    setView(initialView);

    const existingShell = getShellHistoryState();
    if (initialView === 'journey') {
      replaceShellHistoryState(existingShell?.view === 'journey'
        ? existingShell
        : { view: 'journey' });
    } else {
      replaceShellHistoryState({ view: 'dashboard' });
    }

    const handlePopState = (event: PopStateEvent) => {
      const shell = getShellHistoryState(event.state);

      if (returningToDashboardRef.current) {
        if (shell?.view === 'dashboard') {
          returningToDashboardRef.current = false;
          showDashboard();
          return;
        }
        if (shell?.fromDashboard) {
          window.setTimeout(() => window.history.back(), 0);
          return;
        }
        returningToDashboardRef.current = false;
        showDashboard(true);
        return;
      }

      if (!shell) return;

      if (shell.view === 'dashboard') {
        showDashboard();
        return;
      }

      if (shell.view === 'journey') {
        savedLoadRequestRef.current += 1;
        sessionStorage.setItem(ACTIVE_CREATION_KEY, 'true');
        setOpeningSaved(false);
        setSavedDreamSheet(null);
        setShellError('');
        setView('journey');
        return;
      }

      void loadSavedDreamSheet(shell.savedId, 'view', 'restore');
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      savedLoadRequestRef.current += 1;
      returningToDashboardRef.current = false;
      window.removeEventListener('popstate', handlePopState);
    };
  }, [loadSavedDreamSheet, passwordRecovery, showDashboard, user?.id]);

  const startNewDreamSheet = () => {
    clearDreamSheetWorkingState();
    sessionStorage.setItem(ACTIVE_CREATION_KEY, 'true');
    setSavedDreamSheet(null);
    setShellError('');
    pushShellHistoryState({ view: 'journey', fromDashboard: true });
    setView('journey');
  };

  const returnToDashboard = () => {
    const shell = getShellHistoryState();
    setShellError('');

    if (shell?.view !== 'dashboard' && shell?.fromDashboard) {
      returningToDashboardRef.current = true;
      window.history.back();
      return;
    }

    showDashboard(true);
  };

  const handleLogout = async () => {
    savedLoadRequestRef.current += 1;
    returningToDashboardRef.current = false;
    clearDreamSheetWorkingState();
    setOpeningSaved(false);
    setSavedDreamSheet(null);
    setView('dashboard');
    replaceShellHistoryState({ view: 'dashboard' });
    await signOut();
  };

  const openSavedDreamSheet = (id: string, intent: SavedIntent = 'view') => {
    void loadSavedDreamSheet(id, intent, 'push');
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-stone-950 text-sm font-bold uppercase tracking-widest text-emerald-400">Loading DREAMSheet AI…</div>;
  }
  if (!user || passwordRecovery) return <AuthScreen />;

  if (view === 'saved' && savedDreamSheet) {
    return <SavedDreamSheetView submission={savedDreamSheet} onBack={returnToDashboard} initialIntent={savedIntent} />;
  }

  if (view === 'journey') {
    return (
      <>
        <App onSubmissionSaved={() => setDashboardRefreshToken(value => value + 1)} />
        <nav aria-label="Account navigation" className="fixed bottom-4 right-4 z-[10050] flex gap-2 rounded-2xl border border-stone-200 bg-white/95 p-2 shadow-2xl backdrop-blur">
          <button type="button" onClick={returnToDashboard} className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-100"><LayoutDashboard size={15} /> My DREAMSheets</button>
          <button type="button" onClick={() => void handleLogout()} className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50"><LogOut size={15} /> Logout</button>
        </nav>
      </>
    );
  }

  return (
    <>
      {openingSaved && <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 text-sm font-bold text-white backdrop-blur-sm">Opening DREAMSheet…</div>}
      <DreamSheetDashboard
        userEmail={user.email || 'Signed-in user'}
        refreshToken={dashboardRefreshToken}
        onCreate={startNewDreamSheet}
        onOpen={openSavedDreamSheet}
        onLogout={handleLogout}
        externalError={shellError}
      />
    </>
  );
}
