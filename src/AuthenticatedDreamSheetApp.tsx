import { useState } from 'react';
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

function clearDreamSheetWorkingState() {
  localStorage.removeItem(LOCAL_PLAN_KEY);
  sessionStorage.removeItem(SESSION_PLAN_KEY);
  sessionStorage.removeItem(ACTIVE_CREATION_KEY);
}

export default function AuthenticatedDreamSheetApp() {
  const { loading, passwordRecovery, signOut, user } = useAuth();
  const [view, setView] = useState<ProtectedView>(() => sessionStorage.getItem(ACTIVE_CREATION_KEY) === 'true' ? 'journey' : 'dashboard');
  const [dashboardRefreshToken, setDashboardRefreshToken] = useState(0);
  const [savedDreamSheet, setSavedDreamSheet] = useState<SavedDreamSheet | null>(null);
  const [savedIntent, setSavedIntent] = useState<'view' | 'download' | 'email'>('view');
  const [openingSaved, setOpeningSaved] = useState(false);
  const [shellError, setShellError] = useState('');

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-stone-950 text-sm font-bold uppercase tracking-widest text-emerald-400">Loading DREAMsheet AI…</div>;
  }
  if (!user || passwordRecovery) return <AuthScreen />;

  const startNewDreamSheet = () => {
    clearDreamSheetWorkingState();
    sessionStorage.setItem(ACTIVE_CREATION_KEY, 'true');
    setSavedDreamSheet(null);
    setShellError('');
    setView('journey');
  };

  const returnToDashboard = () => {
    sessionStorage.removeItem(ACTIVE_CREATION_KEY);
    setSavedDreamSheet(null);
    setShellError('');
    setDashboardRefreshToken(value => value + 1);
    setView('dashboard');
  };

  const handleLogout = async () => {
    clearDreamSheetWorkingState();
    setSavedDreamSheet(null);
    setView('dashboard');
    await signOut();
  };

  const openSavedDreamSheet = async (id: string, intent: 'view' | 'download' | 'email' = 'view') => {
    setOpeningSaved(true);
    setShellError('');
    try {
      setSavedDreamSheet(await getMyDreamSheetById(id));
      setSavedIntent(intent);
      setView('saved');
    } catch (error) {
      setShellError(error instanceof Error ? error.message : 'This DREAMsheet could not be opened.');
    } finally {
      setOpeningSaved(false);
    }
  };

  if (view === 'saved' && savedDreamSheet) {
    return <SavedDreamSheetView submission={savedDreamSheet} onBack={returnToDashboard} initialIntent={savedIntent} />;
  }

  if (view === 'journey') {
    return (
      <>
        <App onSubmissionSaved={() => setDashboardRefreshToken(value => value + 1)} />
        <nav aria-label="Account navigation" className="fixed bottom-4 right-4 z-[10050] flex gap-2 rounded-2xl border border-stone-200 bg-white/95 p-2 shadow-2xl backdrop-blur">
          <button type="button" onClick={returnToDashboard} className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-100"><LayoutDashboard size={15} /> My DREAMsheets</button>
          <button type="button" onClick={() => void handleLogout()} className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50"><LogOut size={15} /> Logout</button>
        </nav>
      </>
    );
  }

  return (
    <>
      {openingSaved && <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 text-sm font-bold text-white backdrop-blur-sm">Opening DREAMsheet…</div>}
      <DreamSheetDashboard
        userEmail={user.email || 'Signed-in user'}
        refreshToken={dashboardRefreshToken}
        onCreate={startNewDreamSheet}
        onOpen={(id, intent) => void openSavedDreamSheet(id, intent)}
        onLogout={handleLogout}
        externalError={shellError}
      />
    </>
  );
}
