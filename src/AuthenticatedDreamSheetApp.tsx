import { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutDashboard, LogOut } from 'lucide-react';
import App from './App';
import { AuthScreen } from './components/AuthScreen';
import { DreamSheetDashboard } from './components/DreamSheetDashboard';
import { DreamKeyPlansPage } from './components/DreamKeyPlansPage';
import { SavedDreamSheetView } from './components/SavedDreamSheetView';
import { useAuth } from './contexts/AuthContext';
import {
  getMyDreamSheetById,
  getMyDreamSheetDraftById,
  type SavedDreamSheet,
} from './services/submissionService';
import { CoachingStep, type Domain } from './types';

const ACTIVE_CREATION_KEY = 'dreamsheet_active_creation';
const LOCAL_PLAN_KEY = 'coaching_plan_state';
const SESSION_PLAN_KEY = 'dreamsheet_session_state';
const CLOUD_DRAFT_JOURNEY_KEY = 'dreamsheet_cloud_draft_journey:v1';

interface CloudDraftJourneyState {
  userId: string;
  journeyToken: string;
  draftId: string | null;
  autosaveStopped: boolean;
}

type ProtectedView = 'dashboard' | 'journey' | 'saved' | 'dreamkeys';
type SavedIntent = 'view' | 'download' | 'email';

type DreamSheetShellHistory =
  | { view: 'dashboard' }
  | { view: 'journey'; fromDashboard?: boolean }
  | { view: 'dreamkeys'; fromDashboard?: boolean }
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
  if (value.view === 'dreamkeys') {
    return { view: 'dreamkeys', fromDashboard: value.fromDashboard === true };
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
  const checkoutReturn = new URLSearchParams(window.location.search).get('dreamkey_checkout');
  if (checkoutReturn === 'success' || checkoutReturn === 'cancelled') return 'dreamkeys';
  const shell = getShellHistoryState();
  if (shell?.view === 'dashboard' || shell?.view === 'journey' || shell?.view === 'dreamkeys') return shell.view;
  if (shell?.view === 'saved') return 'dashboard';
  return sessionStorage.getItem(ACTIVE_CREATION_KEY) === 'true' ? 'journey' : 'dashboard';
}

function clearDreamSheetWorkingState() {
  localStorage.removeItem(LOCAL_PLAN_KEY);
  sessionStorage.removeItem(SESSION_PLAN_KEY);
  sessionStorage.removeItem(ACTIVE_CREATION_KEY);
  try {
    sessionStorage.removeItem(CLOUD_DRAFT_JOURNEY_KEY);
  } catch (error) {
    console.warn('Could not clear the cloud draft journey identity.', error);
  }
}

function readCloudDraftJourney(userId: string): CloudDraftJourneyState | null {
  try {
    const saved = sessionStorage.getItem(CLOUD_DRAFT_JOURNEY_KEY);
    if (!saved) return null;
    const value = JSON.parse(saved) as Partial<CloudDraftJourneyState>;
    if (value.userId !== userId || typeof value.journeyToken !== 'string' || !value.journeyToken) return null;
    return {
      userId,
      journeyToken: value.journeyToken,
      draftId: typeof value.draftId === 'string' && value.draftId ? value.draftId : null,
      autosaveStopped: value.autosaveStopped === true,
    };
  } catch (error) {
    console.warn('Could not restore the cloud draft journey identity.', error);
    return null;
  }
}

