export enum CoachingStep {
  CLEAR_SPACE = 'clear_space',
  WELCOME = 'welcome',
  DOMAIN = 'domain',
  RATINGS = 'ratings',
  END_GOALS = 'end_goals',
  AFFIRMATIONS = 'affirmations',
  MASTERPLAN = 'masterplan',
  COACH_REVIEW = 'coach_review',
  CONSOLIDATED_PLAN = 'consolidated_plan'
}

export interface ActionStep {
  task: string;
  startDate?: string;
  endDate?: string;
  isOngoing?: boolean;
  dueDate?: string; // Keep for backward compatibility/transition
  measure?: string;
  obstacle?: string;
  overcome?: string;
  contingency?: string;
  progress?: number; // 0-100
  coachComments?: string[];
}

export interface SubArea {
  id: string;
  name: string;
  selected?: boolean;
  gap?: number;
  urgency?: number; // 1-10
  importance?: number; // 1-10
  goal?: string;
  suggestedGoals?: string[];
  milestones?: string[];
  affirmation?: string;
  suggestedAffirmations?: string[];
  suggestedActionClusters?: string[][];
  suggestedMeasureClusters?: string[][];
  suggestedObstacleClusters?: string[][];
  suggestedOvercomeClusters?: string[][];
  successIndicator?: string;
  targetDate?: string;
  startDate?: string;
  finishDate?: string;
  isOngoing?: boolean;
  obstacles?: { obstacle: string; solution: string; comments?: string[] }[];
  actionSteps?: ActionStep[];
  relatedSubAreaIds?: string[];
  coachComments?: string[];
}

export interface Domain {
  id: string;
  name: string;
  vision?: string;
  why?: string;
  suggestions?: string[];
  subAreas: SubArea[];
  isGenerating?: boolean;
  currentRating?: number;
  futureRating?: number;
  urgency?: number; // 1-10
  importance?: number; // 1-10
  domainGoal?: string;
  domainVision?: string;
  domainAffirmation?: string;
  suggestedAffirmations?: string[];
  notes?: string;
}

export interface CoachingPlan {
  id: string;
  clientName: string;
  coachName: string;
  createdAt: string;
  domains: Domain[];
}
