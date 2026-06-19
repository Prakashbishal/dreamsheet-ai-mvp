import React, { useState, useEffect, useRef } from 'react';
import { saveDreamSheetSubmission } from "./services/submissionService";
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronRight, 
  ChevronLeft, 
  Plus, 
  Trash2, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight,
  Target,
  Trophy,
  Compass,
  ShieldAlert,
  Calendar,
  Activity,
  LineChart,
  Download,
  LayoutDashboard,
  ListTodo,
  User,
  Briefcase,
  Wind,
  X,
  RotateCcw,
  MessageSquare,
  Check,
  Mail,
  Users,
  Clock,
  ExternalLink,
  Bug,
  ChevronUp,
  ChevronDown,
  Bot,
  Zap,
  Printer
} from 'lucide-react';
import { CoachingStep, Domain, SubArea, CoachingPlan, ActionStep } from './types';
import { coachingService, hasGeminiApiKey } from './services/coachingService';
import { cn } from './lib/utils';
import { WaterfallRoadmap } from './components/WaterfallRoadmap';

const POSSIBLE_DOMAINS = [
  { name: "CAREER & BUSINESS", description: "Professional growth, vocational goals and fulfilling work" },
  { name: "WEALTH & FINANCE", description: "Financial security, savings, assets and abundance" },
  { name: "HEALTH & FITNESS", description: "Physical strength, energy, vitality and nutrition" },
  { name: "MINDSET & EMOTIONS", description: "Mental toughness, emotional resilience and inner peace" },
  { name: "PERSONAL DEVELOPMENT", description: "Continuous learning, wisdom and building good habits" },
  { name: "ROMANCE & PARTNER", description: "Intimacy, connection and primary partnership alignment" },
  { name: "FAMILY & FRIENDS", description: "Quality connections, support network and shared memories" },
  { name: "ENVIRONMENT & SPACE", description: "Clutter-free, energizing home and work surroundings" },
  { name: "LEISURE & RECREATION", description: "Hobbies, fun, play and scheduling quality downtime" },
  { name: "CONTRIBUTION & IMPACT", description: "Volunteering, tutoring, donating and helping community" },
  { name: "LEGACY & FUTURE VISION", description: "Creating lasting value, values alignment and long-term meaning" },
  { name: "SPIRITUALITY & SOUL", description: "Faith, connection to something greater, alignment and purpose" },
  { name: "TIME & PRODUCTIVITY", description: "Focus, prioritization, routine and efficient living" },
  { name: "CREATIVITY & EXPRESSION", description: "Artistic pursuits, flow states, design and self-expression" },
  { name: "ADVENTURE & TRAVEL", description: "Exploration, novel experiences, wanderlust and boundary pushing" },
  { name: "ENERGY & NUTRITION", description: "Eating pattern, sleep hygiene, recovery and body care" },
  { name: "LEADERSHIP", description: "Vision, guidance, inspiring others, and motivating communities" },
  { name: "TEAM", description: "High-performing collaboration, alignment, trust, and shared synergy" },
  { name: "PURPOSE", description: "Meaning, personal mission alignment, and living out core values" }
];

const TRADITIONAL_DOMAINS = [
  { name: "Health & Vitality", description: "Body, fitness, nutrition, energy levels, and overall physical wellness." },
  { name: "Career & Mission", description: "Professional growth, impact, fulfilling work, and vocational goals." },
  { name: "Finances & Wealth", description: "Financial security, savings, investments, and abundance mindset." },
  { name: "Mindset & Learning", description: "Emotional intelligence, mental strength, continuous learning, and wisdom." },
  { name: "Family & Friends", description: "Quality connections, support groups, and meaningful shared experiences." },
  { name: "Romance & Partner", description: "Intimacy, deep connection, and the quality of your primary partnership." },
  { name: "Fun & Recreation", description: "Hobbies, travel, play, and scheduled time for non-productive enjoyment." },
  { name: "Physical Environment", description: "Your home, office, cleanliness, and the energy of spaces you inhabit." }
];

const TIME_HORIZONS = [
  "1 month", "3 months", "6 months", "12 months", "24 months", "5 years", "Legacy", "Ongoing"
];

const FALLBACK_DOMAIN_SUGGESTIONS = [
  { name: "Career", description: "Professional direction, meaningful work, and daily progress." },
  { name: "Health", description: "Energy, wellbeing, fitness, and physical resilience." },
  { name: "Relationships", description: "Connection, support, family, friendship, and belonging." },
  { name: "Personal Growth", description: "Learning, confidence, mindset, and self-development." },
  { name: "Finances", description: "Money clarity, stability, planning, and financial peace." }
];

const FALLBACK_FOCUS_AREAS = ["Clarity", "Consistency", "Confidence", "Progress"];
const AI_UNAVAILABLE_MESSAGE = "AI suggestions could not be generated. You can continue with the fallback focus areas or add your own.";

const DISCOVERY_QUIZ_QUESTIONS = [
  { id: "q1", question: "What parts of your life currently take most of your time, energy, or attention?", type: "text" as const },
  { id: "q2", question: "Where in your life do you currently feel most fulfilled or 'alive'?", type: "text" as const },
  { id: "q3", question: "Where do you feel the greatest frustration, stress, or dissatisfaction?", type: "text" as const },
  { id: "q4", question: "What relationships or people have the biggest impact on your wellbeing right now?", type: "text" as const },
  { id: "q5", question: "What responsibilities or commitments feel most important to maintain or improve?", type: "text" as const },
  { id: "q6", question: "What areas of your life do you feel you may be neglecting? (Human beings are exceptionally good at neglecting the important while perfecting the urgent.)", type: "text" as const },
  { id: "q7", question: "If your life improved dramatically over the next 12 months, what would probably have changed?", type: "text" as const },
  { id: "q8", question: "What do you spend the most mental or emotional energy thinking about?", type: "text" as const },
  { id: "q9", question: "What gives you a sense of meaning, purpose, growth, or contribution?", type: "text" as const },
  { id: "q10", question: "If you had to divide your life into 4–5 major areas that truly matter to you, what would they be?", type: "text" as const }
];

interface QuizState {
  id: string;
  question: string;
  answer: string;
  type: "text";
  index: number;
}

interface QuizOverlayProps {
  showQuiz: boolean;
  setShowQuiz: (show: boolean) => void;
  quizResponses: QuizState[];
  setQuizResponses: (responses: QuizState[]) => void;
  currentQuizIndex: number;
  setCurrentQuizIndex: (index: number) => void;
  quizPhase: 'intro' | 'input' | 'analysis' | 'rating';
  setQuizPhase: (phase: 'intro' | 'input' | 'analysis' | 'rating') => void;
  selectedRoles: string[];
  setSelectedRoles: (roles: string[]) => void;
  domains: Domain[];
  setDomains: (domains: Domain[]) => void;
  setActiveDomainId: (id: string | null) => void;
  setStep: (step: CoachingStep) => void;
  skipToStep: (step: CoachingStep) => void;
  setAvailableDiscoveryDomains: (domains: string[]) => void;
  setCustomDiscoveryDomains: (domains: string[] | ((prev: string[]) => string[])) => void;
  suggestedDomains: { name: string, description: string }[];
  setSuggestedDomains: (domains: { name: string, description: string }[]) => void;
  isAnalyzingQuiz: boolean;
  setIsAnalyzingQuiz: (loading: boolean) => void;
  setLastSelectedDomain?: (domain: string | null) => void;
}

const ThinkingRobot = ({ message = "Consulting your AI Coach..." }: { message?: string }) => (
  <div className="flex flex-col items-center justify-center text-center">
    <div className="relative">
      <motion.div 
        animate={{ 
          y: [0, -10, 0],
          rotate: [0, 5, -5, 0]
        }}
        transition={{ 
          duration: 4, 
          repeat: Infinity, 
          ease: "easeInOut" 
        }}
        className="w-32 h-32 bg-emerald-50 rounded-[40px] flex items-center justify-center text-emerald-600 border-2 border-emerald-100 shadow-xl relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-400 to-transparent animate-pulse"></div>
        <Bot size={64} className="relative z-10" />
        
        {/* Thinking circles */}
        <motion.div 
           animate={{ scale: [1, 1.2, 1], opacity: [0.3, 1, 0.3] }}
           transition={{ duration: 2, repeat: Infinity, delay: 0 }}
           className="absolute top-6 left-6 w-2 h-2 rounded-full bg-emerald-400" 
        />
        <motion.div 
           animate={{ scale: [1, 1.2, 1], opacity: [0.3, 1, 0.3] }}
           transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
           className="absolute top-4 right-8 w-1.5 h-1.5 rounded-full bg-emerald-400" 
        />
      </motion.div>
      
      <div className="absolute -bottom-4 -right-4 flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{ y: [0, -5, 0], opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
            className="w-2 h-2 bg-emerald-600 rounded-full shadow-lg"
          />
        ))}
      </div>
    </div>
    <h3 className="text-2xl sm:text-3xl font-serif italic text-stone-900 mt-8 mb-2">{message}</h3>
    <p className="text-stone-500 max-w-xs">Identifying specific growth opportunities and strategic action steps for your journey.</p>
  </div>
);

const ActiveDomainHeader = ({ domainName, focusAreas }: { domainName: string, focusAreas: string[] }) => (
  <div className="bg-[#389167] text-white rounded-[1.5rem] md:rounded-[2.5rem] p-5 md:p-8 mb-6 md:mb-8 flex flex-col md:flex-row shadow-lg border border-white/10 shrink-0">
    <div className="flex-1 space-y-1 md:space-y-2">
      <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">DOMAIN</span>
      <h2 className="text-2xl md:text-3xl lg:text-4xl font-black tracking-tight leading-tight">{domainName}</h2>
    </div>
    <div className="flex-1 md:border-l border-white/20 md:pl-12 mt-4 md:mt-0 space-y-1 md:space-y-2">
      <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">FOCUS AREAS</span>
      <div className="grid grid-cols-1 gap-1">
        {focusAreas.length > 0 ? (
          focusAreas.map((fa, i) => (
            <span key={i} className="text-lg md:text-xl lg:text-2xl font-light block leading-tight">{fa}</span>
          ))
        ) : (
          <span className="text-sm md:text-base font-light italic opacity-80">No focus areas were generated. Please try again or add one manually.</span>
        )}
      </div>
    </div>
  </div>
);

try {
  const resetDone = localStorage.getItem('onetime_reset_completed_v3');
  if (!resetDone) {
    localStorage.removeItem('coaching_plan_state');
    localStorage.setItem('onetime_reset_completed_v3', 'true');
  }
} catch (e) {
  console.error("Error running one-time reset logic", e);
}

try {
  const isNewSession = !sessionStorage.getItem('coaching_session_initialized');
  if (isNewSession) {
    localStorage.removeItem('coaching_plan_state');
    sessionStorage.setItem('coaching_session_initialized', 'true');
  }
} catch (e) {
  console.error("Error managing session storage", e);
}