function createCloudDraftJourneyToken(): string {
  const browserCrypto = globalThis.crypto;

  if (typeof browserCrypto?.randomUUID === 'function') {
    return browserCrypto.randomUUID();
  }

  if (typeof browserCrypto?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    browserCrypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  return `journey-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function createCloudDraftJourney(userId: string): CloudDraftJourneyState {
  return {
    userId,
    journeyToken: createCloudDraftJourneyToken(),
    draftId: null,
    autosaveStopped: false,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function getString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function getRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function getRecoveredDomains(plan: Record<string, unknown>, submission: SavedDreamSheet): Domain[] {
  const savedDomains = getRecordArray(plan.domains)
    .filter(domain => typeof domain.id === 'string' && typeof domain.name === 'string' && Array.isArray(domain.subAreas));

  if (savedDomains.length) return savedDomains as unknown as Domain[];

  return getRecordArray(submission.focus_areas)
    .filter(domain => typeof domain.domain_name === 'string' && Array.isArray(domain.focus_areas))
    .map((domain, index) => ({
      id: getString(domain.domain_id, `recovered-domain-${index}`),
      name: getString(domain.domain_name),
      subAreas: getRecordArray(domain.focus_areas) as unknown as Domain['subAreas'],
    }));
}

function isCoachingStep(value: unknown): value is CoachingStep {
  return Object.values(CoachingStep).includes(value as CoachingStep);
}

function getRecoverableStep(
  plan: Record<string, unknown>,
  domains: Domain[],
  clientName: string,
  coachName: string,
): CoachingStep {
  if (isCoachingStep(plan.step)) return plan.step;
  if (
    domains.length ||
    getStringArray(plan.selectedRoles).length ||
    getRecordArray(plan.quizResponses).some(response => getString(response.answer).trim()) ||
    getRecordArray(plan.discoveryResponses).some(response => getString(response.answer).trim())
  ) {
    return CoachingStep.DOMAIN;
  }
  return clientName.trim() || coachName.trim() ? CoachingStep.CLEAR_SPACE : CoachingStep.WELCOME;
}

function getBoundedIndex(value: unknown, maximum: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= maximum ? value : 0;
}

function restoreCloudDraftWorkingState(submission: SavedDreamSheet): void {
  const plan = asRecord(submission.plan_data);
  const domains = getRecoveredDomains(plan, submission);
  const clientName = getString(plan.clientName, submission.client_name ?? '');
  const coachName = getString(plan.coachName, submission.coach_name ?? '');
  const selectedRoles = getStringArray(plan.selectedRoles);
  const step = getRecoverableStep(plan, domains, clientName, coachName);
  const quizPhase = plan.quizPhase === 'input' || plan.quizPhase === 'analysis' || plan.quizPhase === 'rating'
    ? plan.quizPhase
    : 'intro';

  const localState = {
    domains,
    clientName,
    coachName,
    timeHorizon: getString(plan.timeHorizon, '12 months'),
    selectedRoles: selectedRoles.length ? selectedRoles : getStringArray(submission.domains),
    lastSelectedDomain: typeof plan.lastSelectedDomain === 'string' ? plan.lastSelectedDomain : null,
    discoveryResponses: getRecordArray(plan.discoveryResponses),
    activeDomainId: typeof plan.activeDomainId === 'string' ? plan.activeDomainId : null,
    customDiscoveryDomains: getStringArray(plan.customDiscoveryDomains),
    planNotes: getString(plan.planNotes),
    quizResponses: getRecordArray(plan.quizResponses),
    distractions: getStringArray(plan.distractions),
    planCreatedAt: getString(plan.planCreatedAt, submission.created_at ?? new Date().toISOString()),
    isCoachMode: plan.isCoachMode === true,
    suggestedDomains: getRecordArray(plan.suggestedDomains),
    completedDomainIds: getStringArray(plan.completedDomainIds),
    showNameCapture: typeof plan.showNameCapture === 'boolean' ? plan.showNameCapture : !(clientName || coachName),
  };

  const sessionState = {
    step,
    showQuiz: step === CoachingStep.DOMAIN && plan.showQuiz === true,
    quizPhase,
    currentQuizIndex: getBoundedIndex(plan.currentQuizIndex, 9),
    currentDiscoveryIndex: getBoundedIndex(plan.currentDiscoveryIndex, 5),
    showDomainVisionResults: step === CoachingStep.DOMAIN && plan.showDomainVisionResults === true,
    hasCurrentSessionIdentity: typeof plan.hasCurrentSessionIdentity === 'boolean'
      ? plan.hasCurrentSessionIdentity
      : Boolean(clientName || coachName),
  };

  try {
    localStorage.setItem(LOCAL_PLAN_KEY, JSON.stringify(localState));
    sessionStorage.setItem(SESSION_PLAN_KEY, JSON.stringify(sessionState));
    sessionStorage.setItem(ACTIVE_CREATION_KEY, 'true');
  } catch (error) {
    console.error('Could not restore cloud draft into browser storage.', error);
    throw new Error('This draft was loaded, but this browser could not restore it locally. Check browser storage access and try again.');
  }
}

export default function AuthenticatedDreamSheetApp() {
  const { loading, passwordRecovery, signOut, user } = useAuth();
  const authenticatedUserId = user?.id;
  const [view, setView] = useState<ProtectedView>(getInitialProtectedView);
  const [dashboardRefreshToken, setDashboardRefreshToken] = useState(0);
  const [savedDreamSheet, setSavedDreamSheet] = useState<SavedDreamSheet | null>(null);
  const [savedIntent, setSavedIntent] = useState<SavedIntent>('view');
  const [openingSaved, setOpeningSaved] = useState(false);
  const [openingDraft, setOpeningDraft] = useState(false);
  const [shellError, setShellError] = useState('');
  const [cloudDraftJourney, setCloudDraftJourney] = useState<CloudDraftJourneyState | null>(null);
  const savedLoadRequestRef = useRef(0);
  const returningToDashboardRef = useRef(false);
  const displayedAuthScreenRef = useRef(false);
  const cloudDraftJourneyRef = useRef<CloudDraftJourneyState | null>(null);

  const storeCloudDraftJourney = useCallback((journey: CloudDraftJourneyState | null) => {
    cloudDraftJourneyRef.current = journey;
    setCloudDraftJourney(journey);
    try {
      if (journey) {
        sessionStorage.setItem(CLOUD_DRAFT_JOURNEY_KEY, JSON.stringify(journey));
      } else {
        sessionStorage.removeItem(CLOUD_DRAFT_JOURNEY_KEY);
      }
    } catch (error) {
      console.warn('Could not persist the cloud draft journey identity.', error);
    }
  }, []);

  const activateCloudDraftJourney = useCallback((forceNew = false) => {
    if (!authenticatedUserId) return null;
    const journey = forceNew
      ? createCloudDraftJourney(authenticatedUserId)
      : readCloudDraftJourney(authenticatedUserId) ?? createCloudDraftJourney(authenticatedUserId);
    storeCloudDraftJourney(journey);
    return journey;
  }, [authenticatedUserId, storeCloudDraftJourney]);

  const handleCloudDraftCreated = useCallback((journeyToken: string, draftId: string) => {
    const current = cloudDraftJourneyRef.current;
    if (!current || current.journeyToken !== journeyToken || current.autosaveStopped) return;
    storeCloudDraftJourney({ ...current, draftId });
  }, [storeCloudDraftJourney]);

  const handleCloudDraftCompleted = useCallback((journeyToken: string) => {
    const current = cloudDraftJourneyRef.current;
    if (!current || current.journeyToken !== journeyToken) return;
    storeCloudDraftJourney({ ...current, draftId: null, autosaveStopped: true });
  }, [storeCloudDraftJourney]);

  const resetCloudDraftJourney = useCallback(() => {
    if (!authenticatedUserId) return;
    storeCloudDraftJourney(createCloudDraftJourney(authenticatedUserId));
  }, [authenticatedUserId, storeCloudDraftJourney]);

  const showDashboard = useCallback((replaceHistory = false) => {
    savedLoadRequestRef.current += 1;
    setOpeningSaved(false);
    setOpeningDraft(false);
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

  const continueCloudDraft = useCallback(async (id: string) => {
    if (!authenticatedUserId) return;
    const requestId = ++savedLoadRequestRef.current;
    setOpeningDraft(true);
    setShellError('');

    try {
      const submission = await getMyDreamSheetDraftById(id);
      if (requestId !== savedLoadRequestRef.current) return;

      restoreCloudDraftWorkingState(submission);
      storeCloudDraftJourney({
        ...createCloudDraftJourney(authenticatedUserId),
        draftId: submission.id,
      });
      setSavedDreamSheet(null);
      pushShellHistoryState({ view: 'journey', fromDashboard: true });
      setView('journey');
    } catch (error) {
      if (requestId !== savedLoadRequestRef.current) return;
      setShellError(error instanceof Error
        ? error.message
        : 'This draft is no longer available. Refresh the dashboard and try again.');
      setView('dashboard');
    } finally {
      if (requestId === savedLoadRequestRef.current) setOpeningDraft(false);
    }
  }, [authenticatedUserId, storeCloudDraftJourney]);

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

    const restoredCloudDraftJourney = readCloudDraftJourney(user.id);
    if (initialView === 'journey') {
      storeCloudDraftJourney(restoredCloudDraftJourney ?? createCloudDraftJourney(user.id));
    } else {
      cloudDraftJourneyRef.current = restoredCloudDraftJourney;
      setCloudDraftJourney(restoredCloudDraftJourney);
    }

    const existingShell = getShellHistoryState();
    if (initialView === 'journey') {
      replaceShellHistoryState(existingShell?.view === 'journey'
        ? existingShell
        : { view: 'journey' });
    } else if (initialView === 'dreamkeys') {
      replaceShellHistoryState(existingShell?.view === 'dreamkeys'
        ? existingShell
        : { view: 'dreamkeys' });
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
        activateCloudDraftJourney();
        setOpeningSaved(false);
        setOpeningDraft(false);
        setSavedDreamSheet(null);
        setShellError('');
        setView('journey');
        return;
      }

      if (shell.view === 'dreamkeys') {
        savedLoadRequestRef.current += 1;
        setOpeningSaved(false);
        setOpeningDraft(false);
        setSavedDreamSheet(null);
        setShellError('');
        setView('dreamkeys');
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
  }, [activateCloudDraftJourney, loadSavedDreamSheet, passwordRecovery, showDashboard, storeCloudDraftJourney, user?.id]);

  const startNewDreamSheet = () => {
    savedLoadRequestRef.current += 1;
    clearDreamSheetWorkingState();
    activateCloudDraftJourney(true);
    sessionStorage.setItem(ACTIVE_CREATION_KEY, 'true');
    setSavedDreamSheet(null);
    setOpeningDraft(false);
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
    cloudDraftJourneyRef.current = null;
    setCloudDraftJourney(null);
    setOpeningSaved(false);
    setOpeningDraft(false);
    setSavedDreamSheet(null);
    setView('dashboard');
    replaceShellHistoryState({ view: 'dashboard' });
    await signOut();
  };

  const openSavedDreamSheet = (id: string, intent: SavedIntent = 'view') => {
    void loadSavedDreamSheet(id, intent, 'push');
  };

  const openCloudDraft = (id: string) => {
    void continueCloudDraft(id);
  };

  const openDreamKeys = () => {
    savedLoadRequestRef.current += 1;
    setOpeningSaved(false);
    setOpeningDraft(false);
    setSavedDreamSheet(null);
    setShellError('');
    pushShellHistoryState({ view: 'dreamkeys', fromDashboard: true });
    setView('dreamkeys');
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-stone-950 text-sm font-bold uppercase tracking-widest text-emerald-400">Loading DREAMSheet AI…</div>;
  }
  if (!user || passwordRecovery) return <AuthScreen />;

  if (view === 'saved' && savedDreamSheet) {
    return <SavedDreamSheetView submission={savedDreamSheet} onBack={returnToDashboard} initialIntent={savedIntent} />;
  }

  if (view === 'dreamkeys') {
    return <DreamKeyPlansPage onBack={returnToDashboard} />;
  }

  if (view === 'journey') {
    return (
      <>
        <App
          onSubmissionSaved={() => setDashboardRefreshToken(value => value + 1)}
          cloudDraftJourneyToken={cloudDraftJourney?.journeyToken}
          activeCloudDraftId={cloudDraftJourney?.draftId}
          cloudAutosaveStopped={cloudDraftJourney?.autosaveStopped}
          onCloudDraftCreated={handleCloudDraftCreated}
          onCloudDraftCompleted={handleCloudDraftCompleted}
          onCloudDraftReset={resetCloudDraftJourney}
        />
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
      {openingDraft && <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 text-sm font-bold text-white backdrop-blur-sm">Restoring your draft…</div>}
      <DreamSheetDashboard
        userEmail={user.email || 'Signed-in user'}
        refreshToken={dashboardRefreshToken}
        onCreate={startNewDreamSheet}
        onOpenDreamKeys={openDreamKeys}
        onContinueDraft={openCloudDraft}
        onOpen={openSavedDreamSheet}
        onLogout={handleLogout}
        externalError={shellError}
      />
    </>
  );
}
