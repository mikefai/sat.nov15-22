export interface OutlineItem {
  id: string;
  level: number;
  text: string;
}

export interface ChoiceOption {
  letter: string;
  raw: string;
  html: string;
}

export interface PracticeQuestion {
  id: string;
  number: number;
  day: number;
  section: 'RW' | 'MATH';
  partTitle: string;
  domain: string;
  skill: string;
  difficulty: string;
  format: 'MC' | 'SPR';
  pacingNote: string;
  requiresConfidenceTag: boolean;
  stemHtml: string;
  choices: ChoiceOption[];
  correctAnswer: string;
  acceptableSpr: string[];
  numericValue: number | null;
  answerHeadlineHtml: string;
  explanationHtml: string;
}

export interface ComprehensionCheck {
  id: string;
  promptHtml: string;
  answerHtml: string;
}

export interface TeachingLesson {
  id: string;
  title: string;
  titleHtml: string;
  html: string;
  outline: OutlineItem[];
  checks: ComprehensionCheck[];
}

export interface RenderedSubSection {
  id: string;
  title: string;
  titleHtml?: string;
  html: string;
}

export interface VocabExerciseItem {
  id: string;
  number: number;
  groupTitle: string;
  format: 'MC' | 'SHORT';
  promptHtml: string;
  choices: ChoiceOption[];
  correctAnswer: string;
  answerHtml: string;
}

export interface VocabExerciseAttempt {
  selectedChoice?: string;
  draft?: string;
  checked: boolean;
  isCorrect?: boolean;
}

export interface DiagnosticCaseItem {
  id: string;
  categoryLabel: string;
  promptHtml: string;
  answerHtml: string;
}

export interface MasteryItem {
  id: string;
  number: number;
  topic: string;
  promptHtml: string;
  answerHtml: string;
}

export interface DayStepMeta {
  stepNumber: number;
  shortLabel: string;
  fullTitle: string;
  badge: string;
}

export interface DayWorkbook {
  day: number;
  filename: string;
  title: string;
  shortTitle: string;
  dateLabel: string;
  theme: string;
  studyBudget: string;
  learningSequence: string;
  noticeHtml: string;
  recommendedTimers: {
    rwMinutes: number;
    mathMinutes: number;
  };
  steps: DayStepMeta[];
  timetable: { html: string; outline: OutlineItem[] };
  objectives: { html: string; outline: OutlineItem[] };
  rwLessons: { introHtml: string; lessons: TeachingLesson[] };
  vocabulary: {
    introHtml: string;
    subSections: RenderedSubSection[];
    answerKeyHtml: string;
    exercises: VocabExerciseItem[];
  };
  rwPractice: { introHtml: string; questions: PracticeQuestion[] };
  mathLessons: { introHtml: string; lessons: TeachingLesson[] };
  mathPractice: { introHtml: string; questions: PracticeQuestion[] };
  answerVault: { introHtml: string; subSections: RenderedSubSection[] };
  errorLab: {
    beforeKeyHtml: string;
    caseKeyHtml: string;
    afterKeyHtml: string;
    cases: DiagnosticCaseItem[];
  };
  mastery: {
    introHtml: string;
    masteryItems: MasteryItem[];
    keyHtml: string;
    matrixTitle: string;
    matrixHtml: string;
  };
}

export interface VocabWordEntry {
  id: string;
  number: number;
  day: number;
  word: string;
  partOfSpeech: string;
  simpleMeaning: string;
  satContextHtml: string;
  satContextRaw: string;
  synonyms: string;
  contrasts: string;
  wordFamilyHtml: string;
  modelSentence: string;
  reviewDates: string;
}

export interface ErrorCodeInfo {
  code: string;
  label: string;
  description: string;
}

export interface ModelErrorEntry {
  id: string;
  date: string;
  section: string;
  topic: string;
  questionType: string;
  whyMissed: string;
  correctMethod: string;
  nextTimeRule: string;
}

export interface MasterPlanChapter {
  id: string;
  number: number;
  title: string;
  fullTitle: string;
  html: string;
  outline: OutlineItem[];
}

export interface CourseData {
  generatedAt: string;
  stats: {
    totalDays: number;
    totalQuestions: number;
    totalRwQuestions: number;
    totalMathQuestions: number;
    totalVocabWords: number;
    totalMasteryChecks: number;
    totalDiagnosticCases: number;
    mathExpressionsRendered: number;
  };
  overview: {
    introHtml: string;
    sections: Array<{ id: string; title: string; html: string }>;
  };
  masterPlan: {
    introHtml: string;
    chapters: MasterPlanChapter[];
  };
  days: DayWorkbook[];
  vocabStudio: {
    howToUseHtml: string;
    wordPartsHtml: string;
    spacedScheduleHtml: string;
    words: VocabWordEntry[];
  };
  errorLogStudio: {
    eCodes: ErrorCodeInfo[];
    vCodes: ErrorCodeInfo[];
    escalationHtml: string;
    reflectionGuideHtml: string;
    modelEntries: ModelErrorEntry[];
  };
}

export type RouteView =
  | { kind: 'overview' }
  | { kind: 'master-plan'; chapter: number }
  | { kind: 'day'; day: number; step: number }
  | { kind: 'vocab'; tab?: 'notebook' | 'flashcards' | 'schedule'; dayFilter?: number }
  | { kind: 'error-log'; tab?: 'log' | 'reflections' | 'taxonomy' }
  | { kind: 'admin' };

export interface QuestionAttempt {
  selectedChoice?: string;
  sprInput?: string;
  checked: boolean;
  isCorrect?: boolean;
  eliminatedChoices: string[];
  flagged: boolean;
  confidence?: 'C' | '?';
}

export interface VocabUserItem {
  status: 'new' | 'learning' | 'mastered';
  mySentence: string;
  starred: boolean;
}

export interface CustomVocabEntry {
  id: string;
  word: string;
  partOfSpeech: string;
  simpleMeaning: string;
  satContext: string;
  synonymsContrast: string;
  mySentence: string;
  reviewDates: string;
}

export interface StudentErrorEntry {
  id: string;
  createdAt: string;
  dateLabel: string;
  questionId?: string;
  section: 'R&W' | 'Math';
  topic: string;
  questionType: string;
  eCode: string;
  vCode: string;
  whyMissed: string;
  correctMethod: string;
  nextTimeRule: string;
  coldResolveStatus: 'pending' | 'resolved' | 'needs-repair';
}

export interface DailyReflectionEntry {
  improvedToday: string;
  recurringMistake: string;
  vocabRetained: string;
  pacingNotes: string;
  tomorrowPriority: string;
}

export interface MasteryUserItem {
  draft: string;
  revealed: boolean;
  grade?: 'mastered' | 'review';
}

export interface CaseUserItem {
  draft: string;
  revealed: boolean;
}

export interface CourseProgressState {
  version: number;
  lastRouteHash: string;
  questionAttempts: Record<string, QuestionAttempt>;
  vocabExerciseAttempts?: Record<string, VocabExerciseAttempt>;
  checkedBoxes: Record<string, boolean>;
  completedSteps: Record<string, boolean>;
  vocabProgress: Record<string, VocabUserItem>;
  customVocab: CustomVocabEntry[];
  errorEntries: StudentErrorEntry[];
  dailyReflections: Record<string, DailyReflectionEntry>;
  masteryProgress: Record<string, MasteryUserItem>;
  caseProgress: Record<string, CaseUserItem>;
}