export default function App() {
  // Helper for lazy initial state from local storage
  const getInitialState = (key: string, defaultValue: any) => {
    try {
      const saved = localStorage.getItem('coaching_plan_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed[key] !== undefined) return parsed[key];
      }
    } catch (e) {
      console.error(`Error loading state for ${key}`, e);
    }
    return defaultValue;
  };

  const [step, setStep] = useState<CoachingStep>(() => getInitialState('step', CoachingStep.WELCOME));
  const [domains, setDomains] = useState<Domain[]>(() => getInitialState('domains', []));
  const [loading, setLoading] = useState(false);
  const [clientName, setClientName] = useState(() => getInitialState('clientName', ''));
  const [coachName, setCoachName] = useState(() => getInitialState('coachName', ''));
  const [planNotes, setPlanNotes] = useState(() => getInitialState('planNotes', ""));
  
  const [showNameCapture, setShowNameCapture] = useState(() => {
    const saved = getInitialState('showNameCapture', null);
    if (saved !== null) return saved;
    const initialClient = getInitialState('clientName', '');
    const initialCoach = getInitialState('coachName', '');
    if (initialClient || initialCoach) return false;
    return true;
  });
  const [tempClientName, setTempClientName] = useState('');
  const [tempCoachName, setTempCoachName] = useState('');

  useEffect(() => {
    if (showNameCapture) {
      setTempClientName(clientName);
      setTempCoachName(coachName);
    }
  }, [showNameCapture, clientName, coachName]);
  
  // Quiz State
  const [showQuiz, setShowQuiz] = useState(() => getInitialState('showQuiz', false));
  const [currentQuizIndex, setCurrentQuizIndex] = useState(() => {
    const saved = getInitialState('currentQuizIndex', 0);
    return saved < DISCOVERY_QUIZ_QUESTIONS.length ? saved : 0;
  });
  
  const getInitialQuizResponses = () => {
    const saved = getInitialState('quizResponses', []);
    // Migration/Reset logic: if length doesn't match or the type of the first question is different, reset
    if (saved.length !== DISCOVERY_QUIZ_QUESTIONS.length || (saved.length > 0 && saved[0].question !== DISCOVERY_QUIZ_QUESTIONS[0].question)) {
      return DISCOVERY_QUIZ_QUESTIONS.map((q, i) => ({
        id: q.id,
        question: q.question,
        type: q.type,
        answer: '',
        index: i
      }));
    }
    return saved.length > 0 ? saved : DISCOVERY_QUIZ_QUESTIONS.map((q, i) => ({
      id: q.id,
      question: q.question,
      type: q.type,
      answer: '',
      index: i
    }));
  };

  const [quizResponses, setQuizResponses] = useState<QuizState[]>(getInitialQuizResponses);
  const [quizPhase, setQuizPhase] = useState<'intro' | 'input' | 'analysis' | 'rating'>(() => getInitialState('quizPhase', 'intro'));
  
  // Plan Context
  const [timeHorizon, setTimeHorizon] = useState(() => getInitialState('timeHorizon', '12 months'));
  const [selectedRoles, setSelectedRoles] = useState<string[]>(() => getInitialState('selectedRoles', []));
  const [lastSelectedDomain, setLastSelectedDomain] = useState<string | null>(() => getInitialState('lastSelectedDomain', null));
  const [showDomainVisionResults, setShowDomainVisionResults] = useState(() => getInitialState('showDomainVisionResults', false));
  const [isGeneratingDomainVision, setIsGeneratingDomainVision] = useState(false);

  // Discovery State
  const [discoveryResponses, setDiscoveryResponses] = useState<{ question: string, answer: string }[]>(() => {
    const defaultVal = [
      { question: "What is your desired end-state? (Where are you trying to get to?/what does ‘finished’ look like?/what’s your final destination)", answer: "" },
      { question: "What is your current reality? (Describe your current situation/what’s happening currently/where are you now in respect of your chosen Domain?)", answer: "" },
      { question: "Describe some of the challenges you’re currently facing?", answer: "" },
      { question: "What is your horizon for this Domain? (Choose the time frame that best suits when you’d like to have reached your end-state.)", answer: "12 months" },
      { question: "In addition to the answers you gave to Q3, what are some of the potential obstacles that might get in the way of you reaching your end-state? (things that might trip you up?)", answer: "" },
      { question: "Is there any other information you’d like to share that will help the AI to optimise your Focus Areas?", answer: "" }
    ];
    let saved = getInitialState('discoveryResponses', defaultVal);
    if (!Array.isArray(saved) || saved.length !== 6) {
      saved = defaultVal;
    }
    return saved.map((item: any) => {
      if (item && item.question && item.question.includes("What is your current reality)")) {
        return {
          ...item,
          question: item.question.replace("What is your current reality)", "What is your current reality?")
        };
      }
      return item;
    });
  });
  const [currentDiscoveryIndex, setCurrentDiscoveryIndex] = useState(() => getInitialState('currentDiscoveryIndex', 0));

  // Intro / Mindfulness State
  const [distractions, setDistractions] = useState<string[]>(() => getInitialState('distractions', []));
  const [currentDistraction, setCurrentDistraction] = useState('');
  const [isBreathing, setIsBreathing] = useState(false);
  const [activeDomainId, setActiveDomainId] = useState<string | null>(() => getInitialState('activeDomainId', null));
  const [planCreatedAt, setPlanCreatedAt] = useState(() => getInitialState('planCreatedAt', new Date().toISOString()));
  const [isCoachMode, setIsCoachMode] = useState(() => getInitialState('isCoachMode', false));
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showStepList, setShowStepList] = useState(() => getInitialState('showStepList', false));
  const [showDomainInstructions, setShowDomainInstructions] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const appShellRef = useRef<HTMLDivElement>(null);
  const domainInstructionsRef = useRef<HTMLDivElement>(null);
  const domainQuestionsRef = useRef<HTMLElement>(null);

  const scrollViewportToTop = (behavior: ScrollBehavior = 'smooth') => {
    window.scrollTo({ top: 0, behavior });
    appShellRef.current?.scrollTo({ top: 0, behavior });
  };

  const scrollToDomainQuestions = () => {
    domainQuestionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToDomainQuestionsSoon = () => {
    window.setTimeout(scrollToDomainQuestions, 250);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (domainInstructionsRef.current && !domainInstructionsRef.current.contains(event.target as Node)) {
        setShowDomainInstructions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const [isDevMode, setIsDevMode] = useState(false);
  const [completedDomainIds, setCompletedDomainIds] = useState<string[]>(() => getInitialState('completedDomainIds', []));
  const [availableDiscoveryDomains, setAvailableDiscoveryDomains] = useState(POSSIBLE_DOMAINS);
  const [isArchitecting, setIsArchitecting] = useState(false);
  const [isGeneratingGoal, setIsGeneratingGoal] = useState(false);
  const [isGeneratingVision, setIsGeneratingVision] = useState(false);
  const [isGeneratingWhy, setIsGeneratingWhy] = useState(false);
  const [isGeneratingAffirmations, setIsGeneratingAffirmations] = useState(false);
  const [isGeneratingGoalAffirmations, setIsGeneratingGoalAffirmations] = useState(false);
  const [isGeneratingSupportingGoals, setIsGeneratingSupportingGoals] = useState(false);
  const [isGeneratingActionSteps, setIsGeneratingActionSteps] = useState(false);
  const [isPreparingTacticalRoadmap, setIsPreparingTacticalRoadmap] = useState(false);
  const [expandedSubAreas, setExpandedSubAreas] = useState<Record<string, boolean>>({});
  const [isGeneratingObstacles, setIsGeneratingObstacles] = useState(false);
  const [isGeneratingObstacleSolution, setIsGeneratingObstacleSolution] = useState(false);
  const [isGeneratingDiscoveryObstacles, setIsGeneratingDiscoveryObstacles] = useState(false);
  const [isGeneratingAlternatives, setIsGeneratingAlternatives] = useState(false);
  const [suggestedDomains, setSuggestedDomains] = useState<{ name: string, description: string }[]>(() => getInitialState('suggestedDomains', []));
  const [isAnalyzingQuiz, setIsAnalyzingQuiz] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);

  const createFallbackSubAreas = (selected = true): SubArea[] => FALLBACK_FOCUS_AREAS.map(name => ({
    id: Math.random().toString(36).substr(2, 9),
    name,
    selected
  }));

  const showAiFallback = (message = AI_UNAVAILABLE_MESSAGE) => {
    setAiFeedback(message);
  };

  const generateDiscoveryObstacles = async () => {
    const domainName = selectedRoles[0] || "this domain";
    const context = discoveryResponses.slice(0, 3).map(r => `${r.question}: ${r.answer}`).join('\n');
    
    setIsGeneratingDiscoveryObstacles(true);
    try {
      const suggested = await coachingService.suggestObstacles(domainName + "\nContext:\n" + context);
      if (!suggested.length) {
        showAiFallback("AI suggestions could not be generated. You can list obstacles manually and continue.");
        return;
      }
      const obstacleStr = suggested.map(o => `• ${o}`).join('\n');
      
      const newResponses = [...discoveryResponses];
      const currentVal = newResponses[4].answer;
      newResponses[4].answer = currentVal ? `${currentVal}\n\nSuggested obstacles:\n${obstacleStr}` : obstacleStr;
      setDiscoveryResponses(newResponses);
    } catch (error) {
      console.error("Error generating discovery obstacles:", error);
      showAiFallback("AI suggestions could not be generated. You can list obstacles manually and continue.");
    } finally {
      setIsGeneratingDiscoveryObstacles(false);
    }
  };

  const [customDiscoveryDomains, setCustomDiscoveryDomains] = useState<string[]>(() => getInitialState('customDiscoveryDomains', []));
  const [showCustomDomainInput, setShowCustomDomainInput] = useState(false);
  const [newCustomDomain, setNewCustomDomain] = useState('');
  const [newFocusAreaName, setNewFocusAreaName] = useState('');
  const [activeExplanation, setActiveExplanation] = useState<string | null>(null);
  const planRef = useRef<HTMLDivElement>(null);

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [isSavingSubmission, setIsSavingSubmission] = useState(false);
  const [submissionSaveMessage, setSubmissionSaveMessage] = useState('');

  const currentSessionDomains = domains.filter(d => (d.id === activeDomainId || completedDomainIds.includes(d.id)) && d.subAreas.length > 0);

  const isPlaceholderEndGoal = (goal?: string) => {
    const normalized = (goal || "").trim().toLowerCase().replace(/[?.\s]+$/g, "");
    return normalized === "define a clear end-goal for this focus area" ||
      normalized === "what specific outcome do you want to achieve for this focus area";
  };

  const buildContextualActionStepFallback = (sub: SubArea, domain?: Domain): ActionStep => {
    const target = sub.goal?.trim() || sub.name?.trim() || "this focus area";
    const domainStart = domain?.subAreas.map(s => s.startDate).filter(Boolean).sort()[0] || "";
    const domainFinishDates = domain?.subAreas.map(s => s.finishDate).filter(Boolean).sort() || [];
    const domainFinish = domainFinishDates[domainFinishDates.length - 1] || "";

    return {
      task: `Define the first practical action for: ${target}`,
      startDate: sub.startDate || domainStart,
      endDate: sub.isOngoing ? "" : (sub.finishDate || domainFinish),
      isOngoing: sub.isOngoing,
      measure: "Progress is measured by completing the first defined action for this focus area.",
      obstacle: "The next obstacle for this focus area still needs to be identified.",
      overcome: "Review the obstacle and choose one practical adjustment.",
      contingency: "If progress stalls, reduce the scope and complete a smaller version of the action.",
      progress: 0
    };
  };

  const normalizeStepText = (value?: string) => (value || "").trim().toLowerCase().replace(/[.\s]+$/g, "");

  const isPlaceholderActionStep = (step: ActionStep) => {
    const task = normalizeStepText(step.task);
    const measure = normalizeStepText(step.measure);
    const obstacle = normalizeStepText(step.obstacle);
    const overcome = normalizeStepText(step.overcome);
    const hasTbdDates = normalizeStepText(step.startDate || step.dueDate) === "tbd" && normalizeStepText(step.endDate || step.dueDate) === "tbd";
    const hasEmptyDates = !step.startDate?.trim() && !step.endDate?.trim() && !step.dueDate?.trim();
    const hasGenericDetails =
      measure === "measure of success to be defined" &&
      obstacle === "obstacle to be defined" &&
      overcome === "solution to be defined";

    return task === "manual action step" || hasGenericDetails || ((hasTbdDates || hasEmptyDates) && hasGenericDetails);
  };

  const hasUsableActionSteps = (sub: SubArea) => Boolean(sub.actionSteps?.some(step => !isPlaceholderActionStep(step)));

  const getPlanActionSteps = (sub: SubArea, domain?: Domain) => (
    hasUsableActionSteps(sub)
      ? sub.actionSteps!.filter(step => !isPlaceholderActionStep(step))
      : [buildContextualActionStepFallback(sub, domain)]
  );

  const getContingencyPlan = (step: ActionStep) => {
    if (step.contingency?.trim()) {
      return step.contingency;
    }
    if (isPlaceholderActionStep(step)) {
      return "If the obstacle has not yet been identified, review this focus area with the coach and define one likely blocker before execution.";
    }
    if (step.obstacle === "The next obstacle for this focus area still needs to be identified.") {
      return "If the obstacle has not yet been identified, review this focus area with the coach and define one likely blocker before execution.";
    }
    if (step.obstacle && step.overcome) {
      return `If ${step.obstacle}, then ${step.overcome}`;
    }
    if (step.obstacle) {
      return `If ${step.obstacle}, use the listed overcome strategy and adjust the timeline or task scope.`;
    }
    if (step.overcome) {
      return `If this obstacle appears, then ${step.overcome}`;
    }
    return "If this obstacle appears, use the listed overcome strategy and adjust the timeline or task scope.";
  };

  const handleSendEmail = () => {
    if (!emailAddress.trim()) return;
    const summary = currentSessionDomains.map(d => {
      return `Domain: ${d.name}\nEnd-goals:\n${d.subAreas.map(s => `- ${s.name}: ${s.affirmation}`).join('\n')}`;
    }).join('\n\n');
    const body = `Hi,\n\nHere is my DREAMSheet AI Masterplan:\n\n${summary}\n\nNotes: ${planNotes}\n\nGenerated on: ${new Date().toLocaleDateString()}`;
    window.location.href = `mailto:${emailAddress}?subject=My DREAMSheet AI Masterplan&body=${encodeURIComponent(body)}`;
    setShowEmailModal(false);
  };

  const handleExportPDF = () => {
    window.print();
  };

  const handleSaveDreamSheet = async () => {
    setIsSavingSubmission(true);
    setSubmissionSaveMessage('');

    const finalDomains = currentSessionDomains;
    const focusAreas = finalDomains.map(domain => ({
      domain_id: domain.id,
      domain_name: domain.name,
      focus_areas: domain.subAreas
    }));

    try {
      await saveDreamSheetSubmission({
        client_name: clientName,
        coach_name: coachName,
        domains: finalDomains.map(domain => domain.name),
        focus_areas: focusAreas,
        plan_data: {
          clientName,
          coachName,
          planNotes,
          planCreatedAt,
          timeHorizon,
          selectedRoles,
          lastSelectedDomain,
          discoveryResponses,
          quizResponses,
          quizPhase,
          completedDomainIds,
          activeDomainId,
          customDiscoveryDomains,
          suggestedDomains,
          domains,
          finalDomains
        }
      });
      setSubmissionSaveMessage('DREAMsheet saved successfully.');
    } catch (error) {
      console.error("Could not save DREAMsheet submission:", error);
      setSubmissionSaveMessage('Could not save DREAMsheet. Please use Print/PDF for now.');
    } finally {
      setIsSavingSubmission(false);
    }
  };

  const handleAddCustomDomain = () => {
    if (newCustomDomain.trim()) {
      const trimmed = newCustomDomain.trim();
      if (!POSSIBLE_DOMAINS.includes(trimmed) && !customDiscoveryDomains.includes(trimmed)) {
        setCustomDiscoveryDomains([...customDiscoveryDomains, trimmed]);
        setSelectedRoles([...selectedRoles, trimmed]);
        scrollToDomainQuestionsSoon();
      }
      setNewCustomDomain('');
      setShowCustomDomainInput(false);
    }
  };

  const deleteCompletedDomainByName = (domainName: string) => {
    // Find matching domain(s) in domains list
    const foundDomains = domains.filter(d => d.name.toUpperCase() === domainName.toUpperCase());
    const foundIds = foundDomains.map(d => d.id);

    // Filter out of domains list
    setDomains(domains.filter(d => d.name.toUpperCase() !== domainName.toUpperCase()));

    // Filter out of completedDomainIds
    setCompletedDomainIds(prev => prev.filter(id => !foundIds.includes(id)));

    // Clean up activeDomainId if it was the deleted one
    if (activeDomainId && foundIds.includes(activeDomainId)) {
      setActiveDomainId(null);
    }

    // Clean up selectedRoles if it was the selected one
    setSelectedRoles(prev => prev.filter(role => role.toUpperCase() !== domainName.toUpperCase()));

    // Clean up lastSelectedDomain if it matches the deleted/unlocked domain
    if (lastSelectedDomain && lastSelectedDomain.toUpperCase() === domainName.toUpperCase()) {
      setLastSelectedDomain(null);
    }
    
    // Also remove from customDiscoveryDomains if present
    setCustomDiscoveryDomains(prev => prev.filter(d => d.toUpperCase() !== domainName.toUpperCase()));
  };

  const skipToStep = (newStep: CoachingStep) => {
    // If skipping to a step that requires data, populate some defaults if empty
    if (newStep !== CoachingStep.CLEAR_SPACE && newStep !== CoachingStep.WELCOME) {
      if (!clientName) setClientName('');
      if (!coachName) setCoachName('');
    }

    // Reset view-specific states
    setShowDomainVisionResults(false);
    setShowQuiz(false);
    setShowStepList(false);
    setShowCustomDomainInput(false);
    setLoading(false);
    setIsBreathing(false);
    setDistractions([]);
    setCurrentDistraction('');
    
    // Reset AI loading states
    setIsArchitecting(false);
    setIsGeneratingGoal(false);
    setIsGeneratingVision(false);
    setIsGeneratingWhy(false);
    setIsGeneratingAffirmations(false);
    setIsGeneratingGoalAffirmations(false);
    setIsGeneratingSupportingGoals(false);
    setIsGeneratingActionSteps(false);
    setIsGeneratingObstacles(false);
    setIsGeneratingObstacleSolution(false);
    setIsGeneratingDiscoveryObstacles(false);
    setIsGeneratingDomainVision(false);
    setAiFeedback(null);

    setStep(newStep);
    
    // Tiny delay to ensure layout has settled before any automated scroll logic.
    setTimeout(() => {
      scrollViewportToTop('smooth');
    }, 100);
  };

  const isGlobalLoading = loading || 
    isGeneratingGoal || 
    isGeneratingVision || 
    isGeneratingAffirmations || 
    isGeneratingGoalAffirmations || 
    isGeneratingSupportingGoals || 
    isArchitecting || 
    isGeneratingObstacles || 
    isGeneratingObstacleSolution || 
    isGeneratingActionSteps || 
    isGeneratingDiscoveryObstacles || 
    isGeneratingDomainVision ||
    isGeneratingAlternatives ||
    isAnalyzingQuiz ||
    domains.some(d => d.isGenerating);

  // Persistence
  useEffect(() => {
    const state = {
      step,
      domains,
      clientName,
      coachName,
      timeHorizon,
      selectedRoles,
      lastSelectedDomain,
      discoveryResponses,
      activeDomainId,
      customDiscoveryDomains,
      planNotes,
      quizResponses,
      quizPhase,
      currentQuizIndex,
      currentDiscoveryIndex,
      distractions,
      planCreatedAt,
      isCoachMode,
      showQuiz,
      showStepList,
      showDomainVisionResults,
      suggestedDomains,
      completedDomainIds,
      showNameCapture
    };
    localStorage.setItem('coaching_plan_state', JSON.stringify(state));
  }, [step, domains, clientName, coachName, timeHorizon, selectedRoles, lastSelectedDomain, discoveryResponses, activeDomainId, customDiscoveryDomains, planNotes, quizResponses, quizPhase, currentQuizIndex, currentDiscoveryIndex, distractions, planCreatedAt, isCoachMode, showQuiz, showStepList, showDomainVisionResults, suggestedDomains, completedDomainIds, showNameCapture]);

  // Scroll to top on entering vision/sub-domain view
  useEffect(() => {
    if (showDomainVisionResults && step === CoachingStep.DOMAIN) {
      setTimeout(() => {
        const scrollables = document.querySelectorAll('.overflow-y-auto');
        scrollables.forEach(el => {
          el.scrollTo({ top: 0, behavior: 'auto' });
        });
      }, 50);
    }
  }, [showDomainVisionResults, step]);

  const resetPlan = () => {
    setDomains([]);
    setClientName('');
    setCoachName('');
    setSelectedRoles([]);
    setLastSelectedDomain(null);
    setCustomDiscoveryDomains([]);
    setCompletedDomainIds([]);
    setDiscoveryResponses([
      { question: "What is your desired end-state? (Where are you trying to get to?/what does ‘finished’ look like?/what’s your final destination)", answer: "" },
      { question: "What is your current reality? (Describe your current situation/what’s happening currently/where are you now in respect of your chosen Domain?)", answer: "" },
      { question: "Describe some of the challenges you’re currently facing?", answer: "" },
      { question: "What is your horizon for this Domain? (Choose the time frame that best suits when you’d like to have reached your end-state.)", answer: "12 months" },
      { question: "In addition to the answers you gave to Q3, what are some of the potential obstacles that might get in the way of you reaching your end-state? (things that might trip you up?)", answer: "" },
      { question: "Is there any other information you’d like to share that will help the AI to optimise your Focus Areas?", answer: "" }
    ]);
    setPlanNotes("");
    setDistractions([]);
    setQuizResponses(DISCOVERY_QUIZ_QUESTIONS.map((q, i) => ({
      id: q.id,
      question: q.question,
      type: q.type,
      answer: '',
      index: i
    })));
    setQuizPhase('intro');
    setCurrentQuizIndex(0);
    setCurrentDiscoveryIndex(0);
    setPlanCreatedAt(new Date().toISOString());
    setStep(CoachingStep.WELCOME);
    setShowResetConfirm(false);
    setShowNameCapture(true);
    localStorage.removeItem('coaching_plan_state');
  };

  // Domain Selection
  const toggleDomain = (name: string) => {
    const domainToRemove = domains.find(d => d.name === name);
    if (domainToRemove) {
      const remainingDomains = domains.filter(d => d.name !== name);
      setDomains(remainingDomains);
      
      // If we removed the active domain, pick a new one or reset
      if (activeDomainId === domainToRemove.id) {
        if (remainingDomains.length > 0) {
          setActiveDomainId(remainingDomains[0].id);
        } else {
          setActiveDomainId(null);
          setStep(CoachingStep.DOMAIN);
        }
      }
    } else {
      setDomains([...domains, { id: Math.random().toString(36).substr(2, 9), name, subAreas: [] }]);
    }
  };

  const deleteSubArea = (domainId: string, subAreaId: string) => {
    setDomains(domains.map(d => {
      if (d.id !== domainId) return d;
      return {
        ...d,
        subAreas: d.subAreas.filter(s => s.id !== subAreaId)
      };
    }));
  };

  const addCustomDomain = (name: string) => {
    if (name && !domains.find(d => d.name === name)) {
      setDomains([...domains, { id: Math.random().toString(36).substr(2, 9), name, subAreas: [] }]);
    }
  };

  const updateDomainVision = (id: string, vision: string) => {
    setDomains(prev => prev.map(d => d.id === id ? { ...d, domainVision: vision, vision } : d));
  };

  const updateDomainWhy = (id: string, why: string) => {
    setDomains(prev => prev.map(d => d.id === id ? { ...d, why } : d));
  };

  // Discovery Completion
  const initializeDomainContext = async (domainId: string, currentDomains: Domain[]) => {
    const domain = currentDomains.find(d => d.id === domainId);
    if (!domain) return;
    
    setDomains(prev => prev.map(d => d.id === domainId ? { ...d, isGenerating: true } : d));
    
    try {
      // Ensure we have discovery responses
      const { vision, why, subAreas } = await coachingService.suggestDomainContext(domain.name, discoveryResponses);
      
      setDomains(prev => prev.map(d => {
        if (d.id !== domainId) return d;
        return { 
          ...d, 
          vision: d.vision && d.vision.trim() !== "" ? d.vision : vision, 
          why: d.why && d.why.trim() !== "" ? d.why : why, 
          suggestions: d.suggestions && d.suggestions.length > 0 ? d.suggestions : subAreas,
          isGenerating: false
        };
      }));
    } catch (e) {
      console.error("Failed to initialize domain context for", domain.name, e);
      setDomains(prev => prev.map(d => d.id === domainId ? { ...d, isGenerating: false } : d));
    }
  };

  const generateDomainGoal = async (domainId: string) => {
    const domain = domains.find(d => d.id === domainId);
    if (!domain) return;
    
    setIsGeneratingGoal(true);
    const minWait = new Promise(resolve => setTimeout(resolve, 2000));
    try {
      const [suggestedGoal] = await Promise.all([
        coachingService.suggestDomainEndGoal(domain.name, discoveryResponses),
        minWait
      ]);
      setDomains(prev => prev.map(d => d.id === domainId ? { ...d, domainGoal: suggestedGoal } : d));
    } catch (error) {
      console.error("Error generating goal:", error);
      showAiFallback("AI suggestions could not be generated. You can write your end-goal manually and continue.");
    } finally {
      setIsGeneratingGoal(false);
    }
  };

  const generateDomainVision = async (domainId: string) => {
    const domain = domains.find(d => d.id === domainId);
    if (!domain || !domain.domainGoal) return;

    setIsGeneratingVision(true);
    try {
      const suggestedState = await coachingService.suggestDomainVision(domain.name, domain.domainGoal, timeHorizon);
      setDomains(prev => prev.map(d => d.id === domainId ? { ...d, domainVision: suggestedState } : d));
    } catch (error) {
      console.error("Error generating vision:", error);
      showAiFallback("AI suggestions could not be generated. You can write your vision manually and continue.");
    } finally {
      setIsGeneratingVision(false);
    }
  };

  const generateDomainWhy = async (domainId: string) => {
    const domain = domains.find(d => d.id === domainId);
    if (!domain) return;

    setIsGeneratingWhy(true);
    try {
      const suggestedWhy = await coachingService.suggestDomainWhy(domain.name, discoveryResponses);
      setDomains(prev => prev.map(d => d.id === domainId ? { ...d, why: suggestedWhy } : d));
    } catch (error) {
      console.error("Error generating domain why:", error);
      showAiFallback("AI suggestions could not be generated. You can write your why manually and continue.");
    } finally {
      setIsGeneratingWhy(false);
    }
  };

  const generateGoalAffirmations = async (domainId: string, subAreaId?: string) => {
    const domain = domains.find(d => d.id === domainId);
    if (!domain || domain.subAreas.length === 0) return;

    setIsGeneratingGoalAffirmations(true);
    setAiFeedback(null);
    try {
      if (subAreaId) {
        const sub = domain.subAreas.find(s => s.id === subAreaId);
        if (sub) {
          const affirmations = await coachingService.suggestGoalAffirmations([sub.goal || sub.name]);
          const nextAffirmation = affirmations[0]?.trim() || sub.affirmation || "";
          setDomains(prev => prev.map(d => {
            if (d.id !== domainId) return d;
            const updatedSubAreas = d.subAreas.map(s => {
              if (s.id !== subAreaId) return s;
              return { ...s, affirmation: nextAffirmation };
            });
            return { ...d, subAreas: updatedSubAreas };
          }));
          if (nextAffirmation.trim()) {
            setAiFeedback(null);
          } else {
            showAiFallback("AI suggestions could not be generated. You can write affirmations manually and continue.");
          }
        }
      } else {
        const affirmations = await coachingService.suggestGoalAffirmations(domain.subAreas.map(s => s.goal || s.name));
        const nextSubAreas = domain.subAreas.map((s, idx) => ({
          ...s,
          affirmation: affirmations[idx]?.trim() || s.affirmation || ""
        }));
        setDomains(prev => prev.map(d => {
          if (d.id !== domainId) return d;
          return { ...d, subAreas: nextSubAreas };
        }));
        if (nextSubAreas.some(s => s.affirmation?.trim())) {
          setAiFeedback(null);
        } else {
          showAiFallback("AI suggestions could not be generated. You can write affirmations manually and continue.");
        }
      }
    } catch (error) {
      console.error("Error generating goal affirmations:", error);
      const hasUsableAffirmations = subAreaId
        ? Boolean(domain.subAreas.find(s => s.id === subAreaId)?.affirmation?.trim())
        : domain.subAreas.some(s => s.affirmation?.trim());
      if (!hasUsableAffirmations) {
        showAiFallback("AI suggestions could not be generated. You can write affirmations manually and continue.");
      } else {
        setAiFeedback(null);
      }
    } finally {
      setIsGeneratingGoalAffirmations(false);
    }
  };

  // Automatically generate domain goal when reaching ratings page
  useEffect(() => {
    if (step === CoachingStep.RATINGS && activeDomainId) {
      const domain = domains.find(d => d.id === activeDomainId);
      if (domain && !domain.domainGoal && !isGeneratingGoal) {
        generateDomainGoal(activeDomainId);
      }
    }
  }, [step, activeDomainId]);

  // Automatically generate affirmations when reaching affirmations step
  useEffect(() => {
    if (step === CoachingStep.AFFIRMATIONS && activeDomainId) {
      const domain = domains.find(d => d.id === activeDomainId);
      if (domain && domain.subAreas.length > 0 && domain.subAreas.every(s => !s.affirmation) && !isGeneratingGoalAffirmations) {
        generateGoalAffirmations(activeDomainId);
      }
    }
  }, [step, activeDomainId]);

  const generateDomainAffirmations = async (domainId: string) => {
    const domain = domains.find(d => d.id === domainId);
    if (!domain || !domain.domainGoal || !domain.domainVision) return;

    setIsGeneratingAffirmations(true);
    try {
      const affirmations = await coachingService.suggestDomainAffirmations(domain.name, domain.domainGoal, domain.domainVision);
      setDomains(prev => prev.map(d => d.id === domainId ? { ...d, suggestedAffirmations: affirmations } : d));
    } catch (error) {
      console.error("Error generating affirmations:", error);
      showAiFallback("AI suggestions could not be generated. You can write affirmations manually and continue.");
    } finally {
      setIsGeneratingAffirmations(false);
    }
  };

  const generateEndGoalsForSubAreas = async (domainId: string, subAreaId?: string) => {
    const domain = domains.find(d => d.id === domainId);
    if (!domain) return;

    setIsGeneratingSupportingGoals(true);
    const visionContext = domain.domainVision || domain.vision || domain.domainGoal || domain.name;
    try {
      const updatedSubAreas = await Promise.all(domain.subAreas.map(async (sub) => {
        if (subAreaId && sub.id !== subAreaId) return sub;
        if (!subAreaId && sub.goal?.trim() && !isPlaceholderEndGoal(sub.goal)) return sub;
        
        const { goal, recommendedDurationDays } = await coachingService.suggestSubAreaEndGoal(sub.name, visionContext, timeHorizon);
        
        const start = new Date();
        start.setDate(start.getDate() + 1);
        const startStr = start.toISOString().split('T')[0];
        
        const finish = new Date(start);
        finish.setDate(finish.getDate() + (recommendedDurationDays || 30));
        const finishStr = finish.toISOString().split('T')[0];

        return {
          ...sub,
          goal: goal,
          startDate: startStr,
          finishDate: finishStr
        };
      }));

      setDomains(prev => prev.map(d => d.id === domainId ? { ...d, subAreas: updatedSubAreas } : d));
    } catch (error) {
      console.error("Error generating end goals:", error);
      showAiFallback("AI suggestions could not be generated. You can write end-goals manually and continue.");
      setDomains(prev => prev.map(d => {
        if (d.id !== domainId) return d;
        return {
          ...d,
          subAreas: d.subAreas.map(s => {
            const shouldFill = subAreaId ? s.id === subAreaId : !s.goal?.trim() || isPlaceholderEndGoal(s.goal);
            return shouldFill ? { ...s, goal: isPlaceholderEndGoal(s.goal) ? "" : (s.goal?.trim() || "") } : s;
          })
        };
      }));
    } finally {
      setIsGeneratingSupportingGoals(false);
    }
  };

  useEffect(() => {
    if (step !== CoachingStep.END_GOALS || !activeDomainId || isGeneratingSupportingGoals) return;
    const domain = domains.find(d => d.id === activeDomainId);
    if (!domain || domain.subAreas.length === 0) return;
    if (domain.subAreas.some(s => !s.goal?.trim() || isPlaceholderEndGoal(s.goal))) {
      generateEndGoalsForSubAreas(activeDomainId);
    }
  }, [step, activeDomainId]);

  const updateSubAreaDates = (domainId: string, subAreaId: string, field: 'startDate' | 'finishDate', value: string) => {
    setDomains(prev => prev.map(d => {
      if (d.id !== domainId) return d;
      return {
        ...d,
        subAreas: d.subAreas.map(s => {
          if (s.id !== subAreaId) return s;
          
          if (field === 'startDate') {
            const oldStart = s.startDate ? new Date(s.startDate) : new Date();
            const oldFinish = s.finishDate ? new Date(s.finishDate) : new Date();
            const duration = oldFinish.getTime() - oldStart.getTime();
            
            const newStart = new Date(value);
            const newFinish = new Date(newStart.getTime() + duration);
            
            return {
              ...s,
              startDate: value,
              finishDate: s.isOngoing ? "" : newFinish.toISOString().split('T')[0]
            };
          }
          
          return { ...s, [field]: value, ...(field === 'finishDate' ? { isOngoing: false } : {}) };
        })
      };
    }));
  };

  const generateActionStepsForSubArea = async (domainId: string, subAreaId: string) => {
    const domain = domains.find(d => d.id === domainId);
    if (!domain) return;
    const subArea = domain.subAreas.find(s => s.id === subAreaId);
    if (!subArea || !subArea.goal) return;

    setIsGeneratingActionSteps(true);
    try {
      const steps = await coachingService.suggestActionStepsForGoal(subArea.goal, domain.name);
      setDomains(prev => prev.map(d => {
        if (d.id !== domainId) return d;
        return {
          ...d,
          subAreas: d.subAreas.map(s => {
            if (s.id !== subAreaId) return s;
            return {
              ...s,
              actionSteps: steps.map((st: any) => ({
                task: st.task,
                measure: st.measure || "Clear completion measure defined.",
                obstacle: st.obstacle,
                overcome: st.overcome,
                startDate: st.startDate || "",
                endDate: st.endDate || "",
                isOngoing: false,
                progress: 0
              }))
            };
          })
        };
      }));
    } catch (error) {
      console.error("Error generating action steps:", error);
      showAiFallback("AI suggestions could not be generated. You can add action steps manually and continue.");
    } finally {
      setIsGeneratingActionSteps(false);
    }
  };

  const prepareMissingTacticalRoadmaps = async () => {
    if (isPreparingTacticalRoadmap) return;

    const missingTargets = domains.flatMap(domain =>
      domain.subAreas
        .filter(sub => sub.selected !== false && !hasUsableActionSteps(sub))
        .map(sub => ({ domain, sub }))
    );

    if (missingTargets.length === 0) return;

    setIsPreparingTacticalRoadmap(true);
    try {
      const generated = await Promise.all(missingTargets.map(async ({ domain, sub }) => {
        const target = sub.goal?.trim() || sub.name?.trim();
        if (!target) {
          return { domainId: domain.id, subId: sub.id, steps: [buildContextualActionStepFallback(sub, domain)] };
        }

        try {
          const knownObstacles = [
            ...(sub.obstacles?.map(item => item.obstacle).filter(Boolean) || []),
            ...(sub.actionSteps?.map(step => step.obstacle).filter(Boolean) || [])
          ];
          const steps = await coachingService.suggestActionStepsForGoal(target, domain.name, {
            focusAreaName: sub.name,
            startDate: sub.startDate,
            finishDate: sub.finishDate,
            obstacles: knownObstacles
          });

          const normalizedSteps = steps
            .filter(step => step.task?.trim())
            .map(step => ({
              task: step.task,
              measure: step.measure || "Progress is measured by completing the first defined action for this focus area.",
              obstacle: step.obstacle || "The next obstacle for this focus area still needs to be identified.",
              overcome: step.overcome || "Review the obstacle and choose one practical adjustment.",
              contingency: step.obstacle || step.overcome
                ? "If this obstacle appears, use the listed overcome strategy and adjust the timeline or task scope."
                : "If progress stalls, reduce the scope and complete a smaller version of the action.",
              startDate: step.startDate || sub.startDate || "",
              endDate: step.endDate || (sub.isOngoing ? "" : (sub.finishDate || "")),
              isOngoing: sub.isOngoing,
              progress: 0
            }));

          return {
            domainId: domain.id,
            subId: sub.id,
            steps: normalizedSteps.length > 0 ? normalizedSteps : [buildContextualActionStepFallback(sub, domain)]
          };
        } catch (error) {
          console.error("Error preparing tactical roadmap for", sub.name, error);
          return { domainId: domain.id, subId: sub.id, steps: [buildContextualActionStepFallback(sub, domain)] };
        }
      }));

      setDomains(prev => prev.map(domain => ({
        ...domain,
        subAreas: domain.subAreas.map(sub => {
          if (hasUsableActionSteps(sub)) return sub;
          const match = generated.find(item => item.domainId === domain.id && item.subId === sub.id);
          return match ? { ...sub, actionSteps: match.steps } : sub;
        })
      })));
    } finally {
      setIsPreparingTacticalRoadmap(false);
    }
  };

  useEffect(() => {
    if (step !== CoachingStep.MASTERPLAN && step !== CoachingStep.CONSOLIDATED_PLAN) return;
    if (isPreparingTacticalRoadmap) return;
    if (!domains.some(domain => domain.subAreas.some(sub => sub.selected !== false && !hasUsableActionSteps(sub)))) return;
    prepareMissingTacticalRoadmaps();
  }, [step, domains, isPreparingTacticalRoadmap]);

  const toggleSubAreaExpansion = (id: string) => {
    setExpandedSubAreas(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const generateSubAreaObstacles = async (domainId: string, subAreaId: string) => {
    const domain = domains.find(d => d.id === domainId);
    if (!domain) return;
    const subArea = domain.subAreas.find(s => s.id === subAreaId);
    if (!subArea || !subArea.name) return;

    setIsGeneratingObstacles(true);
    try {
      const suggestedObstacles = await coachingService.suggestObstacles(subArea.name);
      setDomains(prev => prev.map(d => {
        if (d.id !== domainId) return d;
        return {
          ...d,
          subAreas: d.subAreas.map(s => {
            if (s.id !== subAreaId) return s;
            return {
              ...s,
              obstacles: suggestedObstacles.map(obs => ({ obstacle: obs, solution: "" }))
            };
          })
        };
      }));
    } catch (error) {
      console.error("Error generating obstacles:", error);
      showAiFallback("AI suggestions could not be generated. You can add obstacles manually and continue.");
    } finally {
      setIsGeneratingObstacles(false);
    }
  };

  const generateObstacleSolution = async (domainId: string, subAreaId: string, obstacleIndex: number) => {
    const domain = domains.find(d => d.id === domainId);
    if (!domain) return;
    const subArea = domain.subAreas.find(s => s.id === subAreaId);
    if (!subArea || !subArea.obstacles || !subArea.obstacles[obstacleIndex]) return;

    setIsGeneratingObstacleSolution(true);
    try {
      const suggestion = await coachingService.suggestObstacleSolution(subArea.name, subArea.obstacles[obstacleIndex].obstacle);
      setDomains(prev => prev.map(d => {
        if (d.id !== domainId) return d;
        return {
          ...d,
          subAreas: d.subAreas.map(s => {
            if (s.id !== subAreaId) return s;
            const updatedObstacles = [...(s.obstacles || [])];
            updatedObstacles[obstacleIndex] = { ...updatedObstacles[obstacleIndex], solution: suggestion };
            return { ...s, obstacles: updatedObstacles };
          })
        };
      }));
    } catch (error) {
      console.error("Error generating solution:", error);
      showAiFallback("AI suggestions could not be generated. You can write a solution manually and continue.");
    } finally {
      setIsGeneratingObstacleSolution(false);
    }
  };

  const completeDiscovery = async () => {
    if (selectedRoles.length === 0) return;
    
    setIsGeneratingDomainVision(true);
    setAiFeedback(null);
    try {
      // Initialize domains with shells
      const initialDomains = selectedRoles.map(name => {
        const existing = domains.find(d => d.name === name);
        return existing || { 
          id: Math.random().toString(36).substr(2, 9), 
          name, 
          subAreas: [],
          currentRating: 5,
          futureRating: 8
        };
      });

      const newlyProcessedDomains = await Promise.all(initialDomains.map(async (domain) => {
        try {
          // Only generate if it doesn't have a vision yet or we want to refresh
          const context = await coachingService.suggestDomainContext(domain.name, discoveryResponses);
          const focusAreas = context.subAreas?.filter(Boolean).slice(0, 4);
          if (!focusAreas.length) {
            showAiFallback();
          }
          return {
            ...domain,
            domainVision: context.vision,
            why: context.why,
            subAreas: (focusAreas.length ? focusAreas : FALLBACK_FOCUS_AREAS).map(s => ({
              id: Math.random().toString(36).substr(2, 9),
              name: s,
              selected: true
            }))
          };
        } catch (err) {
          console.error(`Error generating context for ${domain.name}:`, err);
          showAiFallback();
          return {
            ...domain,
            domainVision: domain.domainVision || "",
            why: domain.why || "",
            subAreas: domain.subAreas.length > 0 ? domain.subAreas : createFallbackSubAreas(true)
          };
        }
      }));

      // Merge: Update existing if found, else add
      setDomains(prev => {
        const newDomains = [...prev];
        newlyProcessedDomains.forEach(nd => {
          const idx = newDomains.findIndex(d => d.name === nd.name);
          if (idx !== -1) {
            newDomains[idx] = nd;
          } else {
            newDomains.push(nd);
          }
        });
        return newDomains;
      });
      
      setActiveDomainId(newlyProcessedDomains[0].id);
      setShowDomainVisionResults(true);
      setAiFeedback(null);
      window.setTimeout(() => scrollViewportToTop('smooth'), 100);
    } catch (error) {
      console.error("Error completing discovery:", error);
      showAiFallback();
    } finally {
      setIsGeneratingDomainVision(false);
    }
  };

  const generateAlternativeSubAreas = async (domainId: string) => {
    const domain = domains.find(d => d.id === domainId);
    if (!domain) return;

    setIsGeneratingAlternatives(true);
    setAiFeedback(null);
    try {
      const existingNames = domain.subAreas.map(s => s.name);
      const suggestions = await coachingService.suggestSubAreas(domain.name, discoveryResponses, existingNames);
      const cleanSuggestions = suggestions.filter(s => s.trim() && !existingNames.some(existing => existing.toLowerCase() === s.trim().toLowerCase()));
      const finalSuggestions = cleanSuggestions.length > 0 ? cleanSuggestions : FALLBACK_FOCUS_AREAS.filter(s => !existingNames.some(existing => existing.toLowerCase() === s.toLowerCase()));
      if (cleanSuggestions.length === 0) {
        showAiFallback();
      }
      
      const newSubAreas = finalSuggestions.map(s => ({
        id: Math.random().toString(36).substr(2, 9),
        name: s,
        selected: false // Default to unselected so user can choose
      }));

      setDomains(prev => prev.map(d => {
        if (d.id !== domainId) return d;
        return {
          ...d,
          subAreas: [...d.subAreas, ...newSubAreas].slice(0, 12) // Keep a reasonable limit
        };
      }));
    } catch (error) {
      console.error("Error generating alternative sub-areas:", error);
      showAiFallback();
      const existingNames = domain.subAreas.map(s => s.name.toLowerCase());
      const fallbackSubAreas = FALLBACK_FOCUS_AREAS
        .filter(name => !existingNames.includes(name.toLowerCase()))
        .map(name => ({
          id: Math.random().toString(36).substr(2, 9),
          name,
          selected: false
        }));
      setDomains(prev => prev.map(d => d.id === domainId ? { ...d, subAreas: [...d.subAreas, ...fallbackSubAreas].slice(0, 12) } : d));
    } finally {
      setIsGeneratingAlternatives(false);
    }
  };

  const toggleSubAreaSelection = (domainId: string, subAreaId: string) => {
    setDomains(prev => prev.map(d => {
      if (d.id !== domainId) return d;
      
      const subArea = d.subAreas.find(s => s.id === subAreaId);
      if (!subArea) return d;

      const isCurrentlySelected = subArea.selected !== false;
      const isSelecting = !isCurrentlySelected;

      if (isSelecting) {
        const selectedCount = d.subAreas.filter(s => s.selected !== false).length;
        if (selectedCount >= 4) {
          return d; // enforce hard maximum of 4
        }
      }

      return {
        ...d,
        subAreas: d.subAreas.map(s => {
          if (s.id !== subAreaId) return s;
          return { ...s, selected: isCurrentlySelected ? false : true };
        })
      };
    }));
  };

  const addManualFocusArea = (domainId: string) => {
    const trimmed = newFocusAreaName.trim();
    if (!trimmed) return;

    setDomains(prev => prev.map(d => {
      if (d.id !== domainId) return d;
      const selectedCount = d.subAreas.filter(s => s.selected !== false).length;
      const alreadyExists = d.subAreas.some(s => s.name.trim().toLowerCase() === trimmed.toLowerCase());
      if (alreadyExists) return d;

      return {
        ...d,
        subAreas: [
          ...d.subAreas,
          {
            id: Math.random().toString(36).substr(2, 9),
            name: trimmed,
            selected: selectedCount < 4
          }
        ]
      };
    }));
    setNewFocusAreaName('');
  };

  const finalizeSubAreas = () => {
    // Filter out unselected sub-areas for ALL domains
    setDomains(prev => prev.map(d => ({
      ...d,
      subAreas: d.subAreas.filter(s => s.selected !== false) // default to true if undefined
    })));
    skipToStep(CoachingStep.RATINGS);
  };

  // Sub-area Generation
  const generateSubAreas = async (forceRegenerate = false) => {
    skipToStep(CoachingStep.END_GOALS); // Navigate first

    if (!forceRegenerate && domains.every(d => d.subAreas.length > 0)) {
      return;
    }

    setIsArchitecting(true);
    try {
      const updatedDomains = await Promise.all(domains.map(async (domain) => {
        if (!forceRegenerate && domain.subAreas.length > 0) return domain;
        const suggestions = (domain.suggestions && !forceRegenerate) 
          ? domain.suggestions 
          : await coachingService.suggestSubAreas(domain.name, discoveryResponses);
        const cleanSuggestions = suggestions.filter(Boolean);
        
        return {
          ...domain,
          subAreas: (cleanSuggestions.length > 0 ? cleanSuggestions : FALLBACK_FOCUS_AREAS).map(s => ({
            id: Math.random().toString(36).substr(2, 9),
            name: s,
            selected: true
          }))
        };
      }));
      setDomains(updatedDomains);
      if (updatedDomains.length > 0) setActiveDomainId(updatedDomains[0].id);
    } catch (error) {
      console.error("Error generating sub-areas:", error);
      showAiFallback();
      const updatedDomains = domains.map(domain => ({
        ...domain,
        subAreas: domain.subAreas.length > 0 ? domain.subAreas : createFallbackSubAreas(true)
      }));
      setDomains(updatedDomains);
      if (updatedDomains.length > 0) setActiveDomainId(updatedDomains[0].id);
    } finally {
      setIsArchitecting(false);
    }
  };

  const regenerateSubAreaGoals = async (domainId: string, subAreaId: string) => {
    const domain = domains.find(d => d.id === domainId);
    if (!domain) return;
    const subArea = domain.subAreas.find(s => s.id === subAreaId);
    if (!subArea) return;

    setLoading(true);
    try {
      const details = await coachingService.suggestDREAMDetails(`${domain.name} > ${subArea.name}`, domain.currentRating || 5, domain.futureRating || 8);
      setDomains(domains.map(d => {
        if (d.id !== domainId) return d;
        return {
          ...d,
          subAreas: d.subAreas.map(s => {
            if (s.id !== subAreaId) return s;
            return {
              ...s,
              ...details,
              actionSteps: details.actionSteps.map((as: any) => ({ ...as, progress: 0 }))
            };
          })
        };
      }));
    } catch (e) {
      console.error("Failed to regenerate goals", e);
      showAiFallback("AI suggestions could not be generated. You can edit these details manually and continue.");
    } finally {
      setLoading(false);
    }
  };

  const refineActionStepsWithAI = async (domainId: string, subAreaId: string) => {
    const domain = domains.find(d => d.id === domainId);
    if (!domain) return;
    const subArea = domain.subAreas.find(s => s.id === subAreaId);
    if (!subArea || !subArea.actionSteps) return;

    setLoading(true);
    try {
      const result = await coachingService.refineActionSteps(subArea.name, subArea.actionSteps);
      setDomains(domains.map(d => {
        if (d.id !== domainId) return d;
        return {
          ...d,
          subAreas: d.subAreas.map(s => {
            if (s.id !== subAreaId) return s;
            return {
              ...s,
              actionSteps: result.actionSteps.map((as: any) => ({ ...as, progress: 0 }))
            };
          })
        };
      }));
    } catch (e) {
      console.error("Failed to refine action steps", e);
      showAiFallback("AI suggestions could not be generated. You can refine action steps manually and continue.");
    } finally {
      setLoading(false);
    }
  };

  const updateDomainRating = (domainId: string, field: 'currentRating' | 'futureRating' | 'urgency' | 'importance', value: number) => {
    setDomains(domains.map(d => {
      if (d.id !== domainId) return d;
      return { ...d, [field]: value };
    }));
  };

  const fetchSubAreaSuggestions = async (domainId: string) => {
    const domain = domains.find(d => d.id === domainId);
    if (!domain || !domain.domainGoal) return;

    setDomains(prev => prev.map(d => d.id === domainId ? { ...d, isGenerating: true } : d));
    try {
      const strategy = await coachingService.suggestDomainStrategy(domain.name, domain.domainGoal);
      setDomains(prev => prev.map(d => {
        if (d.id !== domainId) return d;
        return {
          ...d,
          isGenerating: false,
          subAreas: strategy.subDomains.map((sd: any) => ({
            id: Math.random().toString(36).substr(2, 9),
            name: sd.name,
            goal: sd.goal,
            actionSteps: sd.actionSteps.map((as: any) => ({ ...as, progress: 0 }))
          })),
          suggestedAffirmations: strategy.affirmations
        };
      }));
    } catch (e) {
      console.error("Failed to fetch domain strategy", e);
      showAiFallback("AI suggestions could not be generated. You can continue with fallback focus areas or add your own.");
      setDomains(prev => prev.map(d => d.id === domainId ? { ...d, isGenerating: false } : d));
    }
  };

  const updateSubAreaPriority = (domainId: string, subAreaId: string, field: 'urgency' | 'importance', value: number) => {
    setDomains(domains.map(d => {
      if (d.id !== domainId) return d;
      return {
        ...d,
        subAreas: d.subAreas.map(s => {
          if (s.id !== subAreaId) return s;
          return { ...s, [field]: value };
        })
      };
    }));
  };

  const updateActionStepDate = (domainId: string, subAreaId: string, stepIndex: number, newDate: string) => {
    setDomains(domains.map(d => {
      if (d.id !== domainId) return d;
      return {
        ...d,
        subAreas: d.subAreas.map(s => {
          if (s.id !== subAreaId) return s;
          const updatedActionSteps = [...(s.actionSteps || [])];
          if (updatedActionSteps[stepIndex]) {
            updatedActionSteps[stepIndex] = { ...updatedActionSteps[stepIndex], dueDate: newDate };
          }
          return { ...s, actionSteps: updatedActionSteps };
        })
      };
    }));
  };

  const updateActionStepMeasure = (domainId: string, subAreaId: string, stepIndex: number, newMeasure: string) => {
    setDomains(domains.map(d => {
      if (d.id !== domainId) return d;
      return {
        ...d,
        subAreas: d.subAreas.map(s => {
          if (s.id !== subAreaId) return s;
          const updatedActionSteps = [...(s.actionSteps || [])];
          if (updatedActionSteps[stepIndex]) {
            updatedActionSteps[stepIndex] = { ...updatedActionSteps[stepIndex], measure: newMeasure };
          }
          return { ...s, actionSteps: updatedActionSteps };
        })
      };
    }));
  };

  const updateActionStepObstacle = (domainId: string, subAreaId: string, stepIndex: number, newObstacle: string) => {
    setDomains(domains.map(d => {
      if (d.id !== domainId) return d;
      return {
        ...d,
        subAreas: d.subAreas.map(s => {
          if (s.id !== subAreaId) return s;
          const updatedActionSteps = [...(s.actionSteps || [])];
          if (updatedActionSteps[stepIndex]) {
            updatedActionSteps[stepIndex] = { ...updatedActionSteps[stepIndex], obstacle: newObstacle };
          }
          return { ...s, actionSteps: updatedActionSteps };
        })
      };
    }));
  };

  const updateActionStepOvercome = (domainId: string, subAreaId: string, stepIndex: number, newOvercome: string) => {
    setDomains(domains.map(d => {
      if (d.id !== domainId) return d;
      return {
        ...d,
        subAreas: d.subAreas.map(s => {
          if (s.id !== subAreaId) return s;
          const updatedActionSteps = [...(s.actionSteps || [])];
          if (updatedActionSteps[stepIndex]) {
            updatedActionSteps[stepIndex] = { ...updatedActionSteps[stepIndex], overcome: newOvercome };
          }
          return { ...s, actionSteps: updatedActionSteps };
        })
      };
    }));
  };

  const addSubAreaComment = (domainId: string, subAreaId: string, comment: string) => {
    if (!comment.trim()) return;
    setDomains(domains.map(d => {
      if (d.id !== domainId) return d;
      return {
        ...d,
        subAreas: d.subAreas.map(s => {
          if (s.id !== subAreaId) return s;
          return { ...s, coachComments: [...(s.coachComments || []), comment] };
        })
      };
    }));
  };

  const addActionStepComment = (domainId: string, subAreaId: string, stepIndex: number, comment: string) => {
    if (!comment.trim()) return;
    setDomains(domains.map(d => {
      if (d.id !== domainId) return d;
      return {
        ...d,
        subAreas: d.subAreas.map(s => {
          if (s.id !== subAreaId) return s;
          const updatedActionSteps = [...(s.actionSteps || [])];
          if (updatedActionSteps[stepIndex]) {
            updatedActionSteps[stepIndex] = { 
              ...updatedActionSteps[stepIndex], 
              coachComments: [...(updatedActionSteps[stepIndex].coachComments || []), comment] 
            };
          }
          return { ...s, actionSteps: updatedActionSteps };
        })
      };
    }));
  };

  const deleteSubAreaComment = (domainId: string, subAreaId: string, commentIndex: number) => {
    setDomains(domains.map(d => {
      if (d.id !== domainId) return d;
      return {
        ...d,
        subAreas: d.subAreas.map(s => {
          if (s.id !== subAreaId) return s;
          const updatedComments = [...(s.coachComments || [])];
          updatedComments.splice(commentIndex, 1);
          return { ...s, coachComments: updatedComments };
        })
      };
    }));
  };

  const deleteActionStepComment = (domainId: string, subAreaId: string, stepIndex: number, commentIndex: number) => {
    setDomains(domains.map(d => {
      if (d.id !== domainId) return d;
      return {
        ...d,
        subAreas: d.subAreas.map(s => {
          if (s.id !== subAreaId) return s;
          const updatedActionSteps = [...(s.actionSteps || [])];
          if (updatedActionSteps[stepIndex]) {
            const updatedComments = [...(updatedActionSteps[stepIndex].coachComments || [])];
            updatedComments.splice(commentIndex, 1);
            updatedActionSteps[stepIndex] = { ...updatedActionSteps[stepIndex], coachComments: updatedComments };
          }
          return { ...s, actionSteps: updatedActionSteps };
        })
      };
    }));
  };

  const getTaskStatus = (dueDate: string, progress: number) => {
    const start = new Date(planCreatedAt).getTime();
    const now = new Date().getTime();
    
    // Parse dueDate (e.g., "Within 2 weeks")
    let days = 14; // default
    const match = dueDate.match(/(\d+)\s+(week|month|day)/i);
    if (match) {
      const num = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      if (unit.startsWith('week')) days = num * 7;
      else if (unit.startsWith('month')) days = num * 30;
      else days = num;
    } else if (dueDate.toLowerCase().includes('immediate')) {
      days = 1;
    } else if (dueDate.toLowerCase().includes('ongoing')) {
      return { label: 'Ongoing', color: 'text-emerald-600', expected: 0 };
    }
    
    const end = start + (days * 24 * 60 * 60 * 1000);
    const totalDuration = end - start;
    const elapsed = now - start;
    
    const expectedProgress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
    
    if (progress >= 100) return { label: 'Completed', color: 'text-emerald-600', expected: expectedProgress };
    if (progress > expectedProgress + 15) return { label: 'Ahead', color: 'text-emerald-600', expected: expectedProgress };
    if (progress < expectedProgress - 15) return { label: 'Behind', color: 'text-amber-600', expected: expectedProgress };
    return { label: 'On Track', color: 'text-stone-500', expected: expectedProgress };
  };

  const updateActionStepProgress = (domainId: string, subAreaId: string, stepIndex: number, progress: number) => {
    setDomains(domains.map(d => {
      if (d.id !== domainId) return d;
      return {
        ...d,
        subAreas: d.subAreas.map(s => {
          if (s.id !== subAreaId) return s;
          const updatedActionSteps = [...(s.actionSteps || [])];
          if (updatedActionSteps[stepIndex]) {
            updatedActionSteps[stepIndex] = { ...updatedActionSteps[stepIndex], progress };
          }
          return { ...s, actionSteps: updatedActionSteps };
        })
      };
    }));
  };

  const getCalendarUrl = (task: string, dueDate: string, type: 'google' | 'outlook') => {
    const now = new Date();
    let targetDate = new Date();

    // Simple date parsing for common relative terms
    const lowerDate = dueDate.toLowerCase();
    if (lowerDate.includes('week')) {
      const weeks = parseInt(lowerDate) || 1;
      targetDate.setDate(now.getDate() + (weeks * 7));
    } else if (lowerDate.includes('month')) {
      const months = parseInt(lowerDate) || 1;
      targetDate.setMonth(now.getMonth() + months);
    } else if (lowerDate.includes('day')) {
      const days = parseInt(lowerDate) || 1;
      targetDate.setDate(now.getDate() + days);
    } else {
      // Default to 1 week if unclear
      targetDate.setDate(now.getDate() + 7);
    }

    const formatDate = (date: Date) => date.toISOString().replace(/-|:|\.\d+/g, '');
    const start = formatDate(targetDate);
    const end = formatDate(new Date(targetDate.getTime() + 3600000)); // 1 hour later

    if (type === 'google') {
      return `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(task)}&dates=${start}/${end}&details=${encodeURIComponent('Action step from your DREAMsheet AI blueprint.')}`;
    } else {
      return `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${encodeURIComponent(task)}&startdt=${targetDate.toISOString()}&enddt=${new Date(targetDate.getTime() + 3600000).toISOString()}&body=${encodeURIComponent('Action step from your DREAMsheet AI blueprint.')}`;
    }
  };

  const updateActionStepTask = (domainId: string, subAreaId: string, stepIndex: number, newTask: string) => {
    setDomains(domains.map(d => {
      if (d.id !== domainId) return d;
      return {
        ...d,
        subAreas: d.subAreas.map(s => {
          if (s.id !== subAreaId) return s;
          const updatedActionSteps = [...(s.actionSteps || [])];
          if (updatedActionSteps[stepIndex]) {
            updatedActionSteps[stepIndex] = { ...updatedActionSteps[stepIndex], task: newTask };
          }
          return { ...s, actionSteps: updatedActionSteps };
        })
      };
    }));
  };

  const deleteActionStep = (domainId: string, subAreaId: string, stepIndex: number) => {
    setDomains(domains.map(d => {
      if (d.id !== domainId) return d;
      return {
        ...d,
        subAreas: d.subAreas.map(s => {
          if (s.id !== subAreaId) return s;
          const updatedActionSteps = (s.actionSteps || []).filter((_, i) => i !== stepIndex);
          return { ...s, actionSteps: updatedActionSteps };
        })
      };
    }));
  };

  const addActionStep = (domainId: string, subAreaId: string) => {
    setDomains(domains.map(d => {
      if (d.id !== domainId) return d;
      return {
        ...d,
        subAreas: d.subAreas.map(s => {
          if (s.id !== subAreaId) return s;
          const updatedActionSteps = [...(s.actionSteps || []), { task: 'New Action Step', measure: '', dueDate: 'TBD', progress: 0 }];
          return { ...s, actionSteps: updatedActionSteps };
        })
      };
    }));
  };

  const updateSubAreaGoal = (domainId: string, subAreaId: string, newGoal: string) => {
    setDomains(prev => prev.map(d => {
      if (d.id !== domainId) return d;
      return {
        ...d,
        subAreas: d.subAreas.map(s => {
          if (s.id !== subAreaId) return s;
          
          let updatedAffirmation = s.affirmation;
          let updatedActionSteps = s.actionSteps;

          // If the new goal matches a suggestion, try to find corresponding affirmation and action cluster
          if (s.suggestedGoals) {
            const goalIndex = s.suggestedGoals.findIndex(g => g === newGoal || g.includes(newGoal) || newGoal.includes(g));
            if (goalIndex !== -1) {
              if (s.suggestedAffirmations && s.suggestedAffirmations[goalIndex]) {
                updatedAffirmation = s.suggestedAffirmations[goalIndex];
              }
              if (s.suggestedActionClusters && s.suggestedActionClusters[goalIndex]) {
                const measures = s.suggestedMeasureClusters?.[goalIndex] || [];
                const obstacles = s.suggestedObstacleClusters?.[goalIndex] || [];
                const overcomes = s.suggestedOvercomeClusters?.[goalIndex] || [];
                updatedActionSteps = s.suggestedActionClusters[goalIndex].map((task, i) => ({
                  task: task.startsWith('- ') ? task.substring(2) : task,
                  measure: measures[i]?.startsWith('- ') ? measures[i].substring(2) : (measures[i] || ''),
                  obstacle: obstacles[i]?.startsWith('- ') ? obstacles[i].substring(2) : (obstacles[i] || ''),
                  overcome: overcomes[i]?.startsWith('- ') ? overcomes[i].substring(2) : (overcomes[i] || ''),
                  dueDate: 'Week 1',
                  progress: 0
                }));
              }
            }
          }

          return { 
            ...s, 
            goal: newGoal, 
            affirmation: updatedAffirmation,
            actionSteps: updatedActionSteps
          };
        })
      };
    }));
  };

  const updateSubAreaName = (domainId: string, subAreaId: string, newName: string) => {
    setDomains(prev => prev.map(d => {
      if (d.id !== domainId) return d;
      return {
        ...d,
        subAreas: d.subAreas.map(s => {
          if (s.id !== subAreaId) return s;
          return { ...s, name: newName };
        })
      };
    }));
  };

  const updateSubAreaGoalValue = (domainId: string, subAreaId: string, newValue: string) => {
    setDomains(prev => prev.map(d => {
      if (d.id !== domainId) return d;
      return {
        ...d,
        subAreas: d.subAreas.map(s => {
          if (s.id !== subAreaId) return s;
          return { ...s, goal: newValue };
        })
      };
    }));
  };

  const updateSubAreaMilestone = (domainId: string, subAreaId: string, milestoneIndex: number, newValue: string) => {
    setDomains(domains.map(d => {
      if (d.id !== domainId) return d;
      return {
        ...d,
        subAreas: d.subAreas.map(s => {
          if (s.id !== subAreaId) return s;
          const updatedMilestones = [...(s.milestones || [])];
          updatedMilestones[milestoneIndex] = newValue;
          return { ...s, milestones: updatedMilestones };
        })
      };
    }));
  };

  const updateSubAreaSuccessIndicator = (domainId: string, subAreaId: string, newValue: string) => {
    setDomains(domains.map(d => {
      if (d.id !== domainId) return d;
      return {
        ...d,
        subAreas: d.subAreas.map(s => {
          if (s.id !== subAreaId) return s;
          return { ...s, successIndicator: newValue };
        })
      };
    }));
  };

  const updateSubAreaAffirmation = (domainId: string, subAreaId: string, newAffirmation: string) => {
    setDomains(domains.map(d => {
      if (d.id !== domainId) return d;
      return {
        ...d,
        subAreas: d.subAreas.map(s => {
          if (s.id !== subAreaId) return s;
          return { ...s, affirmation: newAffirmation };
        })
      };
    }));
  };

  const regenerateSubAreaDREAM = async (domainId: string, subAreaId: string) => {
    setLoading(true);
    const domain = domains.find(d => d.id === domainId);
    const sub = domain?.subAreas.find(s => s.id === subAreaId);
    if (!sub) {
      setLoading(false);
      return;
    }
    try {
      const suggestions = await coachingService.suggestDREAMDetails(sub.name, sub.currentRating, sub.futureRating);
      setDomains(domains.map(d => {
        if (d.id !== domainId) return d;
        return {
          ...d,
          subAreas: d.subAreas.map(s => {
            if (s.id !== subAreaId) return s;
            return { ...s, ...suggestions };
          })
        };
      }));
    } catch (e) {
      console.error("Failed to regenerate DREAM details", e);
      showAiFallback("AI suggestions could not be generated. You can edit these details manually and continue.");
    } finally {
      setLoading(false);
    }
  };

  const updateObstacle = (domainId: string, subAreaId: string, obstacleIndex: number, field: 'obstacle' | 'solution', newValue: string) => {
    setDomains(domains.map(d => {
      if (d.id !== domainId) return d;
      return {
        ...d,
        subAreas: d.subAreas.map(s => {
          if (s.id !== subAreaId) return s;
          const updatedObstacles = [...(s.obstacles || [])];
          if (updatedObstacles[obstacleIndex]) {
            updatedObstacles[obstacleIndex] = { ...updatedObstacles[obstacleIndex], [field]: newValue };
          }
          return { ...s, obstacles: updatedObstacles };
        })
      };
    }));
  };

  const deleteObstacle = (domainId: string, subAreaId: string, obstacleIndex: number) => {
    setDomains(domains.map(d => {
      if (d.id !== domainId) return d;
      return {
        ...d,
        subAreas: d.subAreas.map(s => {
          if (s.id !== subAreaId) return s;
          const updatedObstacles = (s.obstacles || []).filter((_, i) => i !== obstacleIndex);
          return { ...s, obstacles: updatedObstacles };
        })
      };
    }));
  };

  const addObstacle = (domainId: string, subAreaId: string) => {
    setDomains(domains.map(d => {
      if (d.id !== domainId) return d;
      return {
        ...d,
        subAreas: d.subAreas.map(s => {
          if (s.id !== subAreaId) return s;
          const updatedObstacles = [...(s.obstacles || []), { obstacle: 'New Obstacle', solution: 'Proposed Solution' }];
          return { ...s, obstacles: updatedObstacles };
        })
      };
    }));
  };

  const addObstacleComment = (domainId: string, subAreaId: string, obstacleIndex: number, comment: string) => {
    if (!comment.trim()) return;
    setDomains(prev => prev.map(d => {
      if (d.id !== domainId) return d;
      return {
        ...d,
        subAreas: d.subAreas.map(s => {
          if (s.id !== subAreaId) return s;
          const updatedObstacles = [...(s.obstacles || [])];
          if (updatedObstacles[obstacleIndex]) {
            updatedObstacles[obstacleIndex] = { 
              ...updatedObstacles[obstacleIndex], 
              comments: [...(updatedObstacles[obstacleIndex].comments || []), comment] 
            };
          }
          return { ...s, obstacles: updatedObstacles };
        })
      };
    }));
  };

  const deleteObstacleComment = (domainId: string, subAreaId: string, obstacleIndex: number, commentIndex: number) => {
    setDomains(prev => prev.map(d => {
      if (d.id !== domainId) return d;
      return {
        ...d,
        subAreas: d.subAreas.map(s => {
          if (s.id !== subAreaId) return s;
          const updatedObstacles = [...(s.obstacles || [])];
          if (updatedObstacles[obstacleIndex]) {
            const updatedComments = [...(updatedObstacles[obstacleIndex].comments || [])];
            updatedComments.splice(commentIndex, 1);
            updatedObstacles[obstacleIndex] = { ...updatedObstacles[obstacleIndex], comments: updatedComments };
          }
          return { ...s, obstacles: updatedObstacles };
        })
      };
    }));
  };

  const updateRelatedSubAreas = (domainId: string, subAreaId: string, relatedId: string) => {
    setDomains(domains.map(d => {
      if (d.id !== domainId) return d;
      return {
        ...d,
        subAreas: d.subAreas.map(s => {
          if (s.id !== subAreaId) return s;
          const currentRelated = s.relatedSubAreaIds || [];
          const updatedRelated = currentRelated.includes(relatedId)
            ? currentRelated.filter(id => id !== relatedId)
            : [...currentRelated, relatedId];
          return { ...s, relatedSubAreaIds: updatedRelated };
        })
      };
    }));
  };

  const generateDREAM = async (forceRegenerate = false) => {
    skipToStep(CoachingStep.END_GOALS); // Navigate first

    if (!forceRegenerate && domains.every(d => d.subAreas.every(s => s.goal))) {
      return;
    }

    setIsArchitecting(true);
    try {
      const updatedDomains = await Promise.all(domains.map(async (domain) => {
        const updatedSubAreas = await Promise.all(domain.subAreas.map(async (sub) => {
          if (!forceRegenerate && (sub.gap <= 0 || sub.goal)) return sub;
          const suggestions = await coachingService.suggestDREAMDetails(`${domain.name} > ${sub.name}`, domain.currentRating || 5, domain.futureRating || 8);
          return { ...sub, ...suggestions };
        }));
        return { ...domain, subAreas: updatedSubAreas };
      }));
      setDomains(updatedDomains);
      if (updatedDomains.length > 0) {
        const firstValidDomain = updatedDomains.find(d => d.subAreas.length > 0);
        if (firstValidDomain) setActiveDomainId(firstValidDomain.id);
      }
    } catch (e) {
      console.error("Failed to generate DREAM details", e);
      showAiFallback("AI suggestions could not be generated. You can edit your DREAM details manually and continue.");
    } finally {
      setIsArchitecting(false);
    }
  };

  const isNaturalScrollStep = step === CoachingStep.MASTERPLAN || step === CoachingStep.CONSOLIDATED_PLAN;
  const currentSessionDomainNames = currentSessionDomains.map(domain => domain.name).filter(Boolean);
  const currentSessionFocusAreaNames = currentSessionDomains.flatMap(domain => domain.subAreas.map(sub => sub.name).filter(Boolean));

  return (
    <div className={cn(
      "flex flex-col bg-[#FDFCFB] text-[#2D2D2D] font-sans selection:bg-emerald-100",
      "min-h-screen"
    )} ref={appShellRef}>
      {/* Header */}
      <header className="bg-black text-white shrink-0 sticky top-0 z-[9999] border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="flex items-center gap-3 min-w-0">
                {logoFailed ? (
                  <div className="flex flex-col text-left min-w-0">
                    <span className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-white leading-tight truncate">DreamSheet AI</span>
                    <span className="hidden md:block text-[#888888] text-[11px] font-light truncate">Create clarity. Build direction. Take action.</span>
                  </div>
                ) : (
                  <img
                    src="/flourish-logo.png"
                    alt="DreamSheet AI"
                    onError={() => setLogoFailed(true)}
                    className="h-12 sm:h-14 md:h-16 w-auto max-w-[210px] sm:max-w-[280px] md:max-w-[360px] object-contain shrink-0"
                  />
                )}
              </div>

              {/* Official Badge for Tablet/Desktop */}
              <div className="hidden lg:flex bg-[#1A1A1A] border border-[#2A2A2A] rounded px-2.5 py-1 items-center gap-2">
                <div className="w-3.5 h-3.5 rounded-full border border-emerald-500/40 flex items-center justify-center">
                  <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></div>
                </div>
                <span className="text-[8px] font-bold tracking-[0.2em] text-[#389167] uppercase">Official Strategic Plan</span>
              </div>
            </div>

            <div className="flex items-center gap-4 md:gap-8">
              {/* Coachee Metadata - Clickable configuration */}
              <button 
                onClick={() => setShowNameCapture(true)}
                className="hidden md:flex items-center gap-6 text-right group/meta hover:bg-white/5 px-3 py-1.5 rounded-xl border border-transparent hover:border-white/10 transition-all text-white outline-none cursor-pointer focus:ring-1 focus:ring-emerald-500/30"
                title="Click to edit Coach & Coachee names"
              >
                <div className="flex flex-col items-end">
                  <span className="text-[8px] font-bold text-[#888888] tracking-widest uppercase group-hover/meta:text-emerald-400 transition-colors">COACHEE</span>
                  <span className="text-xs font-semibold text-white tracking-tight">{clientName || "Guest Coachee"}</span>
                </div>
                <div className="flex flex-col items-end border-l border-white/10 pl-6">
                  <span className="text-[8px] font-bold text-[#888888] tracking-widest uppercase group-hover/meta:text-emerald-400 transition-colors">COACH</span>
                  <span className="text-xs font-semibold text-white tracking-tight">{coachName || "AI Coach"}</span>
                </div>
                <div className="flex flex-col items-end border-l border-white/10 pl-6">
                  <span className="text-[8px] font-bold text-[#888888] tracking-widest uppercase">DATE</span>
                  <span className="text-xs font-semibold text-white tracking-tight">{new Date().toLocaleDateString('en-GB')}</span>
                </div>
              </button>

              {/* Dev Mode & Step Controls */}
              <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-4 border-l border-white/10">
                <AnimatePresence>
                  {isDevMode && (
                    <select 
                      value={step}
                      onChange={(e) => skipToStep(e.target.value as CoachingStep)}
                      className="bg-stone-900 text-stone-400 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded border border-white/10 focus:ring-2 focus:ring-emerald-500/20 cursor-pointer outline-none"
                    >
                      {Object.values(CoachingStep).map(s => (
                        <option key={s} value={s}>{s.replace('_', ' ')}</option>
                      ))}
                    </select>
                  )}
                </AnimatePresence>

                <button
                  onClick={() => setShowNameCapture(true)}
                  className="p-2 rounded-full transition-all border border-white/5 text-stone-500 hover:text-emerald-500 hover:bg-white/5"
                  title="Configure Coach & Coachee Names"
                >
                  <User size={18} />
                </button>

                <div className="relative">
                  <button 
                    onClick={() => setShowStepList(!showStepList)}
                    className={cn(
                      "p-2 rounded-full transition-all border border-white/5",
                      showStepList ? "bg-emerald-600 text-white" : "text-stone-500 hover:text-emerald-500 hover:bg-white/5"
                    )}
                    title="Open step menu"
                    aria-label="Open step menu"
                  >
                    <Bot size={18} />
                  </button>

                  <AnimatePresence>
                    {showStepList && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowStepList(false)}></div>
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute right-0 mt-4 w-56 bg-[#1A1A1A] rounded-2xl shadow-2xl border border-white/5 py-3 z-50 overflow-hidden"
                        >
                          {[
                            { step: CoachingStep.WELCOME, label: "Welcome" },
                            { step: CoachingStep.CLEAR_SPACE, label: "Start" },
                            { step: CoachingStep.DOMAIN, label: "D: Domains" },
                            { step: CoachingStep.RATINGS, label: "R: Ratings" },
                            { step: CoachingStep.END_GOALS, label: "E: End-goals" },
                            { step: CoachingStep.AFFIRMATIONS, label: "A: Affirmations" },
                            { step: CoachingStep.MASTERPLAN, label: "M: Masterplan" },
                            { step: CoachingStep.CONSOLIDATED_PLAN, label: "Consolidated" }
                          ].map((item, idx) => (
                            <button
                              key={item.step}
                              onClick={() => {
                                skipToStep(item.step);
                                setShowStepList(false);
                              }}
                              className={cn(
                                "w-full text-left px-5 py-3 text-[10px] font-bold tracking-widest transition-colors flex items-center justify-between",
                                step === item.step ? "text-emerald-400 bg-white/5" : "text-stone-300 hover:bg-white/10"
                              )}
                            >
                              {item.label}
                              {step === item.step && <Check size={12} />}
                            </button>
                          ))}
                          <div className="border-t border-white/5 mt-2 pt-2">
                            <button
                              onClick={() => {
                                setShowResetConfirm(true);
                                setShowStepList(false);
                              }}
                              className="w-full text-left px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                            >
                              <RotateCcw size={12} />
                              Reset Session
                            </button>
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className={cn("flex-1 relative", "overflow-visible")}>
        <div className={cn(
          "max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-6 flex flex-col w-full animate-fade-in",
          isNaturalScrollStep ? "min-h-full" : "min-h-[calc(100vh-88px)]"
        )}>
          {/* Green focus area banner if after Domains step, but before Masterplan & Consolidated plan */}
          {step !== CoachingStep.WELCOME && 
           step !== CoachingStep.CLEAR_SPACE && 
           step !== CoachingStep.DOMAIN && 
           step !== CoachingStep.MASTERPLAN && 
           step !== CoachingStep.CONSOLIDATED_PLAN && (
            <div className="bg-emerald-50 border border-emerald-200/50 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 shadow-sm shrink-0 no-print animate-fade-in">
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-xs">
                  <Check size={12} strokeWidth={3} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-widest leading-none">Active Domains</h4>
                  <p className="text-[10px] text-emerald-700/80 font-medium">Switch domain to review its 4 Focus Areas</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto pr-1">
                {domains.length > 0 ? (
                  domains.map((dom) => (
                    <button 
                      key={dom.id}
                      onClick={() => setActiveDomainId(dom.id)}
                      className={cn(
                        "text-[11px] font-bold tracking-wide px-3 py-1.5 rounded-lg shadow-xs flex items-center gap-1.5 transition-all cursor-pointer",
                        activeDomainId === dom.id 
                          ? "bg-emerald-600 text-white ring-2 ring-emerald-500/20 shadow-sm"
                          : "bg-emerald-100 hover:bg-emerald-200 text-emerald-800"
                      )}
                      >
                        <span>{dom.name}</span>
                        <span className={cn(
                          "text-[9px] px-1 py-0.5 rounded font-mono",
                          activeDomainId === dom.id ? "bg-emerald-700 text-emerald-100" : "bg-emerald-200 text-emerald-800"
                        )}>
                          {dom.subAreas.length} FA
                        </span>
                        {dom.currentRating !== undefined && dom.futureRating !== undefined && (
                          <span className={cn(
                          "text-[9px] px-1 py-0.5 rounded font-mono",
                          activeDomainId === dom.id ? "bg-emerald-700 text-emerald-100" : "bg-emerald-200 text-emerald-800"
                        )}>
                          {dom.currentRating} → {dom.futureRating}
                        </span>
                      )}
                    </button>
                  ))
                ) : (
                  <span className="text-xs text-stone-600 italic">No focus areas were generated. Please try again or add one manually.</span>
                )}
              </div>
            </div>
          )}

          {aiFeedback && (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start justify-between gap-3 no-print">
              <div className="flex items-start gap-2">
                <ShieldAlert size={16} className="mt-0.5 shrink-0" />
                <span>{aiFeedback}</span>
              </div>
              <button
                onClick={() => setAiFeedback(null)}
                className="text-amber-700 hover:text-amber-950 shrink-0"
                aria-label="Dismiss AI message"
              >
                <X size={16} />
              </button>
            </div>
          )}

          <div className={cn("flex flex-col relative", isNaturalScrollStep ? "flex-1 min-h-fit" : "flex-1 min-h-0")}>
            <AnimatePresence mode="wait">
            {/* STEP 0: INTRO / MINDFULNESS */}
            {step === CoachingStep.CLEAR_SPACE && (
              <motion.div 
                key="intro"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="min-h-full overflow-y-auto flex flex-col justify-start md:justify-center font-gothic custom-scrollbar py-4 md:py-6 space-y-4 md:space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 w-full items-center">
                  {/* Left Column: Heading & Distraction Release */}
                  <div className="space-y-4 md:space-y-5 flex flex-col items-center md:items-start text-center md:text-left w-full">
                    <div className="space-y-2 md:space-y-3 flex flex-col items-center md:items-start w-full">
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 1 }}
                        className="inline-flex items-center justify-center w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full"
                      >
                        <Wind size={24} />
                      </motion.div>
                      <h2 className="text-2xl md:text-3xl font-light text-stone-900 tracking-tight">Clear the space.</h2>
                      <p className="text-sm md:text-base text-stone-500 font-light leading-relaxed max-w-sm">
                        Before we begin our session, let's set aside the noise of the present.
                      </p>
                    </div>

                    {/* Distraction Release */}
                    <div className="w-full max-w-md space-y-3 flex flex-col items-center md:items-start text-center md:text-left">
                      <input 
                        type="text" 
                        value={currentDistraction}
                        onChange={(e) => setCurrentDistraction(e.target.value)}
                        placeholder="Type a distraction and click Enter to release it..."
                        className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white shadow-sm text-sm"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && currentDistraction) {
                            setDistractions([...distractions, currentDistraction]);
                            setCurrentDistraction('');
                            setIsBreathing(true);
                          }
                        }}
                      />
                      <div className="flex flex-wrap justify-center md:justify-start gap-1.5 min-h-[28px] w-full">
                        <AnimatePresence>
                          {distractions.map((d, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 1.5, filter: 'blur(15px)', y: -20 }}
                              className="px-2.5 py-0.5 bg-stone-100 text-stone-500 rounded-full text-xs flex items-center gap-1 cursor-pointer hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                              onClick={() => setDistractions(distractions.filter((_, idx) => idx !== i))}
                            >
                              {d} <X size={10} />
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Breathing Exercise */}
                  <div className="relative h-48 md:h-60 flex flex-col items-center justify-center w-full">
                    <div className="relative flex items-center justify-center w-36 h-36 md:w-44 md:h-44">
                      <motion.div
                        animate={{ scale: [1, 1.5, 1], opacity: [0.1, 0.3, 0.1] }}
                        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute inset-0 bg-emerald-300 rounded-full blur-2xl"
                      />
                      <motion.div
                        animate={{ scale: [0.8, 1.3, 0.8] }}
                        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute w-24 h-24 md:w-32 md:h-32 border border-emerald-200/50 rounded-full shadow-[0_0_40px_rgba(16,185,129,0.1)]"
                      />
                      <motion.div
                        animate={{ scale: [0.6, 1.1, 0.6] }}
                        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute w-16 h-16 md:w-20 md:h-20 bg-white rounded-full flex items-center justify-center shadow-inner border border-stone-50"
                      >
                        <motion.div
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                        >
                          <Wind className="text-emerald-600" size={20} />
                        </motion.div>
                      </motion.div>
                      <div className="absolute -bottom-6 w-full">
                        <motion.p 
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                          className="text-[10px] font-bold uppercase tracking-[0.5em] text-emerald-800 text-center"
                        >
                          {isBreathing ? "Inhale ... Exhale" : "Focus on your breath"}
                        </motion.p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex flex-col items-center gap-4 w-full pt-2">
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button 
                      onClick={() => skipToStep(CoachingStep.WELCOME)}
                      className="bg-white border border-stone-200 text-stone-600 px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-stone-50 transition-all shadow-md text-xs md:text-sm"
                    >
                      <ChevronLeft size={16} /> Back to Welcome
                    </button>
                    <button 
                      onClick={() => skipToStep(CoachingStep.DOMAIN)}
                      className="bg-emerald-600 text-white px-8 py-3.5 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/10 uppercase tracking-widest text-xs md:text-sm"
                    >
                      CONTINUE TO D: DOMAINS
                      <ArrowRight size={16} />
                    </button>
                  </div>
                  <button 
                    onClick={() => skipToStep(CoachingStep.DOMAIN)}
                    className="text-stone-400 hover:text-stone-600 text-[10px] font-bold uppercase tracking-widest transition-colors"
                  >
                    Skip Mindfulness
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 0.1: WELCOME */}
            {step === CoachingStep.WELCOME && (
              <motion.div 
                key="welcome"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="min-h-full overflow-y-auto flex flex-col items-center md:items-start text-center md:text-left space-y-3.5 md:space-y-5 max-w-2xl mx-auto p-4 md:p-6 custom-scrollbar pb-6 pt-2 md:pt-4"
              >
                <div className="space-y-2 flex flex-col items-center md:items-start w-full">
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="flex items-center justify-center md:justify-start gap-3 text-emerald-600 mb-0.5 w-full"
                  >
                    <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white shadow-md shadow-emerald-600/10">
                      <Target size={18} />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-lg font-bold tracking-tight text-stone-900">DREAMsheet AI</span>
                      <span className="text-[10px] md:text-xs font-medium text-stone-500 leading-tight">Create clarity. Build direction. Take action.</span>
                    </div>
                  </motion.div>
                  
                  <h1 className="text-lg sm:text-2xl md:text-3xl font-light text-stone-900 leading-tight text-center md:text-left w-full sm:whitespace-nowrap">
                    Welcome to your <span className="font-serif italic text-emerald-700">Strategic Transformation</span>
                  </h1>
                  
                  <p className="text-stone-500 text-xs md:text-sm font-light leading-relaxed max-w-xl mx-auto md:mx-0 text-center md:text-left">
                    The world's first AI-powered goal-getting application, designed to help you set and achieve any goal in your life, personally and/or professionally.
                  </p>
                </div>

                <div className="w-full space-y-2 flex flex-col items-center md:items-start relative">
                  <div className="flex flex-col items-center md:items-start gap-1 w-full text-center md:text-left">
                    <span className="text-[9px] font-extrabold uppercase tracking-[0.3em] text-emerald-600">The D.R.E.A.M. Framework</span>
                    <p className="text-stone-400 text-[10px] md:text-xs font-medium whitespace-nowrap">
                      Five steps to take you from goal-setting to goal-achievement (hover/tap letters):
                    </p>
                  </div>
                  
                  
                  <div className="w-full relative mt-2 pt-1 pb-1">
                    <AnimatePresence>
                      {activeExplanation && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: 12 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 12 }}
                          transition={{ duration: 0.15, ease: "easeOut" }}
                          className="absolute bottom-full left-0 right-0 mb-4 bg-stone-900 border border-stone-800 rounded-2xl shadow-xl p-4 md:p-5 z-[200] text-left"
                        >
                          {[
                            { w: 'Domains', l: 'D', full: 'Domains are the areas of your life or your work where you want to make changes. Think of the big things like your Health, your Wealth, your Relationships, your Career or Business, your Family, etc.' },
                            { w: 'Ratings', l: 'R', full: 'How happy/fulfilled/satisfied/successful you feel currently about your Domains and how you’d like to feel when you’ve reached your goals. The size of the gap determines your priority order.' },
                            { w: 'End-goals', l: 'E', full: 'From this point forwards, based on the information you’ve provided, the AI does all the heavy lifting for you. The app creates strategic waypoints or milestones along your journey.' },
                            { w: 'Affirmations', l: 'A', full: 'These are powerful statements that sit alongside the End-goals. Neuroscientists have proved that reading these Affirmations night and morning causes your subconscious mind to align actions.' },
                            { w: 'Masterplan', l: 'M', full: 'The AI creates for you a comprehensive Masterplan with specific actions steps under each End-goal, planning for potential obstacles and how to overcome them.' }
                          ].map((item, idx) => {
                            if (item.w !== activeExplanation) return null;
                            const idxOffset = [10, 30, 50, 70, 90][idx];
                            return (
                              <div key={item.w} className="relative">
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xs sm:text-sm">
                                      {item.l}
                                    </span>
                                    <span className="font-extrabold text-[11px] sm:text-xs text-stone-200 uppercase tracking-widest">
                                      {item.w}
                                    </span>
                                  </div>
                                  <p className="text-[11px] sm:text-xs text-stone-300 font-light leading-relaxed">
                                    {item.full}
                                  </p>
                                </div>
                                <div 
                                  className="absolute top-full left-[10%] -translate-x-1/2 -mt-[25px] sm:-mt-[22px] md:-mt-[18px] w-3 h-3 bg-stone-900 border-r border-b border-stone-800 rotate-45 pointer-events-none"
                                  style={{ 
                                    left: `${idxOffset}%`,
                                    top: 'calc(100% + 22px)'
                                  }}
                                />
                              </div>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="grid grid-cols-5 gap-2 w-full">
                      {[
                        { l: 'D', w: 'Domains' },
                        { l: 'R', w: 'Ratings' },
                        { l: 'E', w: 'End-goals' },
                        { l: 'A', w: 'Affirmations' },
                        { l: 'M', w: 'Masterplan' }
                      ].map((item) => (
                        <button 
                          key={item.l}
                          onClick={() => setActiveExplanation(activeExplanation === item.w ? null : item.w)}
                          onMouseEnter={() => setActiveExplanation(item.w)}
                          onMouseLeave={() => setActiveExplanation(null)}
                          className={`py-2 md:py-3 px-1.5 rounded-xl border transition-all flex flex-col items-center gap-1 group relative ${
                            activeExplanation === item.w 
                              ? 'bg-emerald-50 border-emerald-300 ring-4 ring-emerald-500/5' 
                               : 'bg-white border-stone-200 hover:border-emerald-300 hover:shadow-sm'
                          }`}
                        >
                          <span className={`text-xl md:text-2xl font-bold ${activeExplanation === item.w ? 'text-emerald-700' : 'text-stone-900 group-hover:text-emerald-700'}`}>
                            {item.l}
                          </span>
                          <span className="text-[8px] md:text-[9px] font-extrabold tracking-wider text-stone-500 truncate max-w-full">
                            {item.w}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-1 w-full flex justify-center">
                  <button 
                    onClick={() => skipToStep(CoachingStep.CLEAR_SPACE)}
                    className="bg-emerald-600 text-white px-8 py-3.5 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/10 uppercase tracking-widest text-xs md:text-sm group cursor-pointer"
                  >
                    I'm Ready to Begin
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </motion.div>
            )}
            {/* STEP D: DOMAIN SELECTION */}
            {step === CoachingStep.DOMAIN && (
              <motion.div 
                key="discovery"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="min-h-0 flex flex-col overflow-visible md:overflow-hidden"
              >
                <div className="shrink-0 flex items-start justify-between mb-6 md:mb-8 gap-4 px-4 md:px-8 text-center md:text-left">
                  <div className="flex-1 text-center md:text-left space-y-4 md:space-y-6">
                    <div className="space-y-3 md:space-y-4 flex flex-col items-center md:items-start w-full">
                      <div className="flex items-center justify-center md:justify-start gap-2 text-emerald-600 mb-2">
                        <Sparkles size={20} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Step D: Domains</span>
                      </div>
                      <h2 className="text-2xl md:text-3xl font-light text-stone-900 tracking-tight font-serif italic text-center md:text-left">
                        Step D: Domains
                      </h2>
                      <div ref={domainInstructionsRef} className="relative w-full max-w-5xl mx-auto md:mx-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDomainInstructions(prev => !prev);
                          }}
                          className="mt-2 text-xs font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5 hover:text-emerald-700 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-100/50 hover:bg-emerald-100/50 transition-all focus:outline-none"
                        >
                          {showDomainInstructions ? "Hide details" : "Click here for details"}
                          {showDomainInstructions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        
                        <AnimatePresence>
                          {showDomainInstructions && (
                            
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden w-full"
                            >
                              <div className="mt-4 p-5 rounded-2xl bg-stone-50 border border-stone-100 text-stone-600 text-xs md:text-sm leading-relaxed space-y-3 text-left w-full max-w-6xl">
                                <p>
                                  A Domain is the area of your life and/or work where you want to see improvement (your Health, your Wealth, your Relationships, your Career or your Business, etc.).
                                </p>
                                <p>
                                  The Domain is the heart of your DREAMsheet – we recommend you build one DREAMsheet for each Domain.
                                </p>  
                                <p>
                                  To start your journey, please select just one Domain from the choices below. If you can’t see one that fits your specific situation, don’t worry…you can create your own custom Domain. Or alternatively, you can take our Domain Quiz.
                                </p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-8">
                  <div className="max-w-3xl mx-auto space-y-12">
                    {/* Domains Assessment */}
                    {!showDomainVisionResults && (
                      <section className="space-y-6">
                        <div className="flex flex-wrap gap-2 justify-center">
                          {POSSIBLE_DOMAINS.map(domain => {
                            const isCompleted = domains.some(d => d.name === domain.name && completedDomainIds.includes(d.id));
                            return (
                              <div key={domain.name} className="relative group/tooltip">
                                <button
                                  onClick={() => {
                                    if (!isCompleted) {
                                      if (selectedRoles.includes(domain.name)) {
                                        setSelectedRoles([]);
                                        setShowDomainVisionResults(false);
                                      } else {
                                        setSelectedRoles([domain.name]);
                                        setLastSelectedDomain(domain.name);
                                        setShowDomainVisionResults(false);
                                        scrollToDomainQuestionsSoon();
                                      }
                                    }
                                  }}
                                  disabled={!isCompleted && completedDomainIds.length >= 6}
                                  title={isCompleted ? "Domain Processed & Retained - Click mini 'x' to unlock/delete" : domain.description}
                                  aria-label={`${domain.name}: ${isCompleted ? "Domain Processed & Retained" : domain.description}`}
                                  className={cn(
                                    "px-4 md:px-6 py-2.5 md:py-3 rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all border shadow-sm pr-8",
                                    selectedRoles.includes(domain.name)
                                      ? "bg-emerald-600 border-emerald-600 text-white shadow-emerald-200"
                                      : isCompleted 
                                        ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                                        : "bg-white border-stone-200 text-stone-500 hover:border-emerald-400 hover:text-emerald-600"
                                  )}
                                >
                                  {domain.name}
                                  {isCompleted && <Check size={12} className="inline ml-1" />}
                                </button>
                                {isCompleted && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteCompletedDomainByName(domain.name);
                                    }}
                                    title="Unlock and remove this completed domain from your plan"
                                    className="absolute -top-1.5 -right-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 p-1 rounded-full transition-all border border-rose-200 shadow-sm z-10"
                                  >
                                    <X size={10} className="stroke-[3]" />
                                  </button>
                                )}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 p-2.5 bg-stone-900 text-white text-[10px] rounded-lg opacity-0 pointer-events-none group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100 transition-opacity z-50 text-center shadow-xl">
                                  {isCompleted ? "Domain Processed & Retained - Click mini 'x' to unlock/delete" : domain.description}
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-8 border-transparent border-b-stone-900"></div>
                                </div>
                              </div>
                            );
                          })}
                          
                          {customDiscoveryDomains.map(domain => {
                            const existingDomain = domains.find(d => d.name === domain);
                            const score = existingDomain ? (existingDomain.importance || 5) + (existingDomain.urgency || 5) - (existingDomain.currentRating || 5) : null;
                            const isCompleted = completedDomainIds.includes(existingDomain?.id || "");
                            
                            return (
                              <div key={domain} className="relative group/tooltip">
                                <button
                                  onClick={() => {
                                    if (!isCompleted) {
                                      if (selectedRoles.includes(domain)) {
                                        setSelectedRoles([]);
                                        setShowDomainVisionResults(false);
                                      } else {
                                        setSelectedRoles([domain]);
                                        setLastSelectedDomain(domain);
                                        setShowDomainVisionResults(false);
                                        scrollToDomainQuestionsSoon();
                                      }
                                    }
                                  }}
                                  disabled={!isCompleted && completedDomainIds.length >= 6}
                                  className={cn(
                                    "px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border shadow-sm flex items-center gap-3 pr-10",
                                    selectedRoles.includes(domain)
                                      ? "bg-emerald-600 border-emerald-600 text-white shadow-emerald-200"
                                      : isCompleted
                                        ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                                        : "bg-white border-stone-200 text-stone-500 hover:border-emerald-400 hover:text-emerald-600"
                                  )}
                                >
                                  {domain}
                                  {isCompleted && <Check size={12} />}
                                  {score !== null && !isCompleted && (
                                    <span className={cn(
                                      "px-2 py-0.5 rounded-full text-[8px] font-black",
                                      selectedRoles.includes(domain) ? "bg-emerald-500 text-white" : "bg-stone-100 text-stone-400"
                                    )}>
                                      PRIORITY: {score}
                                    </span>
                                  )}
                                </button>
                                {isCompleted && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteCompletedDomainByName(domain);
                                    }}
                                    title="Unlock and remove this completed domain from your plan"
                                    className="absolute -top-1.5 -right-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 p-1 rounded-full transition-all border border-rose-200 shadow-sm z-10"
                                  >
                                    <X size={10} className="stroke-[3]" />
                                  </button>
                                )}
                              </div>
                            );
                          })}

                          {showCustomDomainInput ? (
                            <div className="flex items-center gap-2">
                              <input 
                                type="text"
                                autoFocus
                                value={newCustomDomain}
                                onChange={(e) => setNewCustomDomain(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleAddCustomDomain();
                                  if (e.key === 'Escape') setShowCustomDomainInput(false);
                                }}
                                placeholder="Enter name for your Domain..."
                                className="px-4 py-2 rounded-full text-xs border border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white"
                              />
                              <button 
                                onClick={handleAddCustomDomain}
                                className="w-8 h-8 flex items-center justify-center bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition-colors shadow-sm"
                              >
                                <Check size={14} />
                              </button>
                              <button 
                                onClick={() => setShowCustomDomainInput(false)}
                                className="w-8 h-8 flex items-center justify-center bg-stone-100 text-stone-500 rounded-full hover:bg-stone-200 transition-colors"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setShowCustomDomainInput(true)}
                              className="px-6 py-3 rounded-xl text-xs font-bold transition-all border border-dashed border-stone-300 text-stone-400 hover:border-emerald-400 hover:text-emerald-600 flex items-center gap-2 bg-white/50 uppercase tracking-widest"
                            >
                              <Plus size={14} /> Add Custom
                            </button>
                          )}
                        </div>

                        {selectedRoles.length > 0 && (
                          <div className="mx-auto max-w-2xl rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4 shadow-sm">
                            <div className="flex flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
                              <p className="text-sm font-medium text-emerald-900">
                                Domain selected. Scroll down to answer the Domain Quiz questions.
                              </p>
                              <button
                                onClick={scrollToDomainQuestions}
                                className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-lg shadow-emerald-600/10 transition-all hover:bg-emerald-700 sm:w-auto"
                              >
                                Go to Domain Questions ↓
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="space-y-4 pt-4 border-t border-stone-100">
                          <p className="text-stone-500 text-xs text-center font-light leading-relaxed">Not sure where to start? Try our AI-powered domain identification quiz to find your focus…</p>
                          <div className="flex justify-center">
                            <button 
                              onClick={() => {
                                setQuizPhase('input');
                                setCurrentQuizIndex(0);
                                setShowQuiz(true);
                              }}
                              disabled={completedDomainIds.length > 0}
                              className={cn(
                                "bg-stone-900 text-white px-8 py-3 rounded-2xl font-bold text-[10px] uppercase tracking-[0.2em] flex items-center gap-3 hover:bg-emerald-600 transition-all shadow-xl shadow-stone-900/10",
                                completedDomainIds.length > 0 && "opacity-50 cursor-not-allowed grayscale"
                              )}
                            >
                              <Compass size={18} />
                              {completedDomainIds.length > 0 ? "Quiz Results Saved Above" : "Take the Domain Identification Quiz"}
                            </button>
                          </div>
                        </div>
                      </section>
                    )}

                    {/* D: Discovery Phase */}
                    {selectedRoles.length > 0 && !showDomainVisionResults && (
                      <section ref={domainQuestionsRef} className="scroll-mt-6 space-y-10 border-t border-stone-100 pt-10">
                        <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-4">
                          <p className="text-stone-600 text-sm max-w-2xl mx-auto md:mx-0 leading-relaxed">
                            DREAMsheet AI now invites you to drill down further into your chosen Domain so that it can refine your choice by creating 4 FOCUS AREAS. The questions below will help the AI work out the optimal Focus Areas for you.
                          </p>
                          <p className="text-stone-900 font-bold text-sm">
                            In respect of your chosen Domain: <span className="text-emerald-700 tracking-wide font-extrabold">{selectedRoles[0]}</span>...
                          </p>
                        </div>
                        {discoveryResponses.map((resp, idx) => (
                          <div key={idx} className="space-y-4">
                            <h3 className="text-lg font-light text-stone-800 italic">
                              {idx + 1}. {resp.question}
                            </h3>
                            
                            {idx === 3 ? (
                              <div className="flex flex-wrap gap-2 pt-2">
                                {TIME_HORIZONS.map((horizon) => (
                                  <button
                                    key={horizon}
                                    onClick={() => {
                                      const newResponses = [...discoveryResponses];
                                      newResponses[idx].answer = horizon;
                                      setDiscoveryResponses(newResponses);
                                      setTimeHorizon(horizon);
                                    }}
                                    className={cn(
                                      "px-4 py-2 rounded-full text-xs font-bold transition-all uppercase tracking-widest border",
                                      resp.answer === horizon
                                        ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                                        : "bg-white border-stone-200 text-stone-500 hover:border-emerald-200"
                                    )}
                                  >
                                    {horizon}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {idx === 4 && (
                                  <button
                                    onClick={generateDiscoveryObstacles}
                                    disabled={isGeneratingDiscoveryObstacles}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-100 transition-colors border border-emerald-100 disabled:opacity-50"
                                  >
                                    {isGeneratingDiscoveryObstacles ? (
                                      <>
                                        <div className="w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                                        Thinking...
                                      </>
                                    ) : (
                                      <>
                                        <Sparkles size={12} />
                                        Help me identify obstacles
                                      </>
                                    )}
                                  </button>
                                )}
                                <textarea
                                  value={resp.answer}
                                  onChange={(e) => {
                                    const newResponses = [...discoveryResponses];
                                    newResponses[idx].answer = e.target.value;
                                    setDiscoveryResponses(newResponses);
                                  }}
                                  placeholder={idx === 4 ? "List your obstacles or use the AI to help you..." : "Your reflection..."}
                                  className="w-full h-32 px-4 md:px-6 py-3 md:py-4 rounded-2xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white shadow-sm text-sm resize-none"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                        
                        <div className="flex justify-center flex-col items-center gap-6 pt-4">
                          <div className="flex items-center gap-4">
                            <button 
                              onClick={() => {
                                setSelectedRoles([]);
                                setShowDomainVisionResults(false);
                              }}
                              className="bg-white border border-stone-200 text-stone-600 px-8 py-5 rounded-2xl font-bold flex items-center gap-3 hover:bg-stone-50 transition-all shadow-xl uppercase tracking-widest text-sm"
                            >
                              <ChevronLeft size={20} /> Back
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  setLoading(true);
                                  await completeDiscovery();
                                } finally {
                                  setLoading(false);
                                }
                              }}
                              disabled={discoveryResponses.some((r, i) => i !== 5 && !r.answer.trim()) || isGeneratingDomainVision}
                              className="bg-emerald-600 text-white px-12 py-5 rounded-2xl font-bold flex items-center gap-3 hover:bg-emerald-700 transition-all shadow-2xl shadow-emerald-600/20 disabled:opacity-50 uppercase tracking-widest text-sm"
                            >
                              {isGeneratingDomainVision ? "Calculating Focus Areas..." : "Create My FOCUS AREAS…"}
                              <ChevronRight size={18} />
                            </button>
                          </div>
                        </div>
                      </section>
                    )}

                    {/* Vision & Focus Areas Results */}
                    {showDomainVisionResults && (
                      <section className="space-y-12 border-t border-stone-100 pt-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="space-y-8 max-w-2xl mx-auto md:mx-0">
                          <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Domain Vision</span>
                            <h2 className="text-3xl font-serif italic text-stone-900 leading-tight">Specifically expressed, Step by Step...</h2>
                          </div>
                          
                          <div className="bg-emerald-50/50 p-6 md:p-10 rounded-2xl md:rounded-[2.5rem] border border-emerald-100 relative overflow-hidden group shadow-sm">
                            <div className="absolute top-0 right-0 p-8 text-emerald-200 opacity-10 group-hover:opacity-20 transition-opacity">
                              <Sparkles size={120} />
                            </div>
                            <div className="space-y-6 relative z-10">
                               <div className="space-y-2">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/60 block">Domain Vision</span>
                                <textarea
                                  value={domains.find(d => d.id === activeDomainId)?.domainVision || ""}
                                  onChange={(e) => updateDomainVision(activeDomainId!, e.target.value)}
                                  placeholder="Write your Domain Vision here..."
                                  className="w-full bg-white/60 border border-emerald-100/50 rounded-2xl p-4 md:p-6 text-base md:text-lg font-light text-stone-800 italic focus:ring-2 focus:ring-emerald-500 hover:border-emerald-200 focus:bg-white transition-all min-h-[120px] resize-none leading-relaxed outline-none"
                                />
                              </div>
                              <div className="w-12 h-0.5 bg-emerald-200 rounded-full"></div>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/60 block">My Why</span>
                                  <button
                                    onClick={() => generateDomainWhy(activeDomainId!)}
                                    disabled={isGeneratingWhy}
                                    className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1 hover:text-emerald-700 disabled:opacity-50 transition-all cursor-pointer"
                                  >
                                    <Sparkles size={10} className={isGeneratingWhy ? "animate-spin" : ""} />
                                    {isGeneratingWhy ? "Regenerating..." : "Regenerate \"Why\""}
                                  </button>
                                </div>
                                <textarea
                                  value={domains.find(d => d.id === activeDomainId)?.why || ""}
                                  onChange={(e) => updateDomainWhy(activeDomainId!, e.target.value)}
                                  placeholder="Write your core motivation here..."
                                  className="w-full bg-white/60 border border-emerald-100/50 rounded-2xl p-4 md:p-6 text-sm text-stone-600 focus:ring-2 focus:ring-emerald-500 hover:border-emerald-200 focus:bg-white transition-all min-h-[100px] resize-none leading-relaxed outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-8 max-w-4xl mx-auto md:mx-0">
                          <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Strategic Alignment</span>
                            <h2 className="text-2xl font-serif italic text-stone-900">Your FOCUS AREAS</h2>
                            <p className="text-stone-500 text-sm italic">
                              Select up to 4. To change a selection, deselect one first. (Currently {domains.find(d => d.id === activeDomainId)?.subAreas.filter(s => s.selected !== false).length || 0}/4 selected)
                            </p>
                            <div className="flex justify-center w-full mt-2">
                              <button 
                                onClick={() => generateAlternativeSubAreas(activeDomainId!)}
                                disabled={isGeneratingAlternatives}
                                className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1 hover:text-emerald-700 disabled:opacity-50 px-4 py-2 bg-emerald-50 rounded-full border border-emerald-100 transition-all"
                              >
                                {isGeneratingAlternatives ? (
                                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="inline-flex">
                                    <Bot size={10} />
                                  </motion.div>
                                ) : <Sparkles size={10} />}
                                {isGeneratingAlternatives ? "Generating Alternatives..." : "Suggest Alternative Focus Areas"}
                              </button>
                            </div>
                            {(domains.find(d => d.id === activeDomainId)?.subAreas.length || 0) === 0 && (
                              <p className="max-w-md text-[11px] leading-relaxed text-amber-700/80">
                                AI suggestions were unavailable, so fallback focus areas are shown. You can continue or add your own.
                              </p>
                            )}
                          </div>

                          <div className="flex flex-col sm:flex-row gap-3 bg-white border border-stone-200 rounded-2xl p-3 shadow-sm">
                            <input
                              value={newFocusAreaName}
                              onChange={(e) => setNewFocusAreaName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && activeDomainId) addManualFocusArea(activeDomainId);
                              }}
                              placeholder="Add your own focus area..."
                              className="flex-1 px-4 py-3 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            />
                            <button
                              onClick={() => activeDomainId && addManualFocusArea(activeDomainId)}
                              disabled={!newFocusAreaName.trim()}
                              className="px-5 py-3 rounded-xl bg-stone-900 text-white text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-50 transition-all"
                            >
                              <Plus size={14} />
                              Add Focus Area
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {domains.find(d => d.id === activeDomainId)?.subAreas.map((subArea, sIdx) => (
                              <div 
                                key={subArea.id} 
                                onClick={() => toggleSubAreaSelection(activeDomainId, subArea.id)}
                                className={`relative min-h-[132px] p-6 md:p-8 rounded-3xl border transition-all cursor-pointer group flex flex-col items-start gap-4 ${
                                  subArea.selected !== false 
                                    ? "bg-white border-emerald-300 shadow-xl shadow-emerald-600/5 ring-1 ring-emerald-500/10" 
                                    : "bg-stone-50 border-stone-100 shadow-sm opacity-40 hover:opacity-80"
                                }`}
                              >
                                {subArea.selected === false && (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteSubArea(activeDomainId!, subArea.id);
                                    }}
                                    className="absolute top-4 right-4 text-stone-300 hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                                <div className="flex items-center gap-4 w-full">
                                  <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                                    subArea.selected !== false ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/20" : "bg-white border-stone-200 text-stone-300"
                                  }`}>
                                    {subArea.selected !== false ? <Check size={14} strokeWidth={4} /> : <span className="text-xs font-bold">{sIdx + 1}</span>}
                                  </div>
                                  <textarea 
                                    value={subArea.name}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => updateSubAreaName(activeDomainId, subArea.id, e.target.value)}
                                    rows={2}
                                    className={`flex-1 min-h-[3rem] bg-transparent border-none p-0 text-base md:text-lg font-light text-stone-900 focus:ring-0 cursor-text transition-colors resize-none overflow-hidden whitespace-normal leading-snug ${
                                      subArea.selected !== false ? "opacity-100" : "opacity-50"
                                    }`}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex justify-center pt-12 pb-8">
                          <div className="flex items-center gap-4">
                            <button 
                              onClick={() => {
                                setShowDomainVisionResults(false);
                              }}
                              className="bg-white border border-stone-200 text-stone-600 px-8 py-5 rounded-2xl font-bold flex items-center gap-3 hover:bg-stone-50 transition-all shadow-xl uppercase tracking-widest text-sm"
                            >
                              <ChevronLeft size={20} /> Back
                            </button>
                            <button
                              onClick={() => finalizeSubAreas()}
                              disabled={!domains.find(d => d.id === activeDomainId)?.subAreas.some(s => s.selected !== false)}
                              className="bg-emerald-600 text-white px-12 py-5 rounded-2xl font-bold flex items-center gap-3 hover:bg-emerald-700 transition-all shadow-2xl shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest text-sm group"
                            >
                              Continue to R: Ratings
                              <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                          </div>
                        </div>
                      </section>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {step === CoachingStep.RATINGS && (
              <motion.div 
                key="domains"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="min-h-0 flex flex-col gap-4 md:gap-6 overflow-y-auto"
              >
                <div className="shrink-0 flex flex-col md:flex-row items-center md:items-end justify-between gap-4 text-center md:text-left">
                  <div className="max-w-2xl flex flex-col items-center md:items-start w-full">
                    <div className="flex items-center justify-center md:justify-start gap-2 text-emerald-600 mb-2">
                       <Target size={16} />
                       <span className="text-[10px] font-bold uppercase tracking-widest">Step R: Ratings</span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-light text-stone-900 mb-2 text-center md:text-left">Rate your current focus.</h2>
                    <p className="text-stone-600 text-sm text-center md:text-left">
                      Set your current state and target for your <b>{domains.find(d => d.id === activeDomainId)?.name}</b> domains.
                    </p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-8">
                  {activeDomainId && (
                        <ActiveDomainHeader 
                          domainName={domains.find(d => d.id === activeDomainId)?.name || ""} 
                          focusAreas={domains.find(d => d.id === activeDomainId)?.subAreas.map(s => s.name).filter(Boolean) || []} 
                        />
                  )}
                  {activeDomainId && domains.find(d => d.id === activeDomainId)?.subAreas.length === 0 && (
                    <div className="my-3">
                      <button
                        onClick={() => generateSubAreas(true)}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 transition-colors"
                      >
                        Regenerate Focus Areas
                      </button>
                    </div>
                  )}
                  
                  {activeDomainId && domains.filter(d => d.id === activeDomainId).map(d => (
                    <div key={d.id} className="w-full max-w-6xl mx-auto py-4 space-y-8">
                      {/* Grid for Sliders on the left and Eisenhower Matrix on the right */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                        {/* Left Column: Sliders */}
                        <div className="space-y-8">
                          {/* Current Rating & Target Slider Section */}
                          <div className="space-y-4">
                            <div className="flex items-center gap-2">
                              <Activity size={14} className="text-emerald-500" />
                              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Current Rating & Target</label>
                            </div>
                            
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 bg-stone-50/50 p-4 md:p-5 rounded-2xl border border-stone-100">
                              <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                  <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Current Rating (1-10)</label>
                                  <span className="text-lg font-light text-emerald-600">{d.currentRating || 5}</span>
                                </div>
                                <input 
                                  type="range" min="1" max="10" 
                                  value={d.currentRating || 5}
                                  onChange={(e) => updateDomainRating(d.id, 'currentRating', parseInt(e.target.value))}
                                  className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                                />
                              </div>

                              <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                  <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Target Rating (1-10)</label>
                                  <span className="text-lg font-light text-emerald-600">{d.futureRating || 8}</span>
                                </div>
                                <input 
                                  type="range" min="1" max="10" 
                                  value={d.futureRating || 8}
                                  onChange={(e) => updateDomainRating(d.id, 'futureRating', parseInt(e.target.value))}
                                  className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Urgency & Importance Slider Section */}
                          <div className="space-y-4">
                            <div className="flex items-center gap-2">
                              <Clock size={14} className="text-emerald-500" />
                              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Urgency & Importance</label>
                            </div>
                            
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 bg-emerald-50/30 p-4 md:p-5 rounded-2xl border border-emerald-100/50">
                              <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                  <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Urgency (1-10)</label>
                                  <span className="text-lg font-light text-emerald-600">{d.urgency || 5}</span>
                                </div>
                                <input 
                                  type="range" min="1" max="10" 
                                  value={d.urgency || 5}
                                  onChange={(e) => updateDomainRating(d.id, 'urgency', parseInt(e.target.value))}
                                  className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                                />
                              </div>

                              <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                  <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Importance (1-10)</label>
                                  <span className="text-lg font-light text-emerald-600">{d.importance || 5}</span>
                                </div>
                                <input 
                                  type="range" min="1" max="10" 
                                  value={d.importance || 5}
                                  onChange={(e) => updateDomainRating(d.id, 'importance', parseInt(e.target.value))}
                                  className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Right Column: Eisenhower Priority Matrix */}
                        <div className="space-y-4 lg:mt-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Compass size={14} className="text-emerald-500" />
                              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Eisenhower Priority Matrix</label>
                            </div>
                            {d.urgency !== undefined && d.importance !== undefined && (
                              <span className="text-[9px] font-bold text-stone-400 bg-stone-100 px-2 py-0.5 rounded uppercase tracking-wider">
                                Quadrant: {d.importance > 5 ? (d.urgency > 5 ? 'Q1 (Do First)' : 'Q2 (Schedule)') : (d.urgency > 5 ? 'Q3 (Delegate)' : 'Q4 (Eliminate)')}
                              </span>
                            )}
                          </div>

                          <div className="relative w-full max-w-md mx-auto aspect-square bg-stone-50 border border-stone-200 rounded-3xl p-6 shadow-sm overflow-hidden select-none">
                            {/* Crosshair Dividers */}
                            <div className="absolute left-1/2 top-4 bottom-4 border-l border-dashed border-stone-300 -translate-x-1/2"></div>
                            <div className="absolute top-1/2 left-4 right-4 border-t border-dashed border-stone-300 -translate-y-1/2"></div>

                            {/* Outer Axis Labels */}
                            {/* Y-Axis Label (Importance) */}
                            <div className="absolute left-2 top-1/2 -translate-y-1/2 -rotate-90 origin-left text-[9px] font-bold text-stone-400 uppercase tracking-widest pointer-events-none">
                              Importance (Y)
                            </div>
                            {/* X-Axis Label (Urgency) */}
                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-bold text-stone-400 uppercase tracking-widest pointer-events-none">
                              Urgency (X)
                            </div>

                            {/* Grid Quadrants */}
                            <div className="w-full h-full grid grid-cols-2 grid-rows-2 relative">
                              {/* Q2: Important / Not Urgent (Schedule) - Top Left */}
                              <div className="p-3 flex flex-col justify-start items-start border-r border-b border-transparent">
                                <span className="text-[9px] font-black tracking-widest text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100/50 uppercase leading-none">
                                  Q2 · Schedule
                                </span>
                                <span className="text-[8px] text-stone-400 mt-1 font-medium italic hidden sm:inline">Important, Not Urgent</span>
                              </div>

                              {/* Q1: Important / Urgent (Do First) - Top Right */}
                              <div className="p-3 flex flex-col justify-start items-end text-right border-l border-b border-transparent">
                                <span className="text-[9px] font-black tracking-widest text-red-600 bg-red-50 px-1.5 py-0.5 rounded-md border border-red-100/50 uppercase leading-none">
                                  Q1 · Do First
                                </span>
                                <span className="text-[8px] text-stone-400 mt-1 font-medium italic hidden sm:inline">Important & Urgent</span>
                              </div>

                              {/* Q4: Not Important / Not Urgent (Eliminate) - Bottom Left */}
                              <div className="p-3 flex flex-col justify-end items-start border-r border-t border-transparent">
                                <span className="text-[8px] text-stone-400 mb-1 font-medium italic hidden sm:inline">Not Important & Urgent</span>
                                <span className="text-[9px] font-black tracking-widest text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded-md border border-stone-200/50 uppercase leading-none">
                                  Q4 · Eliminate
                                </span>
                              </div>

                              {/* Q3: Not Important / Urgent (Delegate) - Bottom Right */}
                              <div className="p-3 flex flex-col justify-end items-end text-right border-l border-t border-transparent">
                                <span className="text-[8px] text-stone-400 mb-1 font-medium italic hidden sm:inline">Urgent, Not Important</span>
                                <span className="text-[9px] font-black tracking-widest text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-100/50 uppercase leading-none">
                                  Q3 · Delegate
                                </span>
                              </div>

                              {/* Plotted Dot representing the domain */}
                              {(() => {
                                const hasPlotted = d.urgency !== undefined || d.importance !== undefined;
                                if (!hasPlotted) return null;

                                const uVal = d.urgency ?? 5;
                                const iVal = d.importance ?? 5;

                                const leftPercent = 10 + ((uVal - 1) / 9) * 80;
                                const topPercent = 90 - ((iVal - 1) / 9) * 80;

                                return (
                                  <motion.div 
                                    layoutId={`matrix-dot-${d.id}`}
                                    className="absolute origin-center -translate-x-1/2 -translate-y-1/2 z-20"
                                    style={{ left: `${leftPercent}%`, top: `${topPercent}%` }}
                                    transition={{ type: "spring", stiffness: 100, damping: 15 }}
                                  >
                                    {/* Pulsing Ripple */}
                                    <span className="absolute inline-flex h-8 w-8 -left-2 -top-2 rounded-full bg-emerald-400 opacity-20 animate-ping" />
                                    
                                    {/* Main Glowing Dot */}
                                    <div className="relative h-4 w-4 rounded-full bg-emerald-600 border-2 border-white shadow-md flex items-center justify-center">
                                      <div className="h-1.5 w-1.5 rounded-full bg-white"></div>
                                    </div>

                                    {/* Plotted Label Popup */}
                                    <div className="absolute bg-stone-900 text-white text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-lg shadow-lg -translate-x-1/2 -translate-y-9 top-0 left-2 whitespace-nowrap z-30 select-none border border-stone-850">
                                      {d.name} ({uVal}, {iVal})
                                    </div>
                                  </motion.div>
                                );
                              })()}
                            </div>

                            {/* Placeholder/Instructions overlay when blank on arrival */}
                            {d.urgency === undefined && d.importance === undefined && (
                              <div className="absolute inset-0 bg-stone-50/90 backdrop-blur-[1px] flex flex-col items-center justify-center p-6 text-center">
                                <Compass size={28} className="text-stone-300 mb-2 animate-bounce" />
                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Matrix Map Ready</h4>
                                <p className="text-[11px] text-stone-400 font-medium max-w-[240px] leading-normal">
                                  Shift the Urgency and Importance sliders above to plot this domain on the Eisenhower Matrix.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Navigation Buttons */}
                      <div className="pt-8 flex flex-col items-center gap-6">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
                          <button 
                            onClick={() => skipToStep(CoachingStep.DOMAIN)}
                            className="bg-white border border-stone-200 text-stone-600 px-5 sm:px-8 py-3.5 sm:py-5 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-stone-50 transition-all shadow-xl uppercase tracking-widest text-xs sm:text-sm"
                          >
                            <ChevronLeft size={20} /> Back
                          </button>
                          <button 
                            onClick={() => skipToStep(CoachingStep.END_GOALS)}
                            className="bg-emerald-600 text-white px-6 sm:px-12 py-3.5 sm:py-5 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all shadow-2xl shadow-emerald-600/20 uppercase tracking-widest text-xs sm:text-sm"
                          >
                            Continue to E: End-goals <ChevronRight size={20} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </motion.div>
            )}

            {step === CoachingStep.END_GOALS && (
              <motion.div 
                key="end-goals"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="min-h-full flex flex-col gap-6 overflow-y-auto custom-scrollbar"
              >
                <div className="flex flex-col md:flex-row items-center md:items-end justify-between gap-4 shrink-0 text-center md:text-left">
                  <div className="max-w-2xl flex flex-col items-center md:items-start w-full">
                    <div className="flex items-center justify-center md:justify-start gap-2 text-emerald-600 mb-2">
                       <Target size={16} />
                       <span className="text-[10px] font-bold uppercase tracking-widest">Step E: End-goals</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl md:text-3xl font-light text-stone-900 mb-2 text-center md:text-left">Establish your End-goals.</h2>
                    <p className="text-stone-600 text-sm text-center md:text-left">
                      Create an End-goal for each of your sub-domains in <b>{domains.find(d => d.id === activeDomainId)?.name}</b>.
                    </p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-0 md:pr-2 space-y-6 md:space-y-8 custom-scrollbar pb-8">
                  {activeDomainId && (
                    <div className="max-w-3xl mx-auto">
                      <ActiveDomainHeader 
                        domainName={domains.find(d => d.id === activeDomainId)?.name || ""} 
                        focusAreas={domains.find(d => d.id === activeDomainId)?.subAreas.map(s => s.name).filter(Boolean) || []} 
                      />
                    </div>
                  )}
                  {domains.filter(d => d.id === activeDomainId).map(d => (
                    <div key={d.id} className="space-y-6 max-w-3xl mx-auto">
                      {isGeneratingSupportingGoals && (
                        <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl px-4 py-3 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="inline-flex">
                            <Bot size={14} />
                          </motion.div>
                          Generating missing End-goals...
                        </div>
                      )}
                      {d.subAreas.map((sub, idx) => (
                        <div key={sub.id} className="bg-white p-4 sm:p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-sm border border-stone-200 space-y-5 md:space-y-6">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-emerald-600 tracking-wider shrink-0">Focus Area #{idx + 1}</span>
                              <span className="text-sm font-bold text-stone-800 block break-words">{sub.name}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <button 
                                onClick={() => generateEndGoalsForSubAreas(d.id, sub.id)}
                                disabled={isGeneratingSupportingGoals}
                                className="flex items-center justify-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 transition-colors border border-emerald-100 disabled:opacity-50 cursor-pointer shadow-sm text-[9px] sm:text-[10px] font-bold uppercase tracking-widest"
                                title="Suggest alternative end-goal"
                              >
                                {isGeneratingSupportingGoals ? (
                                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="inline-flex">
                                    <Bot size={12} />
                                  </motion.div>
                                ) : <Sparkles size={12} />}
                                <span className="hidden sm:inline">Suggest Alternative End-goals</span>
                                <span className="sm:hidden">Regenerate End-goal</span>
                              </button>
                              <button 
                                onClick={() => deleteSubArea(d.id, sub.id)}
                                className="text-stone-200 hover:text-red-500 transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block break-words">End-goal</label>
                            <textarea 
                              value={isPlaceholderEndGoal(sub.goal) ? "" : (sub.goal || "")}
                              onChange={(e) => setDomains(domains.map(dom => {
                                if (dom.id !== d.id) return dom;
                                return {
                                  ...dom,
                                  subAreas: dom.subAreas.map(s => s.id === sub.id ? { ...s, goal: e.target.value } : s)
                                };
                              }))}
                              placeholder={`Write a clear end-goal for ${sub.name || "this focus area"}...`}
                              className="w-full bg-stone-50 border border-stone-100 rounded-2xl p-4 md:p-6 text-sm sm:text-base md:text-lg font-light italic focus:ring-2 focus:ring-emerald-500 transition-all min-h-[120px] resize-none leading-relaxed"
                            />
                            {(!sub.goal?.trim() || isPlaceholderEndGoal(sub.goal)) && (
                              <p className="text-xs text-amber-700/80">
                                Add an end-goal before continuing to Affirmations.
                              </p>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                            <div className="space-y-4">
                              <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Start Date</label>
                              <div className="relative group">
                                <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none" />
                                <input 
                                  type="date"
                                  value={sub.startDate || ""}
                                  onChange={(e) => updateSubAreaDates(d.id, sub.id, 'startDate', e.target.value)}
                                  className="w-full bg-stone-50 border border-stone-100 rounded-xl p-4 pl-12 text-sm focus:ring-2 focus:ring-emerald-500 hover:border-stone-200 transition-all font-medium outline-none cursor-pointer"
                                />
                              </div>
                            </div>
                            
                            <div className="space-y-4">
                              <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Finish Date (Target)</label>
                              <div className="relative group">
                                <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none" />
                                <input 
                                  type="date"
                                  value={sub.finishDate || ""}
                                  onChange={(e) => updateSubAreaDates(d.id, sub.id, 'finishDate', e.target.value)}
                                  disabled={!!sub.isOngoing}
                                  className={cn(
                                    "w-full bg-stone-50 border border-stone-100 rounded-xl p-4 pl-12 text-sm focus:ring-2 focus:ring-emerald-500 hover:border-stone-200 transition-all font-medium outline-none cursor-pointer",
                                    sub.isOngoing ? 'opacity-60 cursor-not-allowed' : ''
                                  )}
                                />
                                <div className="mt-2 flex items-center gap-3">
                                  <label className="inline-flex items-center gap-2 text-sm text-stone-600">
                                    <input
                                      type="checkbox"
                                      checked={!!sub.isOngoing}
                                      onChange={(e) => setDomains(domains.map(dom => {
                                        if (dom.id !== d.id) return dom;
                                        return {
                                          ...dom,
                                          subAreas: dom.subAreas.map(s => s.id === sub.id ? { ...s, isOngoing: e.target.checked, finishDate: e.target.checked ? '' : s.finishDate } : s)
                                        };
                                      }))}
                                      className="w-4 h-4"
                                    />
                                    <span>Ongoing (no end date)</span>
                                  </label>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}

                      {d.subAreas.length < 3 && (
                        <button 
                          onClick={() => setDomains(domains.map(dom => {
                            if (dom.id !== d.id) return dom;
                            return {
                              ...dom,
                              subAreas: [...dom.subAreas, { 
                                id: Math.random().toString(36).substr(2, 9), 
                                name: '',
                                currentRating: 5,
                                futureRating: 8,
                                gap: 3
                              }]
                            };
                          }))}
                          className="w-full py-3 md:py-4 border-2 border-dashed border-stone-200 rounded-2xl text-stone-400 hover:border-emerald-300 hover:text-emerald-600 transition-all flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-widest"
                        >
                          <Plus size={16} /> Add {d.subAreas.length === 0 ? 'a' : 'another'} End-goal
                        </button>
                      )}

                      {/* Domain-level end-goal retained in data, hidden from the main UI because per-focus-area End-goals drive this workflow. TODO(David): confirm whether domainGoal should be surfaced in a future summary view. */}
                      <div className="hidden space-y-4 pt-8 border-t border-stone-200 mt-8">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Trophy size={14} className="text-emerald-500" />
                            <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Domains End-goals</label>
                          </div>
                          <button 
                            onClick={() => generateDomainGoal(d.id)}
                            disabled={isGeneratingGoal}
                            className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1 hover:text-emerald-700 disabled:opacity-50"
                          >
                            {isGeneratingGoal ? (
                              <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="inline-flex">
                                <Bot size={10} />
                              </motion.div>
                            ) : <Sparkles size={10} />}
                            {isGeneratingGoal ? "Suggesting..." : "Suggest End-goals"}
                          </button>
                        </div>
                        <textarea 
                          value={d.domainGoal || ""}
                          onChange={(e) => setDomains(domains.map(dom => dom.id === d.id ? { ...dom, domainGoal: e.target.value } : dom))}
                          placeholder="What is the ultimate specific outcome you want to achieve in these domains?"
                          className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 md:p-6 text-base md:text-lg font-light focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all min-h-[120px] resize-none leading-relaxed italic"
                        />
                      </div>

                      <div className="flex justify-center pt-8">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
                          <button 
                            onClick={() => skipToStep(CoachingStep.RATINGS)}
                            className="bg-white border border-stone-200 text-stone-600 px-5 sm:px-8 py-3.5 sm:py-5 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-stone-50 transition-all shadow-xl uppercase tracking-widest text-xs sm:text-sm"
                          >
                            <ChevronLeft size={20} /> Back
                          </button>
                          <button 
                            onClick={() => skipToStep(CoachingStep.AFFIRMATIONS)}
                            disabled={d.subAreas.length === 0 || d.subAreas.some(s => !s.goal?.trim() || isPlaceholderEndGoal(s.goal))}
                            className="bg-emerald-600 text-white px-12 py-5 rounded-2xl font-bold flex items-center gap-3 hover:bg-emerald-700 transition-all shadow-2xl shadow-emerald-600/20 uppercase tracking-widest text-sm"
                          >
                            CONTINUE TO A: AFFIRMATIONS <Sparkles size={20} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {step === CoachingStep.AFFIRMATIONS && (
              <motion.div 
                key="affirmations"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="min-h-0 flex flex-col gap-4 md:gap-8 overflow-visible md:overflow-hidden"
              >
                <div className="flex flex-col md:flex-row items-center md:items-end justify-between gap-4 shrink-0 text-center md:text-left">
                  <div className="max-w-2xl flex flex-col items-center md:items-start w-full">
                    <div className="flex items-center justify-center md:justify-start gap-2 text-emerald-600 mb-2">
                       <Sparkles size={18} />
                       <span className="text-[10px] font-bold uppercase tracking-widest">Step A: Affirmations</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl md:text-3xl font-light text-stone-900 mb-1 text-center md:text-left">Empower your vision.</h2>
                    <p className="text-stone-600 text-sm text-center md:text-left">
                      Create or refine a powerful affirmation for each of your End-goals in <b>{domains.find(d => d.id === activeDomainId)?.name}</b>.
                    </p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-0 md:pr-2 space-y-6 md:space-y-8 custom-scrollbar pb-8">
                  {activeDomainId && (
                    <div className="max-w-4xl mx-auto">
                      <ActiveDomainHeader 
                        domainName={domains.find(d => d.id === activeDomainId)?.name || ""} 
                        focusAreas={domains.find(d => d.id === activeDomainId)?.subAreas.map(s => s.name).filter(Boolean) || []} 
                      />
                    </div>
                  )}
                  {domains.filter(d => d.id === activeDomainId).map(domain => (
                    <div key={domain.id} className="max-w-4xl w-full mx-auto space-y-8">
                      {domain.subAreas.map((sub, idx) => (
                        <div key={sub.id} className="bg-white p-4 sm:p-6 md:p-8 rounded-3xl border border-stone-200 shadow-sm space-y-4">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 pb-3 border-b border-stone-100">
                            <span className="text-[11px] font-black text-emerald-600 uppercase tracking-widest shrink-0">Goal #{idx + 1}:</span>
                            <span className="text-sm font-semibold text-stone-700 leading-normal break-words">{sub.goal || sub.name}</span>
                          </div>
                          
                          <div className="space-y-3 pt-2">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                              <label className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider block">Empowering Affirmation</label>
                              <button 
                                onClick={() => generateGoalAffirmations(domain.id, sub.id)}
                                disabled={isGeneratingGoalAffirmations}
                                className="flex w-full sm:w-auto items-center justify-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 transition-colors border border-emerald-100 disabled:opacity-50 cursor-pointer shadow-sm text-[9px] sm:text-[10px] font-bold uppercase tracking-widest"
                                title="Suggest alternative affirmations"
                              >
                                {isGeneratingGoalAffirmations ? (
                                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="inline-flex">
                                    <Bot size={12} />
                                  </motion.div>
                                ) : <Sparkles size={12} />}
                                <span>Suggest Alternative Affirmations</span>
                              </button>
                            </div>
                            <textarea 
                              value={sub.affirmation || ""}
                              onChange={(e) => setDomains(domains.map(d => {
                                if (d.id !== domain.id) return d;
                                return {
                                  ...d,
                                  subAreas: d.subAreas.map(s => s.id === sub.id ? { ...s, affirmation: e.target.value } : s)
                                };
                              }))}
                              placeholder="Write a supportive affirmation for this specific goal..."
                              className="w-full bg-stone-50 border border-stone-100 rounded-2xl p-4 md:p-6 text-sm sm:text-base md:text-lg font-light italic focus:ring-2 focus:ring-emerald-500 transition-all min-h-[100px] resize-none"
                            />
                          </div>
                        </div>
                      ))}

                      <div className="pt-8 flex flex-col items-center gap-6">
                        <div className="flex items-center gap-4">
                          <button 
                            onClick={() => skipToStep(CoachingStep.END_GOALS)}
                            className="bg-white border border-stone-200 text-stone-600 px-8 py-5 rounded-2xl font-bold flex items-center gap-3 hover:bg-stone-50 transition-all shadow-xl uppercase tracking-widest text-sm"
                          >
                            <ChevronLeft size={20} /> Back
                          </button>
                          <button 
                            onClick={() => {
                              const currentIndex = domains.findIndex(dom => dom.id === activeDomainId);
                              if (currentIndex < domains.length - 1) {
                                setActiveDomainId(domains[currentIndex + 1].id);
                                skipToStep(CoachingStep.RATINGS);
                              } else {
                                skipToStep(CoachingStep.MASTERPLAN);
                              }
                            }}
                            disabled={domain.subAreas.some(s => !s.affirmation?.trim())}
                            className="bg-emerald-600 text-white px-6 sm:px-12 py-3.5 sm:py-5 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all shadow-2xl shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest text-xs sm:text-sm"
                          >
                            {domains.findIndex(dom => dom.id === activeDomainId) < domains.length - 1 
                              ? <>Next Domain: {domains[domains.findIndex(dom => dom.id === activeDomainId) + 1].name} <ChevronRight size={20} /></>
                              : <>Continue to M: Masterplan <LayoutDashboard size={20} /></>}
                          </button>
                        </div>

                        <button 
                          onClick={() => skipToStep(CoachingStep.MASTERPLAN)}
                          className="text-stone-400 hover:text-emerald-600 transition-colors text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2"
                        >
                          Skip straight to Masterplan <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP M: MASTERPLAN */}
            {step === CoachingStep.MASTERPLAN && (
              <motion.div 
                key="final"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full flex flex-col bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden"
              >
                <div ref={planRef} className="w-full flex flex-col bg-white">
                  <div className="bg-stone-900 p-6 md:p-8 text-white flex flex-col md:flex-row justify-between items-center md:items-center shrink-0 gap-4">
                    <div className="flex flex-col items-center md:items-start text-center md:text-left">
                      <div className="flex items-center justify-center md:justify-start gap-2 text-emerald-400 mb-2">
                        <Target size={20} />
                        <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.3em] text-center md:text-left">Official DREAMsheet AI Masterplan</span>
                      </div>
                      <h2 className="text-2xl md:text-3xl font-light tracking-tight text-center md:text-left">DREAMSheet AI Masterplan</h2>
                      <p className="text-stone-400 text-[10px] md:text-xs mt-1 font-medium italic text-center md:text-left">The only way to predict the future is to create it.</p>
                    </div>
                    <div className="flex flex-row justify-center md:justify-end gap-4 md:gap-8 text-[9px] md:text-[10px] w-full md:w-auto">
                      <div className="text-center md:text-right">
                        <p className="text-stone-500 font-bold uppercase tracking-widest mb-1">Coachee</p>
                        <p className="text-sm font-medium">{clientName || "Guest Coachee"}</p>
                      </div>
                      <div className="text-center md:text-right">
                        <p className="text-stone-500 font-bold uppercase tracking-widest mb-1">Coach</p>
                        <p className="text-sm font-medium">{coachName || "AI Coach"}</p>
                      </div>
                      <div className="text-center md:text-right">
                        <p className="text-stone-500 font-bold uppercase tracking-widest mb-1">Date Issued</p>
                        <p className="text-sm font-medium">{new Date().toLocaleDateString('en-GB')}</p>
                      </div>
                    </div>
                  </div>
                  {isPreparingTacticalRoadmap && (
                    <div className="bg-emerald-50 border-b border-emerald-100 px-6 py-3 text-center text-xs font-bold uppercase tracking-widest text-emerald-700">
                      Preparing tactical roadmap...
                    </div>
                  )}

                  <div className="p-4 md:p-8 space-y-8 md:space-y-12 bg-white">
                    <div className="grid grid-cols-1 gap-8">
                      <div className="bg-emerald-600 text-white rounded-2xl p-5 md:p-8 shadow-xl flex flex-col justify-center">
                        <h3 className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-emerald-100 mb-3">Masterplan Summary</h3>
                        <div className="text-3xl md:text-4xl font-light mb-5">
                          {currentSessionFocusAreaNames.length} <span className="text-lg md:text-xl">Focus {currentSessionFocusAreaNames.length === 1 ? "Area" : "Areas"}</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs md:text-sm leading-relaxed">
                          <div>
                            <p className="text-emerald-100/80 font-bold uppercase tracking-widest text-[9px] mb-1">
                              {currentSessionDomainNames.length === 1 ? "Selected Domain" : "Selected Domains"}
                            </p>
                            <p className="text-white font-medium">{currentSessionDomainNames.join(", ") || "No domain selected"}</p>
                          </div>
                          <div>
                            <p className="text-emerald-100/80 font-bold uppercase tracking-widest text-[9px] mb-1">Focus Area Names</p>
                            <p className="text-white font-medium">{currentSessionFocusAreaNames.join(", ") || "No focus areas selected"}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {currentSessionDomains.map(domain => (
                      <div key={domain.id} className="space-y-6 md:space-y-8 bg-stone-50/50 p-5 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-stone-100">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 border-b border-stone-200 pb-6 md:pb-8">
                          <div className="space-y-3 md:space-y-4 flex-1">
                            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
                              <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-stone-900">{domain.name}</h3>
                              <div className="hidden md:block h-6 w-px bg-stone-300"></div>
                              <div className="flex items-center gap-2 text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                                <span>{domain.currentRating} → {domain.futureRating}</span>
                                <span className="bg-emerald-100 px-2 py-0.5 rounded text-emerald-800">+{(domain.futureRating || 0) - (domain.currentRating || 0)}</span>
                              </div>
                            </div>
                            
                            <div className="space-y-3 md:space-y-4 bg-white p-4 md:p-6 rounded-2xl border border-stone-100 shadow-sm">
                              <div>
                                <label className="text-[8px] md:text-[9px] font-bold uppercase tracking-[0.2em] text-stone-400 block mb-1 md:mb-2">Domain Vision</label>
                                <p className="text-stone-800 font-medium italic text-base md:text-lg leading-relaxed">
                                  "{domain.domainVision}"
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-6">
                          {domain.subAreas.map((sub, sIdx) => {
                            const isExpanded = expandedSubAreas[sub.id] ?? true;
                            
                            return (
                              <div key={sub.id} className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden hover:shadow-md transition-all group">
                                <div 
                                  onClick={() => toggleSubAreaExpansion(sub.id)}
                                  className="p-5 md:p-8 cursor-pointer flex items-start justify-between bg-white hover:bg-stone-50 transition-colors"
                                >
                                  <div className="flex-1 flex gap-4 md:gap-6">
                                    <div className="w-10 h-10 md:w-12 md:h-12 bg-emerald-50 rounded-xl md:rounded-2xl flex items-center justify-center text-emerald-600 font-bold shrink-0 text-sm md:text-base">
                                      {sIdx + 1}
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[9px] md:text-[10px] font-bold tracking-widest text-stone-400 block break-words uppercase">End-goal focus area: <span className="normal-case font-medium text-stone-500">{sub.name}</span></label>
                                      <h4 className="text-lg md:text-xl font-serif italic text-stone-900 leading-tight">{sub.goal || sub.name}</h4>
                                      <div className="flex flex-wrap items-center gap-3 md:gap-4 pt-2">
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-stone-100 rounded-xl border border-stone-200">
                                          <Calendar size={12} className="text-emerald-500 shrink-0" />
                                          <div className="flex items-center gap-2">
                                            <input 
                                              type="date"
                                              value={sub.startDate || ""}
                                              onChange={(e) => updateSubAreaDates(domain.id, sub.id, 'startDate', e.target.value)}
                                              className="bg-transparent border-none p-0 text-[10px] font-bold text-stone-600 focus:ring-0 w-28 cursor-pointer outline-none"
                                            />
                                            <span className="text-stone-400 text-[10px]">→</span>
                                            <input 
                                              type="date"
                                              value={sub.finishDate || ""}
                                              onChange={(e) => updateSubAreaDates(domain.id, sub.id, 'finishDate', e.target.value)}
                                              disabled={!!sub.isOngoing}
                                              className={cn(
                                                "bg-transparent border-none p-0 text-[10px] font-bold text-stone-600 focus:ring-0 w-28 cursor-pointer outline-none",
                                                sub.isOngoing ? "opacity-60 cursor-not-allowed" : ""
                                              )}
                                            />
                                          </div>
                                        </div>
                                        <label className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 uppercase tracking-widest">
                                          <input
                                            type="checkbox"
                                            checked={!!sub.isOngoing}
                                            onChange={(e) => setDomains(domains.map(dom => {
                                              if (dom.id !== domain.id) return dom;
                                              return {
                                                ...dom,
                                                subAreas: dom.subAreas.map(s => s.id === sub.id ? { ...s, isOngoing: e.target.checked, finishDate: e.target.checked ? "" : s.finishDate } : s)
                                              };
                                            }))}
                                            className="w-3.5 h-3.5"
                                          />
                                          Ongoing
                                        </label>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <div className="text-right hidden sm:block">
                                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{(sub.actionSteps?.length || 0)} Steps</p>
                                      <p className="text-[9px] text-stone-400 uppercase tracking-widest">In Sequence</p>
                                    </div>
                                    {isExpanded ? <ChevronUp size={20} className="text-stone-300" /> : <ChevronDown size={20} className="text-stone-300" />}
                                  </div>
                                </div>

                                <motion.div 
                                  initial={false}
                                  animate={{ 
                                    height: isExpanded ? 'auto' : 0,
                                    opacity: isExpanded ? 1 : 0
                                  }}
                                  className="overflow-hidden print:!h-auto print:!opacity-100"
                                >
                                  <div className="px-4 md:px-8 pb-6 md:pb-8 space-y-6 md:space-y-8">
                                    <div className="p-4 md:p-6 bg-emerald-50/50 rounded-2xl border border-emerald-100/50">
                                      <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-600 block mb-2 md:mb-3">Empowerment Statement</label>
                                      <div className="hidden export-only text-stone-800 font-serif italic text-base md:text-lg leading-relaxed whitespace-pre-wrap">
                                        {sub.affirmation}
                                      </div>
                                      <textarea 
                                        value={sub.affirmation || ""}
                                        onChange={(e) => setDomains(domains.map(dom => {
                                          if (dom.id !== domain.id) return dom;
                                          return {
                                            ...dom,
                                            subAreas: dom.subAreas.map(s => s.id === sub.id ? { ...s, affirmation: e.target.value } : s)
                                          };
                                        }))}
                                        className="w-full bg-transparent border-none p-0 text-stone-800 font-serif italic text-base md:text-lg leading-relaxed focus:ring-0 resize-none"
                                        rows={2}
                                      />
                                    </div>

                                    <div className="space-y-6">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <div className="w-6 h-6 bg-stone-900 rounded-lg flex items-center justify-center text-white text-[10px] font-bold">S</div>
                                          <h5 className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500">Specific Action Steps</h5>
                                        </div>
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            generateActionStepsForSubArea(domain.id, sub.id);
                                          }}
                                          disabled={isGeneratingActionSteps}
                                          className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1.5 hover:text-emerald-700 disabled:opacity-50 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-100 no-export"
                                        >
                                          {isGeneratingActionSteps ? (
                                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="inline-flex">
                                              <Bot size={10} />
                                            </motion.div>
                                          ) : <Sparkles size={10} />}
                                          {sub.actionSteps?.length ? "Resequence" : "Generate Steps"}
                                        </button>
                                      </div>

                                      <div className="space-y-4">
                                        {(sub.actionSteps || []).map((step, stepIdx) => (
                                          <div key={stepIdx} className="bg-stone-50 p-4 md:p-6 rounded-2xl border border-stone-100 space-y-4 relative group/step">
                                            <button 
                                              onClick={() => {
                                                setDomains(domains.map(dom => {
                                                  if (dom.id !== domain.id) return dom;
                                                  return {
                                                    ...dom,
                                                    subAreas: dom.subAreas.map(s => {
                                                      if (s.id !== sub.id) return s;
                                                      const updated = [...(s.actionSteps || [])].filter((_, i) => i !== stepIdx);
                                                      return { ...s, actionSteps: updated };
                                                    })
                                                  };
                                                }));
                                              }}
                                              className="absolute top-4 right-4 text-stone-300 hover:text-red-500 opacity-0 group-hover/step:opacity-100 transition-all no-export"
                                            >
                                              <Trash2 size={14} />
                                            </button>

                                            <div className="flex gap-4">
                                              <div className="w-8 h-8 rounded-full border-2 border-emerald-200 flex items-center justify-center text-[10px] font-bold text-emerald-600 shrink-0">
                                                {stepIdx + 1}
                                              </div>
                                              <div className="flex-1 space-y-4">
                                                <div className="space-y-2">
                                                  <label className="text-stone-400 text-[8px] font-bold uppercase tracking-widest">Action Step</label>
                                                  <div className="hidden export-only text-sm font-bold text-stone-900 whitespace-pre-wrap">
                                                    {step.task}
                                                  </div>
                                                  <textarea 
                                                    value={step.task}
                                                    onChange={(e) => {
                                                      setDomains(domains.map(dom => {
                                                        if (dom.id !== domain.id) return dom;
                                                        return {
                                                          ...dom,
                                                          subAreas: dom.subAreas.map(s => {
                                                            if (s.id !== sub.id) return s;
                                                            const updated = [...(s.actionSteps || [])];
                                                            updated[stepIdx] = { ...updated[stepIdx], task: e.target.value };
                                                            return { ...s, actionSteps: updated };
                                                          })
                                                        };
                                                      }));
                                                    }}
                                                    className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all min-h-[60px] resize-none"
                                                    placeholder="Enter action step..."
                                                  />
                                                </div>

                                                <div className="space-y-4 pt-4 border-t border-stone-100">
                                                  {/* Timeline */}
                                                  <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                      <Calendar size={12} className="text-emerald-500" />
                                                      <label className="text-[8px] font-bold uppercase tracking-widest text-stone-400">Timeline</label>
                                                    </div>
                                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                                      <input 
                                                        type="date"
                                                        value={step.startDate || ""}
                                                        onChange={(e) => {
                                                          setDomains(domains.map(dom => {
                                                            if (dom.id !== domain.id) return dom;
                                                            return {
                                                              ...dom,
                                                              subAreas: dom.subAreas.map(s => {
                                                                if (s.id !== sub.id) return s;
                                                                const updated = [...(s.actionSteps || [])];
                                                                updated[stepIdx] = { ...updated[stepIdx], startDate: e.target.value };
                                                                return { ...s, actionSteps: updated };
                                                              })
                                                            };
                                                          }));
                                                        }}
                                                        className="flex-1 sm:flex-none bg-white border border-stone-200 rounded-xl p-2 text-[10px] focus:ring-1 focus:ring-emerald-500 hover:border-stone-300 transition-all font-medium cursor-pointer outline-none min-w-[120px]"
                                                      />
                                                      <span className="text-stone-300 text-[10px] hidden sm:block text-center px-1">→</span>
                                                      <input 
                                                        type="date"
                                                        value={step.endDate || ""}
                                                        onChange={(e) => {
                                                          setDomains(domains.map(dom => {
                                                            if (dom.id !== domain.id) return dom;
                                                            return {
                                                              ...dom,
                                                              subAreas: dom.subAreas.map(s => {
                                                                if (s.id !== sub.id) return s;
                                                                const updated = [...(s.actionSteps || [])];
                                                                updated[stepIdx] = { ...updated[stepIdx], endDate: e.target.value, isOngoing: false };
                                                                return { ...s, actionSteps: updated };
                                                              })
                                                            };
                                                          }));
                                                        }}
                                                        disabled={!!step.isOngoing}
                                                        className={cn(
                                                          "flex-1 sm:flex-none bg-white border border-stone-200 rounded-xl p-2 text-[10px] focus:ring-1 focus:ring-emerald-500 hover:border-stone-300 transition-all font-medium cursor-pointer outline-none min-w-[120px]",
                                                          step.isOngoing ? "opacity-60 cursor-not-allowed bg-stone-100" : ""
                                                        )}
                                                      />
                                                    </div>
                                                    <label className="inline-flex items-center gap-2 text-[10px] font-bold text-emerald-700 uppercase tracking-widest">
                                                      <input
                                                        type="checkbox"
                                                        checked={!!step.isOngoing}
                                                        onChange={(e) => {
                                                          setDomains(domains.map(dom => {
                                                            if (dom.id !== domain.id) return dom;
                                                            return {
                                                              ...dom,
                                                              subAreas: dom.subAreas.map(s => {
                                                                if (s.id !== sub.id) return s;
                                                                const updated = [...(s.actionSteps || [])];
                                                                updated[stepIdx] = {
                                                                  ...updated[stepIdx],
                                                                  isOngoing: e.target.checked,
                                                                  endDate: e.target.checked ? "" : updated[stepIdx].endDate
                                                                };
                                                                return { ...s, actionSteps: updated };
                                                              })
                                                            };
                                                          }));
                                                        }}
                                                        className="w-3.5 h-3.5"
                                                      />
                                                      Ongoing
                                                    </label>
                                                  </div>

                                                  {/* Measure */}
                                                  <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                      <LineChart size={12} className="text-emerald-500" />
                                                      <label className="text-[8px] font-bold uppercase tracking-widest text-stone-400">Measure of Success</label>
                                                    </div>
                                                    <div className="hidden export-only text-xs leading-relaxed text-stone-800 whitespace-pre-wrap">
                                                      {step.measure}
                                                    </div>
                                                    <textarea
                                                      value={step.measure || ""}
                                                      onChange={(e) => {
                                                        setDomains(domains.map(dom => {
                                                          if (dom.id !== domain.id) return dom;
                                                          return {
                                                            ...dom,
                                                            subAreas: dom.subAreas.map(s => {
                                                              if (s.id !== sub.id) return s;
                                                              const updated = [...(s.actionSteps || [])];
                                                              updated[stepIdx] = { ...updated[stepIdx], measure: e.target.value };
                                                              return { ...s, actionSteps: updated };
                                                            })
                                                          };
                                                        }));
                                                      }}
                                                      className="w-full bg-white border border-stone-200 rounded-xl p-3 text-xs leading-relaxed focus:ring-2 focus:ring-emerald-500/20 transition-all min-h-[60px] resize-none"
                                                      placeholder="How will success be measured?"
                                                    />
                                                  </div>

                                                  {/* Obstacle */}
                                                  <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                      <ShieldAlert size={12} className="text-amber-500" />
                                                      <label className="text-[8px] font-bold uppercase tracking-widest text-stone-400">Focus area obstacle</label>
                                                    </div>
                                                    <div className="hidden export-only text-xs leading-relaxed text-stone-800 whitespace-pre-wrap">
                                                      {step.obstacle}
                                                    </div>
                                                    <textarea 
                                                      value={step.obstacle || ""}
                                                      onChange={(e) => {
                                                        setDomains(domains.map(dom => {
                                                          if (dom.id !== domain.id) return dom;
                                                          return {
                                                            ...dom,
                                                            subAreas: dom.subAreas.map(s => {
                                                              if (s.id !== sub.id) return s;
                                                              const updated = [...(s.actionSteps || [])];
                                                              updated[stepIdx] = { ...updated[stepIdx], obstacle: e.target.value };
                                                              return { ...s, actionSteps: updated };
                                                            })
                                                          };
                                                        }));
                                                      }}
                                                      className="w-full bg-white border border-stone-200 rounded-xl p-3 text-xs leading-relaxed focus:ring-2 focus:ring-amber-500/20 transition-all min-h-[60px] resize-none"
                                                      placeholder="What could get in the way?"
                                                    />
                                                  </div>

                                                  {/* Overcome */}
                                                  <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                      <Zap size={12} className="text-emerald-500" />
                                                      <label className="text-[8px] font-bold uppercase tracking-widest text-stone-400">Overcoming Strategy</label>
                                                    </div>
                                                    <div className="hidden export-only text-xs leading-relaxed text-stone-800 whitespace-pre-wrap">
                                                      {step.overcome}
                                                    </div>
                                                    <textarea 
                                                      value={step.overcome || ""}
                                                      onChange={(e) => {
                                                        setDomains(domains.map(dom => {
                                                          if (dom.id !== domain.id) return dom;
                                                          return {
                                                            ...dom,
                                                            subAreas: dom.subAreas.map(s => {
                                                              if (s.id !== sub.id) return s;
                                                              const updated = [...(s.actionSteps || [])];
                                                              updated[stepIdx] = { ...updated[stepIdx], overcome: e.target.value };
                                                              return { ...s, actionSteps: updated };
                                                            })
                                                          };
                                                        }));
                                                      }}
                                                      className="w-full bg-white border border-stone-200 rounded-xl p-3 text-xs leading-relaxed focus:ring-2 focus:ring-emerald-500/20 transition-all min-h-[60px] resize-none"
                                                      placeholder="How will you overcome it?"
                                                    />
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        ))}

                                        <button 
                                          onClick={() => {
                                            setDomains(domains.map(dom => {
                                              if (dom.id !== domain.id) return dom;
                                              return {
                                                ...dom,
                                                subAreas: dom.subAreas.map(s => {
                                                  if (s.id !== sub.id) return s;
                                                  const updated = [...(s.actionSteps || []), { task: "Manual Action Step", measure: "", obstacle: "", overcome: "", progress: 0, startDate: "", endDate: "", isOngoing: false }];
                                                  return { ...s, actionSteps: updated };
                                                })
                                              };
                                            }));
                                          }}
                                          className="w-full py-4 border-2 border-dashed border-stone-200 rounded-2xl text-[10px] font-bold text-stone-400 uppercase tracking-widest hover:border-emerald-300 hover:text-emerald-600 transition-all flex items-center justify-center gap-2 no-export"
                                        >
                                          <Plus size={16} /> Add Action Step
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {/* General Plan Notes */}
                    <div className="bg-emerald-50/30 p-8 rounded-[2.5rem] border border-emerald-100/50 space-y-4">
                      <div className="flex items-center gap-3">
                        <MessageSquare className="text-emerald-600" size={24} />
                        <h3 className="text-xl font-serif italic text-stone-900">Coachee Strategic Notes</h3>
                      </div>
                      <p className="text-stone-500 text-xs">Use this space to capture overarching insights, commitment statements, or specific adjustments for your growth journey.</p>
                      <div className="hidden export-only w-full bg-white border border-stone-200 rounded-3xl p-8 text-base md:text-lg shadow-inner italic whitespace-pre-wrap text-stone-800 leading-relaxed">
                        {planNotes || "No strategic notes provided."}
                      </div>
                      <textarea 
                        value={planNotes}
                        onChange={(e) => setPlanNotes(e.target.value)}
                        placeholder="My commitment is to stay consistent with these End-goals. I will review this plan weekly..."
                        className="w-full bg-white border border-stone-200 rounded-3xl p-8 text-base md:text-lg focus:ring-2 focus:ring-emerald-500 transition-all shadow-inner resize-none italic"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-stone-50 px-8 py-6 border-t border-stone-100 flex flex-col items-center justify-center gap-4 shrink-0">
                  <div className="flex items-center gap-3 text-stone-400 justify-center">
                    <LayoutDashboard size={16} />
                    <span className="text-[9px] font-bold uppercase tracking-[0.2em]">D.R.E.A.M. Framework Execution</span>
                  </div>
                  <div className="flex flex-col items-center gap-4 w-full">
                    <div className="flex flex-wrap items-center justify-center gap-4 w-full">
                      <button 
                        onClick={() => skipToStep(CoachingStep.AFFIRMATIONS)}
                        className="bg-white border border-stone-200 text-stone-600 px-8 py-5 rounded-2xl font-bold flex items-center gap-3 hover:bg-stone-50 transition-all shadow-xl tracking-wide text-sm md:text-base"
                      >
                        <ChevronLeft size={20} /> Back
                      </button>

                      {completedDomainIds.length < 5 && (
                        <button 
                          onClick={() => {
                            if (activeDomainId && !completedDomainIds.includes(activeDomainId)) {
                              setCompletedDomainIds(prev => [...prev, activeDomainId]);
                            }
                            setSelectedRoles([]);
                            setActiveDomainId(null);
                            setShowDomainVisionResults(false);
                            // Reset discovery responses for the next domain
                            setDiscoveryResponses([
                              { question: "What is your desired end-state? (Where are you trying to get to?/what does ‘finished’ look like?/what’s your final destination)", answer: "" },
                              { question: "What is your current reality? (Describe your current situation/what’s happening currently/where are you now in respect of your chosen Domain?)", answer: "" },
                              { question: "Describe some of the challenges you’re currently facing?", answer: "" },
                              { question: "What is your horizon for this Domain? (Choose the time frame that best suits when you’d like to have reached your end-state.)", answer: "12 months" },
                              { question: "In addition to the answers you gave to Q3, what are some of the potential obstacles that might get in the way of you reaching your end-state? (things that might trip you up?)", answer: "" },
                              { question: "Is there any other information you’d like to share that will help the AI to optimise your Focus Areas?", answer: "" }
                            ]);
                            skipToStep(CoachingStep.DOMAIN);
                          }}
                          className="bg-white border-2 border-stone-800 text-stone-800 hover:bg-stone-50 px-10 py-5 rounded-2xl font-bold flex items-center gap-3 transition-all shadow-xl tracking-wide text-sm md:text-base font-sans"
                        >
                          <Plus size={20} /> Complete & Start {
                            completedDomainIds.length === 0 ? "2nd" : 
                            completedDomainIds.length === 1 ? "3rd" : 
                            completedDomainIds.length === 2 ? "4th" : 
                            completedDomainIds.length === 3 ? "5th" : "6th"
                          } Domain
                        </button>
                      )}

                      <button 
                        onClick={() => {
                          if (activeDomainId && !completedDomainIds.includes(activeDomainId)) {
                            setCompletedDomainIds(prev => [...prev, activeDomainId]);
                          }
                          skipToStep(CoachingStep.CONSOLIDATED_PLAN);
                        }}
                        className="bg-emerald-600 text-white px-10 py-5 rounded-2xl font-bold flex items-center gap-3 hover:bg-emerald-700 transition-all shadow-2xl shadow-emerald-600/20 tracking-wide text-sm md:text-base"
                      >
                        Complete & View Consolidated Plan <Trophy size={20} />
                      </button>
                    </div>

                    <button 
                      onClick={() => skipToStep(CoachingStep.CLEAR_SPACE)}
                      className="text-stone-400 hover:text-stone-600 text-xs font-bold tracking-wide transition-colors flex items-center gap-1"
                    >
                      <RotateCcw size={12} /> New Session
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 7: CONSOLIDATED PLAN VIEW */}
            {step === CoachingStep.CONSOLIDATED_PLAN && (
              <motion.div 
                key="consolidated"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full flex flex-col bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden animate-fade-in"
              >
                <style>{`
                  @media print {
                    .domain-page {
                      page-break-after: always !important;
                      break-after: page !important;
                      padding: 2rem !important;
                      border: none !important;
                      box-shadow: none !important;
                      min-height: auto !important;
                    }
                    .no-print {
                      display: none !important;
                    }
                    body {
                      background: white !important;
                    }
                  }
                `}</style>
                
                <div className="bg-stone-900 p-6 md:p-8 text-white flex flex-col md:flex-row justify-between items-center md:items-center shrink-0 gap-4 no-print">
                  <div className="flex flex-col items-center md:items-start text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-2 text-emerald-400 mb-2">
                      <Trophy size={20} />
                      <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.3em] text-center md:text-left">Official DREAMsheet AI Strategic Roadmap</span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-light tracking-tight text-center md:text-left">Consolidated Strategic Plan</h2>
                    <p className="text-stone-400 text-[10px] md:text-xs mt-1 font-medium italic text-center md:text-left">Validated. Integrated. Ready for execution.</p>
                  </div>
                  <div className="flex flex-row justify-center md:justify-end gap-4 md:gap-8 text-[9px] md:text-[10px] w-full md:w-auto">
                    <div className="text-center md:text-right">
                      <p className="text-stone-500 font-bold uppercase tracking-widest mb-1">Strategist</p>
                      <p className="text-sm font-medium">{clientName || "User"}</p>
                    </div>
                    <div className="text-center md:text-right">
                      <p className="text-stone-500 font-bold uppercase tracking-widest mb-1">Issued</p>
                      <p className="text-sm font-medium">{new Date().toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
                {isPreparingTacticalRoadmap && (
                  <div className="bg-emerald-50 border-b border-emerald-100 px-6 py-3 text-center text-xs font-bold uppercase tracking-widest text-emerald-700">
                    Preparing tactical roadmap...
                  </div>
                )}

                <div ref={planRef} className="p-4 md:p-12 space-y-12 md:space-y-24 bg-white">
                  {/* Strategic Roadmap Waterfall diagram */}
                  <div className="no-export-ignore">
                    <WaterfallRoadmap domains={currentSessionDomains} clientName={clientName} />
                  </div>

                  {currentSessionDomains.map((domain, dIdx) => (
                    <div key={domain.id} className="domain-page min-h-[auto] md:min-h-[800px] flex flex-col space-y-8 md:space-y-12 border-b border-stone-100 pb-12 md:pb-24 last:border-0 last:pb-0">
                      <div className="space-y-4 md:space-y-6 text-center md:text-left">
                        <div className="flex flex-col md:flex-row items-center gap-4">
                          <span className="w-10 h-10 md:w-12 md:h-12 bg-stone-900 text-white rounded-full flex items-center justify-center font-bold text-lg md:text-xl shrink-0">{dIdx + 1}</span>
                          <h3 className="text-2xl md:text-5xl font-bold tracking-tight text-stone-900 break-words">{domain.name}</h3>
                        </div>
                        <div className="bg-emerald-50 p-6 md:p-8 rounded-2xl md:rounded-3xl border border-emerald-100 italic font-serif text-base md:text-lg text-stone-800 leading-relaxed shadow-inner">
                          "{domain.domainVision}"
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-8 md:gap-12">
                        {domain.subAreas.map((sub, sIdx) => (
                          <div key={sub.id} className="space-y-6 md:space-y-8 p-6 md:p-10 bg-stone-50 rounded-3xl md:rounded-[3rem] border border-stone-100 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 md:p-8">
                                <span className="text-[9px] md:text-[10px] font-bold text-stone-300 uppercase tracking-widest">Focus area {sIdx + 1}</span>
                            </div>
                            
                            <div className="space-y-3 md:space-y-4">
                              <label className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-emerald-600">Strategic Target</label>
                              <h4 className="text-xl md:text-3xl font-light text-stone-900 tracking-tight">{sub.goal}</h4>
                              <div className="flex items-center gap-4 md:gap-6 pt-2">
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-stone-200">
                                  <Calendar size={14} className="text-stone-400" />
                                  <span className="text-[9px] md:text-[10px] font-bold text-stone-600 uppercase tracking-widest">{sub.startDate || 'TBD'} - {sub.isOngoing ? 'Ongoing' : (sub.finishDate || 'TBD')}</span>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-8 border-t border-stone-200">
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <label className="text-[9px] font-bold uppercase tracking-widest text-stone-400">Tactical Roadmap</label>
                                        <div className="space-y-3">
                                            {getPlanActionSteps(sub, domain).map((step, idx) => (
                                                <div key={idx} className="p-4 bg-white rounded-2xl border border-stone-100 shadow-sm space-y-3">
                                                    <div className="flex items-start gap-4">
                                                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold shrink-0">{idx + 1}</div>
                                                        <div>
                                                          <label className="text-[8px] font-bold uppercase tracking-widest text-stone-400">Task</label>
                                                          <p className="text-sm font-bold text-stone-900 leading-relaxed">{step.task || "Manual Action Step"}</p>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-0 sm:pl-10">
                                                      <div className="space-y-1">
                                                        <label className="text-[8px] font-bold uppercase tracking-widest text-stone-400">Timeline / Dates</label>
                                                        <div className="flex items-center gap-2">
                                                          <Calendar size={12} className="text-stone-400" />
                                                          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">
                                                            {step.startDate || step.dueDate || 'TBD'} - {step.isOngoing ? 'Ongoing' : (step.endDate || step.dueDate || 'TBD')}
                                                          </span>
                                                        </div>
                                                      </div>
                                                      <div className="space-y-1">
                                                        <label className="text-[8px] font-bold uppercase tracking-widest text-stone-400">Measure</label>
                                                        <p className="text-xs text-stone-700 leading-relaxed">{step.measure || "Measure of success to be defined."}</p>
                                                      </div>
                                                      <div className="space-y-1">
                                                        <label className="text-[8px] font-bold uppercase tracking-widest text-stone-400">Obstacle</label>
                                                        <p className="text-xs text-stone-700 leading-relaxed">{step.obstacle || "Obstacle to be defined."}</p>
                                                      </div>
                                                      <div className="space-y-1">
                                                        <label className="text-[8px] font-bold uppercase tracking-widest text-stone-400">Overcome / Solution</label>
                                                        <p className="text-xs text-stone-700 leading-relaxed">{step.overcome || "Solution to be defined."}</p>
                                                      </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="p-6 bg-white rounded-2xl border border-stone-100 shadow-sm space-y-4">
                                        <div className="flex items-center gap-2">
                                            <ShieldAlert size={16} className="text-amber-500" />
                                            <label className="text-[9px] font-bold uppercase tracking-widest text-stone-400">Contingency Plan</label>
                                        </div>
                                        <div className="space-y-4">
                                            {getPlanActionSteps(sub, domain).map((a, idx) => (
                                                <div key={idx} className="space-y-2">
                                                    <p className="text-[10px] font-bold text-stone-500 italic">Action {idx + 1}</p>
                                                    <p className="text-xs text-stone-800 font-medium leading-relaxed">{getContingencyPlan(a)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="p-6 bg-emerald-600 text-white rounded-2xl shadow-xl space-y-3">
                                        <label className="text-[9px] font-bold uppercase tracking-widest text-emerald-200">Inner Alignment</label>
                                        <p className="text-base md:text-lg font-serif italic leading-relaxed">
                                            "{sub.affirmation}"
                                        </p>
                                    </div>
                                </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {planNotes && (
                      <div className="pt-8 md:pt-12">
                          <label className="text-[8px] md:text-[10px] font-bold uppercase tracking-[0.4em] text-stone-300 block mb-4 md:mb-8 text-center md:text-left">Strategic Synthesis</label>
                          <div className="p-8 md:p-16 bg-stone-900 text-white rounded-3xl md:rounded-[4rem] shadow-2xl relative overflow-hidden group">
                              <div className="absolute top-0 right-0 p-8 md:p-12 opacity-10 group-hover:opacity-20 transition-opacity">
                                  <MessageSquare size={120} />
                              </div>
                              <p className="text-base md:text-lg font-serif italic leading-relaxed text-stone-100 relative z-10 whitespace-pre-wrap">
                                  {planNotes}
                              </p>
                          </div>
                      </div>
                  )}
                </div>

                <div className="bg-stone-50 px-6 md:px-12 py-6 border-t border-stone-100 flex flex-wrap items-center justify-center gap-4 shrink-0 no-print">
                  <button 
                    onClick={() => skipToStep(CoachingStep.MASTERPLAN)}
                    className="bg-white border border-stone-200 text-stone-600 px-6 md:px-8 py-3 md:py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-stone-50 transition-all shadow-lg tracking-wide text-xs md:text-sm w-full md:w-auto"
                  >
                    <ChevronLeft size={18} /> Back to Workshop
                  </button>
                  <button 
                    onClick={() => setShowEmailModal(true)}
                    className="bg-stone-800 text-white px-6 md:px-8 py-3.5 rounded-xl text-xs md:text-sm font-bold tracking-wide hover:bg-stone-900 transition-all flex items-center justify-center gap-3 shadow-xl shadow-stone-800/20 w-full md:w-auto"
                  >
                    <Mail size={18} /> Email My Full Plan
                  </button>
                  <button 
                    onClick={handleSaveDreamSheet}
                    disabled={isSavingSubmission}
                    className="bg-white border border-emerald-200 text-emerald-700 px-6 md:px-8 py-3.5 rounded-xl text-xs md:text-sm font-bold tracking-wide hover:bg-emerald-50 transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/10 w-full md:w-auto disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSavingSubmission ? 'Saving...' : 'Save DREAMsheet'}
                  </button>
                  <button 
                    onClick={handleExportPDF}
                    className="bg-emerald-600 text-white px-6 md:px-8 py-3.5 rounded-xl text-xs md:text-sm font-bold tracking-wide hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-3 w-full md:w-auto"
                  >
                    <Download size={18} /> Download Strategic PDF
                  </button>
                  <button 
                    onClick={() => setShowResetConfirm(true)}
                    className="text-stone-400 hover:text-red-500 transition-colors text-xs md:text-sm font-bold tracking-wide flex items-center gap-2 px-4 py-3 hover:bg-stone-100 rounded-xl"
                  >
                    <RotateCcw size={14} /> Reset Journey
                  </button>
                  {submissionSaveMessage && (
                    <p className="w-full text-center text-xs md:text-sm font-semibold text-stone-600" aria-live="polite">
                      {submissionSaveMessage}
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {/* EXECUTION DASHBOARD */}
            {/* STEP 6: COACH REVIEW MODE */}
            {step === CoachingStep.COACH_REVIEW && (
              <motion.div 
                key="coach-review"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="h-full flex flex-col gap-6"
              >
                <div className="flex flex-col md:flex-row items-center md:items-end justify-between gap-4 shrink-0 text-center md:text-left">
                  <div className="max-w-2xl flex flex-col items-center md:items-start w-full">
                    <div className="flex items-center justify-center md:justify-start gap-2 text-stone-600 mb-1">
                      <Users size={16} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Coach Review Mode</span>
                    </div>
                    <h2 className="text-2xl font-light text-stone-900 mb-1 text-center md:text-left">Empowering Growth Through Feedback</h2>
                    <p className="text-stone-600 text-xs text-center md:text-left">
                      Review {clientName || 'the coachee'}'s plan and provide strategic guidance.
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      setIsCoachMode(false);
                      skipToStep(CoachingStep.MASTERPLAN);
                    }}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-700 transition-colors flex items-center gap-2"
                  >
                    <Check size={14} />
                    Complete Review
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-12 custom-scrollbar">
                  {currentSessionDomains.map(domain => (
                    <div key={domain.id} className="space-y-6">
                      <div className="sticky top-0 z-10 bg-[#FDFCFB]/95 backdrop-blur py-2 border-b border-stone-100">
                        <h3 className="text-sm font-bold tracking-[0.1em] text-stone-400">{domain.name}</h3>
                      </div>

                      <div className="grid grid-cols-1 gap-8">
                        {domain.subAreas.map(sub => (
                          <div key={sub.id} className="bg-white rounded-2xl border border-stone-200 p-8 shadow-sm hover:shadow-md transition-all">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                              <div className="lg:col-span-2 space-y-6">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <h4 className="text-xl font-light text-stone-900 block break-words">{sub.name}</h4>
                                    <div className="flex items-center gap-4 mt-2">
                                      <div className="flex items-center gap-1 text-[10px] font-bold text-stone-400 uppercase">
                                        <Target size={12} />
                                        <span>Domains State: {domain.currentRating} → {domain.futureRating}</span>
                                      </div>
                                      <div className="h-4 w-px bg-stone-200"></div>
                                      <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                                        Domains Gap: {(domain.futureRating || 0) - (domain.currentRating || 0)} pts
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="p-4 bg-stone-50 rounded-xl border border-stone-100 space-y-4">
                                  <div>
                                    <label className="text-[8px] font-bold uppercase tracking-widest text-stone-400 block mb-2">End-goal</label>
                                    <p className="text-stone-800 font-medium leading-relaxed italic">{sub.goal}</p>
                                  </div>
                                  <div className="pt-3 border-t border-stone-200">
                                    <label className="text-[8px] font-bold uppercase tracking-widest text-emerald-600 block mb-2">Affirmation</label>
                                    <p className="text-emerald-800 font-medium leading-relaxed italic">{sub.affirmation}</p>
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  <label className="text-[8px] font-bold uppercase tracking-widest text-stone-400 block">Strategic Milestones</label>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {sub.milestones?.map((m, idx) => (
                                      <div key={idx} className="flex items-center gap-2 text-[10px] text-stone-600 bg-white p-2 rounded-lg border border-stone-100">
                                        <div className="w-4 h-4 rounded-full bg-stone-100 flex items-center justify-center font-bold text-stone-400 shrink-0">{idx + 1}</div>
                                        <span>{m}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                  <div className="space-y-3">
                                    <label className="text-[8px] font-bold uppercase tracking-widest text-stone-400 flex items-center gap-1">
                                      <ShieldAlert size={10} /> Obstacles
                                    </label>
                                    <div className="space-y-2">
                                      {sub.obstacles?.map((o, i) => (
                                        <div key={i} className="text-[11px] p-3 bg-white border border-stone-100 rounded-lg">
                                          <div className="font-bold text-red-700 mb-1">{o.obstacle}</div>
                                          <div className="text-stone-600 italic">Solution: {o.solution}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="space-y-3">
                                    <label className="text-[8px] font-bold uppercase tracking-widest text-stone-400 flex items-center gap-1">
                                      <ListTodo size={10} /> Action Steps
                                    </label>
                                    <div className="space-y-3">
                                      {sub.actionSteps?.map((a, i) => (
                                        <div key={i} className="space-y-2">
                                          <div className="flex justify-between items-start gap-4 text-[11px]">
                                            <span className="text-stone-700 font-medium leading-tight">{a.task}</span>
                                            <span className="text-[9px] font-bold text-stone-400 uppercase shrink-0 whitespace-nowrap mt-0.5">
                                              {a.isOngoing ? "Ongoing" : (a.startDate && a.endDate ? `${a.startDate} - ${a.endDate}` : (a.dueDate || a.endDate || ""))}
                                            </span>
                                          </div>
                                          <div className="text-[10px] text-stone-500 leading-relaxed">
                                            <span className="font-bold uppercase tracking-widest text-stone-400">Measure:</span> {a.measure || "Measure of success to be defined."}
                                          </div>
                                          <div className="h-1 bg-stone-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-500" style={{ width: `${a.progress || 0}%` }}></div>
                                          </div>
                                          
                                          {/* Action Step Comments */}
                                          <div className="pl-4 border-l-2 border-stone-100 space-y-2 mt-2">
                                            {a.coachComments?.map((c, ci) => (
                                              <div key={ci} className="group relative bg-emerald-50/50 p-2 rounded text-[10px] text-stone-700">
                                                <button 
                                                  onClick={() => deleteActionStepComment(domain.id, sub.id, i, ci)}
                                                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-stone-400 hover:text-red-500"
                                                >
                                                  <X size={10} />
                                                </button>
                                                {c}
                                              </div>
                                            ))}
                                            <div className="flex gap-2">
                                              <input 
                                                type="text"
                                                placeholder="Add feedback on this step..."
                                                className="flex-1 bg-white border border-stone-200 rounded px-2 py-1 text-[10px] focus:outline-none focus:border-emerald-500"
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') {
                                                    addActionStepComment(domain.id, sub.id, i, (e.target as HTMLInputElement).value);
                                                    (e.target as HTMLInputElement).value = '';
                                                  }
                                                }}
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-stone-50 rounded-2xl p-6 space-y-4 border border-stone-100">
                                <div className="flex items-center gap-2 text-stone-600">
                                  <MessageSquare size={16} />
                                  <span className="text-[10px] font-bold uppercase tracking-widest">Coach Feedback</span>
                                </div>
                                
                                <div className="space-y-3">
                                  {sub.coachComments?.map((c, i) => (
                                    <div key={i} className="group relative bg-white p-4 rounded-xl shadow-sm border border-stone-100 text-xs text-stone-700 leading-relaxed">
                                      <button 
                                        onClick={() => deleteSubAreaComment(domain.id, sub.id, i)}
                                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-stone-400 hover:text-red-500"
                                      >
                                        <X size={12} />
                                      </button>
                                      {c}
                                    </div>
                                  ))}
                                  
                                  <div className="pt-2">
                                    <textarea 
                                      placeholder="Write your strategic feedback here..."
                                      className="w-full bg-white border border-stone-200 rounded-xl p-4 text-xs text-stone-800 focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 focus:outline-none transition-all min-h-[100px]"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                          e.preventDefault();
                                          addSubAreaComment(domain.id, sub.id, (e.target as HTMLTextAreaElement).value);
                                          (e.target as HTMLTextAreaElement).value = '';
                                        }
                                      }}
                                    />
                                    <p className="text-[9px] text-stone-400 mt-2 italic">Press Enter to post comment</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div className="mt-12 mb-8 flex flex-col items-center gap-6 no-print">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => skipToStep(CoachingStep.AFFIRMATIONS)}
                        className="bg-white border border-stone-200 text-stone-600 px-8 py-5 rounded-2xl font-bold flex items-center gap-3 hover:bg-stone-50 transition-all shadow-xl tracking-wide text-sm md:text-base"
                      >
                        <ChevronLeft size={20} /> Back
                      </button>
                      <button 
                        onClick={() => window.print()}
                        className="bg-stone-900 text-white px-12 py-5 rounded-2xl font-bold flex items-center gap-3 hover:bg-black transition-all shadow-2xl tracking-wide text-sm md:text-base"
                      >
                        <Printer size={20} /> Print Strategic Plan
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </div>

        <QuizOverlay 
          showQuiz={showQuiz}
          setShowQuiz={setShowQuiz}
          quizResponses={quizResponses}
          setQuizResponses={setQuizResponses}
          currentQuizIndex={currentQuizIndex}
          setCurrentQuizIndex={setCurrentQuizIndex}
          quizPhase={quizPhase}
          setQuizPhase={setQuizPhase}
          selectedRoles={selectedRoles}
          setSelectedRoles={setSelectedRoles}
          domains={domains}
          setDomains={setDomains}
          setActiveDomainId={setActiveDomainId}
          setStep={setStep}
          skipToStep={skipToStep}
          setAvailableDiscoveryDomains={setAvailableDiscoveryDomains}
          setCustomDiscoveryDomains={setCustomDiscoveryDomains}
          suggestedDomains={suggestedDomains}
          setSuggestedDomains={setSuggestedDomains}
          isAnalyzingQuiz={isAnalyzingQuiz}
          setIsAnalyzingQuiz={setIsAnalyzingQuiz}
          setLastSelectedDomain={setLastSelectedDomain}
        />
      </main>

      {/* Global AI Loading Overlay */}
      <AnimatePresence>
        {isGlobalLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white/80 backdrop-blur-md z-[3000] flex items-center justify-center p-6"
          >
            <ThinkingRobot message="AI is working for you" />
          </motion.div>
        )}
      </AnimatePresence>
      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {showResetConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-[3000] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl border border-stone-200"
            >
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-6">
                <RotateCcw size={24} />
              </div>
              <h3 className="text-xl font-bold text-stone-900 mb-2">Reset Session?</h3>
              <p className="text-stone-600 mb-8">
                This will permanently clear your current coaching plan and progress. You'll need to start the process from the beginning.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-stone-200 font-bold text-stone-600 hover:bg-stone-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={resetPlan}
                  className="flex-1 px-4 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                >
                  Reset Everything
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Session Personalization Popout */}
      <AnimatePresence>
        {showNameCapture && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-stone-900/60 backdrop-blur-md z-[2100] flex items-center justify-center p-4 text-left font-sans"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-stone-200 relative text-left"
            >
              <button 
                onClick={() => setShowNameCapture(false)}
                className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-50 rounded-full transition-all cursor-pointer"
                title="Close"
              >
                <X size={18} />
              </button>

              <div className="space-y-6">
                {/* Visual Header */}
                <div className="space-y-2 text-center md:text-left">
                  <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mx-auto md:mx-0 shadow-sm border border-emerald-100/50">
                    <Users size={22} />
                  </div>
                  <h3 className="text-2xl font-light text-stone-900 font-serif italic mt-3">
                    Initialize Your <span className="font-sans not-italic font-bold text-emerald-700">DREAMsheet Session</span>
                  </h3>
                  <p className="text-stone-500 text-xs md:text-sm font-light max-w-sm">
                    Enter your Client name and your Coach (if relevant) to customize your strategic plan and active roadmap.
                  </p>
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#666666] flex items-center gap-1.5 justify-start">
                      <User size={12} className="text-emerald-600" />
                      Client Name (Coachee)
                    </label>
                    <input 
                      type="text"
                      value={tempClientName}
                      onChange={(e) => setTempClientName(e.target.value)}
                      placeholder="e.g. Alex Mercer"
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50/50 text-stone-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-medium"
                      autoFocus
                    />
                  </div>

                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#666666] flex items-center gap-1.5 justify-start">
                      <Bot size={12} className="text-emerald-600" />
                      Coach/Facilitator Name (where relevant) 
                    </label>
                    <input 
                      type="text"
                      value={tempCoachName}
                      onChange={(e) => setTempCoachName(e.target.value)}
                      placeholder="e.g. Coach Sarah (or leave for 'AI Coach')"
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50/50 text-stone-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-medium"
                    />
                  </div>
                </div>

                {/* Submission CTA */}
                <div className="pt-2">
                  <button 
                    onClick={() => {
                      setClientName(tempClientName.trim() || "");
                      setCoachName(tempCoachName.trim() || "");
                      setShowNameCapture(false);
                    }}
                    className="w-full py-3.5 px-6 rounded-xl bg-emerald-600 text-white text-xs md:text-sm font-bold uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/10 flex items-center justify-center gap-2 group cursor-pointer animate-none"
                  >
                    Set Profile & Start
                    <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Email Modal */}
      <AnimatePresence>
        {showEmailModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[3000] bg-stone-900/40 backdrop-blur-md flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl border border-stone-200 w-full max-w-md overflow-hidden"
            >
              <div className="bg-stone-900 p-8 text-white">
                <div className="flex items-center gap-3 text-emerald-400 mb-2">
                  <Mail size={24} />
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em]">Email DREAMSheet</span>
                </div>
                <h3 className="text-2xl font-light">Send your Masterplan</h3>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Recipient Email Address</label>
                  <input 
                    type="email"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    placeholder="e.g., success@yourjourney.com"
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                  />
                </div>
                
                <div className="flex gap-3">
                  <button 
                    onClick={handleSendEmail}
                    disabled={!emailAddress.includes('@')}
                    className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                  >
                    Send DREAMSheet
                  </button>
                  <button 
                    onClick={() => setShowEmailModal(false)}
                    className="px-6 bg-stone-100 text-stone-600 py-4 rounded-2xl font-bold text-sm hover:bg-stone-200 transition-all font-bold"
                  >
                    Cancel
                  </button>
                </div>
                
                <p className="text-[10px] text-stone-400 italic text-center">
                  Note: This will open your default email client with a generated summary of your plan.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const QuizOverlay = ({
  showQuiz,
  setShowQuiz,
  quizResponses,
  setQuizResponses,
  currentQuizIndex,
  setCurrentQuizIndex,
  quizPhase,
  setQuizPhase,
  selectedRoles,
  setSelectedRoles,
  domains,
  setDomains,
  setActiveDomainId,
  setStep,
  skipToStep,
  setAvailableDiscoveryDomains,
  setCustomDiscoveryDomains,
  suggestedDomains,
  setSuggestedDomains,
  isAnalyzingQuiz,
  setIsAnalyzingQuiz,
  setLastSelectedDomain
}: QuizOverlayProps) => {
  if (!showQuiz) return null;

  const currentQuestion = quizResponses[currentQuizIndex];

  if (showQuiz && quizPhase === 'input' && !currentQuestion) {
    return (
      <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-[3000] flex items-center justify-center p-4">
        <div className="bg-white rounded-[40px] p-8 max-w-sm text-center space-y-6">
          <p className="text-stone-600 italic">Something went wrong with the discovery state. Would you like to restart?</p>
          <button 
            onClick={() => {
              setQuizPhase('intro');
              setCurrentQuizIndex(0);
            }}
            className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold tracking-wide text-sm"
          >
            Restart Discovery
          </button>
        </div>
      </div>
    );
  }

  const [selectedDomainNames, setSelectedDomainNames] = useState<string[]>([]);
  const [currentRatingIndex, setCurrentRatingIndex] = useState(0);
  const [domainRatings, setDomainRatings] = useState<Record<string, { current: number, urgency: number, importance: number }>>({});
  const [quizNotice, setQuizNotice] = useState<string | null>(null);
  const [manualDomainName, setManualDomainName] = useState('');

  const analyzeResponses = async () => {
    setIsAnalyzingQuiz(true);
    setQuizPhase('analysis');
    setQuizNotice(null);
    try {
      const suggestions = await coachingService.analyzeQuizResponses(quizResponses);
      const finalSuggestions = suggestions.length > 0 ? suggestions : FALLBACK_DOMAIN_SUGGESTIONS;
      if (suggestions.length === 0) {
        setQuizNotice("AI domain suggestions could not be generated. You can continue with fallback domains or add your own.");
      }
      setSuggestedDomains(finalSuggestions);
      setSelectedDomainNames(finalSuggestions.map(s => s.name));
    } catch (error) {
      console.error("Quiz analysis failed:", error);
      setQuizNotice("AI domain suggestions could not be generated. You can continue with fallback domains or add your own.");
      setSuggestedDomains(FALLBACK_DOMAIN_SUGGESTIONS);
      setSelectedDomainNames(FALLBACK_DOMAIN_SUGGESTIONS.map(s => s.name));
    } finally {
      setIsAnalyzingQuiz(false);
    }
  };

  const nextQuizStep = () => {
    if (quizPhase === 'intro') {
      setQuizPhase('input');
      return;
    }

    if (currentQuizIndex < quizResponses.length - 1) {
      setCurrentQuizIndex(currentQuizIndex + 1);
    } else {
      analyzeResponses();
    }
  };

  const prevQuizStep = () => {
    if (quizPhase === 'input' && currentQuizIndex === 0) {
      setQuizPhase('intro');
      return;
    }

    if (currentQuizIndex > 0) {
      setCurrentQuizIndex(currentQuizIndex - 1);
    }
  };

  const updateQuizResponse = (value: string) => {
    const newResponses = [...quizResponses];
    newResponses[currentQuizIndex] = { ...newResponses[currentQuizIndex], answer: value };
    setQuizResponses(newResponses);
  };

  const toggleSuggestedDomain = (domainName: string) => {
    if (selectedDomainNames.includes(domainName)) {
      setSelectedDomainNames(selectedDomainNames.filter(name => name !== domainName));
    } else {
      setSelectedDomainNames([...selectedDomainNames, domainName]);
    }
  };

  const addManualDomainSuggestion = () => {
    const trimmed = manualDomainName.trim();
    if (!trimmed) return;
    if (suggestedDomains.some(domain => domain.name.toLowerCase() === trimmed.toLowerCase())) {
      setManualDomainName('');
      return;
    }
    const nextDomain = { name: trimmed, description: "A domain you added manually for this plan." };
    setSuggestedDomains([...suggestedDomains, nextDomain]);
    setSelectedDomainNames([...selectedDomainNames, trimmed]);
    setManualDomainName('');
  };

  const handleStartRating = () => {
    const availableDomains = suggestedDomains.length > 0 ? suggestedDomains : FALLBACK_DOMAIN_SUGGESTIONS;
    const selected = availableDomains.filter(d => selectedDomainNames.includes(d.name));
    if (selected.length === 0) return;
    
    const initialRatings: Record<string, { current: number, urgency: number, importance: number }> = {};
    selected.forEach(d => initialRatings[d.name] = { current: 5, urgency: 5, importance: 5 });
    setDomainRatings(initialRatings);
    setQuizPhase('rating');
    setCurrentRatingIndex(0);
  };

  const handleRatingNext = () => {
    const availableDomains = suggestedDomains.length > 0 ? suggestedDomains : FALLBACK_DOMAIN_SUGGESTIONS;
    const selected = availableDomains.filter(d => selectedDomainNames.includes(d.name));
    if (currentRatingIndex < selected.length - 1) {
      setCurrentRatingIndex(currentRatingIndex + 1);
    } else {
      applySelectedDomains();
    }
  };

  const updateDomainRating = (domainName: string, field: 'current' | 'urgency' | 'importance', rating: number) => {
    setDomainRatings(prev => ({ 
      ...prev, 
      [domainName]: { 
        ...(prev[domainName] || { current: 5, urgency: 5, importance: 5 }), 
        [field]: rating 
      } 
    }));
  };

  const applySelectedDomains = () => {
    const availableDomains = suggestedDomains.length > 0 ? suggestedDomains : FALLBACK_DOMAIN_SUGGESTIONS;
    const selected = availableDomains.filter(d => selectedDomainNames.includes(d.name));
    
    // Rank based on (Importance + Urgency) - Current satisfaction
    const rankedSelected = [...selected].sort((a, b) => {
      const ratingsA = domainRatings[a.name] || { current: 5, urgency: 5, importance: 5 };
      const ratingsB = domainRatings[b.name] || { current: 5, urgency: 5, importance: 5 };
      const scoreA = ratingsA.importance + ratingsA.urgency - ratingsA.current;
      const scoreB = ratingsB.importance + ratingsB.urgency - ratingsB.current;
      return scoreB - scoreA;
    });

    const selectedNames = rankedSelected.map(d => d.name);
    
    // Add to selectedRoles for inclusion in discovery
    setSelectedRoles(Array.from(new Set([...selectedRoles, ...selectedNames])));
    if (selectedNames.length > 0) {
      setLastSelectedDomain?.(selectedNames[0]);
    }
    
    // Add to customDiscoveryDomains
    setCustomDiscoveryDomains(prev => Array.from(new Set([...prev, ...selectedNames])));
    
    // Create domain shells for the selected domains
    const newDomainsToAdd: Domain[] = rankedSelected.map(r => ({
      id: Math.random().toString(36).substr(2, 9),
      name: r.name,
      currentRating: domainRatings[r.name]?.current || 5,
      urgency: domainRatings[r.name]?.urgency || 5,
      importance: domainRatings[r.name]?.importance || 5,
      futureRating: 8,
      subAreas: []
    }));
    
    const updatedDomains = [...domains];
    newDomainsToAdd.forEach(newDom => {
      if (!updatedDomains.find(d => d.name === newDom.name)) {
        updatedDomains.push(newDom);
      }
    });

    // Sort all domains by priority score if possible, or just keep the previous ones and append ranked new ones?
    // User asked to rank the domains that come from the quiz.
    // I'll append them. 
    setDomains(updatedDomains);
    
    if (selectedNames.length > 0) {
      const focusDomain = updatedDomains.find(d => d.name === selectedNames[0]);
      if (focusDomain) {
        setActiveDomainId(focusDomain.id);
      }
    }
    
    setShowQuiz(false);
    skipToStep(CoachingStep.DOMAIN);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[3000] bg-stone-900/40 backdrop-blur-md min-h-screen overflow-y-auto p-3 md:p-6"
    >
      <div className="bg-white w-full max-w-5xl min-h-[calc(100vh-1.5rem)] md:min-h-[calc(100vh-3rem)] mx-auto rounded-[28px] md:rounded-[40px] shadow-2xl flex flex-col overflow-hidden border border-white/20">
        <div className="p-4 md:p-6 border-b border-stone-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600 shrink-0">
              <Compass size={24} />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg md:text-xl font-bold text-stone-900 truncate">Domain Identification Quiz</h2>
              <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest truncate">Identify your growth areas</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4 no-print">
            <button 
              onClick={() => setShowQuiz(false)}
              className="hidden sm:block text-[10px] font-bold text-stone-400 hover:text-stone-800 uppercase tracking-widest px-4 py-2"
            >
              Exit Journey
            </button>
            <button 
              onClick={() => setShowQuiz(false)}
              className="p-2 hover:bg-stone-50 rounded-full transition-colors text-stone-400"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait" initial={false}>
            {quizPhase === 'intro' ? (
              <motion.div 
                key="quiz-intro"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="min-h-full flex flex-col items-center justify-center p-5 md:p-8 max-w-2xl mx-auto text-center space-y-6 md:space-y-8 overflow-y-auto"
              >
                <div className="space-y-6">
                  <h3 className="text-2xl md:text-4xl font-serif italic text-stone-900 leading-tight">Instructions to Coachee</h3>
                  <div className="space-y-3 md:space-y-4 text-stone-600 font-serif italic text-lg md:text-xl leading-relaxed">
                    <p>“Answer these questions briefly and honestly.”</p>
                    <p>“As you respond, notice recurring themes or areas of life that matter most to you.”</p>
                    <p>“From your answers, identify 4–5 domains that seem most important in your current life.”</p>
                  </div>
                </div>
                <button
                  onClick={() => setQuizPhase('input')}
                  className="px-8 md:px-16 py-4 md:py-6 bg-stone-900 text-white rounded-[24px] text-xs md:text-sm font-bold tracking-wide hover:bg-emerald-600 shadow-2xl transition-all active:scale-95 flex items-center gap-3"
                >
                  Start Discovery Journey
                  <ChevronRight size={18} />
                </button>
              </motion.div>
            ) : quizPhase === 'input' ? (
              <motion.div 
                key="quiz-input"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="min-h-full overflow-y-auto p-4 sm:p-5 md:p-8 flex flex-col justify-start sm:justify-center max-w-3xl mx-auto w-full font-serif custom-scrollbar"
              >
                <div className="space-y-6 md:space-y-8">
                  <div className="space-y-3 text-center">
                    <span className="text-[10px] font-bold text-emerald-600 font-sans uppercase tracking-[0.2em]">Question {currentQuizIndex + 1} of 10</span>
                    <h3 className="text-lg sm:text-xl md:text-2xl italic text-stone-900 leading-tight">{currentQuestion.question}</h3>
                  </div>

                  <div>
                    <textarea
                      value={currentQuestion?.answer || ''}
                      onChange={(e) => updateQuizResponse(e.target.value)}
                      placeholder="Share your thoughts honestly..."
                      className="w-full min-h-36 md:min-h-44 bg-stone-50 border-2 border-stone-100 rounded-3xl p-5 text-base md:text-lg text-stone-900 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all font-serif italic outline-none"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <button
                      onClick={prevQuizStep}
                      className="flex items-center gap-2 px-8 py-4 rounded-2xl text-xs font-bold font-sans tracking-wide text-stone-500 hover:bg-stone-50 transition-all"
                    >
                      <ChevronLeft size={18} />
                      Back
                    </button>
                    <button
                      onClick={nextQuizStep}
                      disabled={!currentQuestion?.answer?.trim()}
                      className="flex items-center gap-2 px-8 md:px-12 py-4 md:py-5 bg-emerald-600 text-white rounded-2xl text-xs font-bold font-sans tracking-wide hover:bg-emerald-700 shadow-xl shadow-emerald-600/20 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {currentQuizIndex === quizResponses.length - 1 ? "Complete discovery" : "Next Question"}
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : quizPhase === 'analysis' ? (
              <motion.div 
                key="quiz-analysis"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="min-h-full flex flex-col p-4 md:p-6 overflow-y-auto custom-scrollbar"
              >
                {isAnalyzingQuiz ? (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <ThinkingRobot message="Identifying recurring themes..." />
                  </div>
                ) : (
                  <div className="max-w-4xl mx-auto md:mx-0 w-full space-y-8 md:space-y-12 py-6 md:py-8">
                    <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-3 px-4 md:px-0">
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Step 2 — Identify Domains</span>
                      <h3 className="text-2xl md:text-4xl font-serif italic text-stone-900 leading-tight">Your Recurring Themes</h3>
                      <p className="text-stone-500 text-xs md:text-sm italic px-4 md:px-0">Review your answers and select 4–5 core domains that truly matter to you right now.</p>
                      {quizNotice && (
                        <p className="text-amber-800 text-sm bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 w-full">
                          {quizNotice}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 px-4">
                      {(suggestedDomains.length > 0 ? suggestedDomains : FALLBACK_DOMAIN_SUGGESTIONS).map((domain, idx) => {
                        const isSelected = selectedDomainNames.includes(domain.name);
                        return (
                          <button
                            key={idx}
                            onClick={() => toggleSuggestedDomain(domain.name)}
                            className={cn(
                              "relative text-left p-6 md:p-8 rounded-3xl md:rounded-[32px] border-2 transition-all group",
                              isSelected 
                                ? "bg-white border-emerald-500 shadow-xl shadow-emerald-600/5 ring-1 ring-emerald-500"
                                : "bg-stone-50 border-stone-100 hover:border-emerald-200"
                            )}
                          >
                            <div className="absolute top-4 md:top-6 right-4 md:right-6">
                              <div className={cn(
                                "w-6 h-6 md:w-8 md:h-8 rounded-full border flex items-center justify-center transition-all",
                                isSelected ? "bg-emerald-500 border-emerald-500 text-white shadow-lg" : "bg-white border-stone-200 text-stone-300"
                              )}>
                                <Check size={14} className="md:w-4 md:h-4" />
                              </div>
                            </div>
                            <h4 className="text-lg md:text-2xl font-serif italic text-stone-900 mb-2 md:mb-3 pr-8">{domain.name}</h4>
                            <p className="text-stone-500 text-xs md:text-sm italic leading-relaxed">{domain.description}</p>
                          </button>
                        );
                      })}
                    </div>

                    <div className="px-4">
                      <div className="flex flex-col sm:flex-row gap-3 bg-stone-50 border border-stone-100 rounded-2xl p-3">
                        <input
                          value={manualDomainName}
                          onChange={(e) => setManualDomainName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') addManualDomainSuggestion();
                          }}
                          placeholder="Add a domain manually..."
                          className="flex-1 px-4 py-3 rounded-xl border border-stone-200 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                        <button
                          onClick={addManualDomainSuggestion}
                          disabled={!manualDomainName.trim()}
                          className="px-5 py-3 rounded-xl bg-stone-900 text-white text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-emerald-700 transition-all"
                        >
                          <Plus size={14} />
                          Add Domain
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-6 pt-8 md:pt-12 border-t border-stone-100">
                      <button
                        onClick={handleStartRating}
                        disabled={selectedDomainNames.length === 0}
                        className="flex items-center gap-3 px-10 md:px-16 py-4 md:py-6 bg-stone-900 text-white rounded-[24px] text-xs md:text-sm font-bold tracking-wide hover:bg-stone-800 shadow-2xl transition-all active:scale-95 group"
                      >
                        Confirm Domains and Rate
                        <Sparkles size={18} className="group-hover:rotate-12 transition-transform" />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="quiz-rating"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="min-h-full overflow-y-auto p-4 sm:p-5 md:p-8 flex flex-col justify-start sm:justify-center max-w-3xl mx-auto w-full font-serif custom-scrollbar"
              >
                {(() => {
                  const selected = (suggestedDomains.length > 0 ? suggestedDomains : FALLBACK_DOMAIN_SUGGESTIONS).filter(d => selectedDomainNames.includes(d.name));
                  const currentDomain = selected[currentRatingIndex];
                  if (!currentDomain) return null;

                  return (
                    <div className="space-y-8 md:space-y-12">
                      <div className="space-y-3 md:space-y-4 text-center">
                        <span className="text-[10px] font-bold text-emerald-600 font-sans uppercase tracking-[0.2em]">Step 3 — Rating {currentRatingIndex + 1} of {selected.length}</span>
                        <h3 className="text-lg sm:text-xl md:text-2xl italic text-stone-900 leading-tight">{currentDomain.name}</h3>
                        <p className="text-stone-500 text-xs md:text-sm">Please rate this domain based on your current reality.</p>
                      </div>

                      <div className="space-y-8 md:space-y-12 pt-4 md:pt-8">
                        {/* Satisfaction Slider */}
                        <div className="space-y-4 md:space-y-6">
                          <div className="flex justify-between items-end">
                            <div className="flex flex-col">
                              <span className="text-[8px] md:text-[10px] font-bold text-stone-400 font-sans uppercase tracking-widest text-red-500">Current Satisfaction</span>
                              <span className="text-[7px] md:text-[8px] text-stone-300 font-sans uppercase">Dissatisfied / Draining</span>
                            </div>
                            <span className="text-4xl md:text-6xl italic text-emerald-600 leading-none">{domainRatings[currentDomain.name]?.current || 5}</span>
                            <div className="flex flex-col items-end">
                              <span className="text-[8px] md:text-[10px] font-bold text-stone-400 font-sans uppercase tracking-widest text-emerald-500">Thriving</span>
                              <span className="text-[7px] md:text-[8px] text-stone-300 font-sans uppercase">Satisfied / Aligned</span>
                            </div>
                          </div>
                          <input 
                            type="range"
                            min="1"
                            max="10"
                            value={domainRatings[currentDomain.name]?.current || 5}
                            onChange={(e) => updateDomainRating(currentDomain.name, 'current', parseInt(e.target.value))}
                            className="w-full h-2 bg-stone-100 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                          />
                        </div>

                        {/* Importance Slider */}
                        <div className="space-y-4 md:space-y-6">
                          <div className="flex justify-between items-end">
                            <div className="flex flex-col">
                              <span className="text-[8px] md:text-[10px] font-bold text-stone-400 font-sans uppercase tracking-widest">Importance</span>
                              <span className="text-[7px] md:text-[8px] text-stone-300 font-sans uppercase">Nice to have</span>
                            </div>
                            <span className="text-4xl md:text-6xl italic text-stone-900 leading-none">{domainRatings[currentDomain.name]?.importance || 5}</span>
                            <div className="flex flex-col items-end">
                              <span className="text-[8px] md:text-[10px] font-bold text-stone-400 font-sans uppercase tracking-widest text-stone-900">Critical</span>
                              <span className="text-[7px] md:text-[8px] text-stone-300 font-sans uppercase">Life Essential</span>
                            </div>
                          </div>
                          <input 
                            type="range"
                            min="1"
                            max="10"
                            value={domainRatings[currentDomain.name]?.importance || 5}
                            onChange={(e) => updateDomainRating(currentDomain.name, 'importance', parseInt(e.target.value))}
                            className="w-full h-2 bg-stone-100 rounded-lg appearance-none cursor-pointer accent-stone-900"
                          />
                        </div>

                        {/* Urgency Slider */}
                        <div className="space-y-4 md:space-y-6">
                          <div className="flex justify-between items-end">
                            <div className="flex flex-col">
                              <span className="text-[8px] md:text-[10px] font-bold text-stone-400 font-sans uppercase tracking-widest">Urgency</span>
                              <span className="text-[7px] md:text-[8px] text-stone-300 font-sans uppercase">Can wait</span>
                            </div>
                            <span className="text-4xl md:text-6xl italic text-stone-600 leading-none">{domainRatings[currentDomain.name]?.urgency || 5}</span>
                            <div className="flex flex-col items-end">
                              <span className="text-[8px] md:text-[10px] font-bold text-stone-400 font-sans uppercase tracking-widest text-stone-600">Immediate</span>
                              <span className="text-[7px] md:text-[8px] text-stone-300 font-sans uppercase">Must address now</span>
                            </div>
                          </div>
                          <input 
                            type="range"
                            min="1"
                            max="10"
                            value={domainRatings[currentDomain.name]?.urgency || 5}
                            onChange={(e) => updateDomainRating(currentDomain.name, 'urgency', parseInt(e.target.value))}
                            className="w-full h-2 bg-stone-100 rounded-lg appearance-none cursor-pointer accent-stone-600"
                          />
                        </div>

                        <div className="flex justify-between text-[8px] md:text-[10px] text-stone-400 font-bold font-sans uppercase tracking-widest pt-4">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <span key={n}>{n}</span>)}
                        </div>
                      </div>

                      <div className="flex items-center justify-center gap-4 pt-8 md:pt-12">
                        <button
                          onClick={() => setCurrentRatingIndex(Math.max(0, currentRatingIndex - 1))}
                          disabled={currentRatingIndex === 0}
                          className="flex items-center gap-2 px-8 py-4 rounded-2xl text-xs font-bold font-sans tracking-wide text-stone-500 hover:bg-stone-50 transition-all disabled:opacity-0"
                        >
                          <ChevronLeft size={18} />
                          Back
                        </button>
                        <button
                          onClick={handleRatingNext}
                          className="flex items-center gap-3 px-16 py-6 bg-stone-900 text-white rounded-[24px] text-sm font-bold tracking-wide hover:bg-stone-800 shadow-2xl transition-all active:scale-95"
                        >
                          {currentRatingIndex === selected.length - 1 ? "Begin Coaching" : "Next Domain"}
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="px-4 md:px-8 py-4 bg-stone-50 border-t border-stone-100 flex justify-between items-center shrink-0">
          <div className="flex gap-2">
            {quizPhase === 'input' && quizResponses.map((_, i) => (
              <div 
                key={i} 
                className={cn(
                  "h-1.5 rounded-full transition-all duration-500",
                  i === currentQuizIndex ? "w-8 bg-emerald-600" : "w-1.5 bg-stone-200"
                )} 
              />
            ))}
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-stone-400 uppercase tracking-widest">
            <ShieldAlert size={12} />
            <span>AI Powered Discovery • Privacy First</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
