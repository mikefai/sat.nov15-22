import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type {
  CaseUserItem,
  CourseProgressState,
  CustomVocabEntry,
  DailyReflectionEntry,
  MasteryUserItem,
  QuestionAttempt,
  RouteView,
  StudentErrorEntry,
  VocabUserItem,
} from '../types/course';

const STORAGE_KEY = 'sat_1400_courseware_state_v1';

const EMPTY_STATE: CourseProgressState = {
  version: 1,
  lastRouteHash: '#/overview',
  questionAttempts: {},
  checkedBoxes: {},
  completedSteps: {},
  vocabProgress: {},
  customVocab: [],
  errorEntries: [],
  dailyReflections: {},
  masteryProgress: {},
  caseProgress: {},
};

export function parseHashToRoute(hash: string): RouteView {
  const clean = hash.replace(/^#\/?/, '').trim();
  if (!clean || clean === 'overview') return { kind: 'overview' };

  if (clean.startsWith('master-plan')) {
    const parts = clean.split('/');
    const ch = Number(parts[1]) || 0; // 0 = all chapters or chapter 1 default
    return { kind: 'master-plan', chapter: ch >= 1 && ch <= 7 ? ch : 1 };
  }

  if (clean.startsWith('day/')) {
    const parts = clean.split('/');
    const day = Math.min(7, Math.max(1, Number(parts[1]) || 1));
    const step = Math.min(10, Math.max(1, Number(parts[2]) || 1));
    return { kind: 'day', day, step };
  }

  if (clean.startsWith('vocab')) {
    const parts = clean.split('/');
    const tabRaw = parts[1];
    const tab =
      tabRaw === 'flashcards' || tabRaw === 'schedule' ? tabRaw : 'notebook';
    const dayFilter = parts[2] ? Number(parts[2]) : undefined;
    return { kind: 'vocab', tab, dayFilter };
  }

  if (clean.startsWith('error-log')) {
    const parts = clean.split('/');
    const tabRaw = parts[1];
    const tab =
      tabRaw === 'reflections' || tabRaw === 'taxonomy' ? tabRaw : 'log';
    return { kind: 'error-log', tab };
  }

  return { kind: 'overview' };
}

export function routeToHash(route: RouteView): string {
  switch (route.kind) {
    case 'overview':
      return '#/overview';
    case 'master-plan':
      return `#/master-plan/${route.chapter}`;
    case 'day':
      return `#/day/${route.day}/${route.step}`;
    case 'vocab':
      return route.dayFilter
        ? `#/vocab/${route.tab || 'notebook'}/${route.dayFilter}`
        : `#/vocab/${route.tab || 'notebook'}`;
    case 'error-log':
      return `#/error-log/${route.tab || 'log'}`;
  }
}

function loadInitialState(): CourseProgressState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<CourseProgressState>;
    return {
      ...EMPTY_STATE,
      ...parsed,
      questionAttempts: parsed.questionAttempts || {},
      checkedBoxes: parsed.checkedBoxes || {},
      completedSteps: parsed.completedSteps || {},
      vocabProgress: parsed.vocabProgress || {},
      customVocab: parsed.customVocab || [],
      errorEntries: parsed.errorEntries || [],
      dailyReflections: parsed.dailyReflections || {},
      masteryProgress: parsed.masteryProgress || {},
      caseProgress: parsed.caseProgress || {},
    };
  } catch {
    return EMPTY_STATE;
  }
}

interface CourseStoreContextValue {
  state: CourseProgressState;
  route: RouteView;
  navigate: (next: RouteView | string) => void;
  updateQuestionAttempt: (questionId: string, updater: (prev: QuestionAttempt) => QuestionAttempt) => void;
  resetQuestionSet: (questionIds: string[]) => void;
  toggleCheckbox: (checkId: string, checked: boolean) => void;
  toggleStepComplete: (day: number, step: number, explicit?: boolean) => void;
  updateVocabItem: (wordId: string, patch: Partial<VocabUserItem>) => void;
  addCustomVocab: (entry: Omit<CustomVocabEntry, 'id'>) => void;
  deleteCustomVocab: (id: string) => void;
  addErrorEntry: (entry: Omit<StudentErrorEntry, 'id' | 'createdAt'>) => void;
  updateErrorStatus: (id: string, status: StudentErrorEntry['coldResolveStatus']) => void;
  deleteErrorEntry: (id: string) => void;
  updateDailyReflection: (day: number, patch: Partial<DailyReflectionEntry>) => void;
  updateMasteryItem: (id: string, patch: Partial<MasteryUserItem>) => void;
  updateCaseItem: (id: string, patch: Partial<CaseUserItem>) => void;
  exportStateJson: () => string;
  importStateJson: (raw: string) => boolean;
  resetAllProgress: () => void;
}

const CourseStoreContext = createContext<CourseStoreContextValue | null>(null);

export const DEFAULT_ATTEMPT: QuestionAttempt = {
  checked: false,
  eliminatedChoices: [],
  flagged: false,
};

export const DEFAULT_VOCAB_USER: VocabUserItem = {
  status: 'new',
  mySentence: '',
  starred: false,
};

export const DEFAULT_REFLECTION: DailyReflectionEntry = {
  improvedToday: '',
  recurringMistake: '',
  vocabRetained: '',
  pacingNotes: '',
  tomorrowPriority: '',
};

export function CourseProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CourseProgressState>(loadInitialState);
  const [route, setRoute] = useState<RouteView>(() =>
    parseHashToRoute(window.location.hash || '#/overview')
  );

  // Sync localStorage whenever state updates
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota errors cleanly
    }
  }, [state]);

  // Listen to browser hashchange
  useEffect(() => {
    const onHashChange = () => {
      const next = parseHashToRoute(window.location.hash);
      setRoute(next);
      const canonical = routeToHash(next);
      if (canonical !== '#/overview') {
        setState((prev) =>
          prev.lastRouteHash === canonical ? prev : { ...prev, lastRouteHash: canonical }
        );
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((next: RouteView | string) => {
    const hash = typeof next === 'string' ? next : routeToHash(next);
    if (window.location.hash === hash) {
      setRoute(parseHashToRoute(hash));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.location.hash = hash;
    }
  }, []);

  const updateQuestionAttempt = useCallback(
    (questionId: string, updater: (prev: QuestionAttempt) => QuestionAttempt) => {
      setState((prev) => {
        const current = prev.questionAttempts[questionId] || DEFAULT_ATTEMPT;
        return {
          ...prev,
          questionAttempts: {
            ...prev.questionAttempts,
            [questionId]: updater(current),
          },
        };
      });
    },
    []
  );

  const resetQuestionSet = useCallback((questionIds: string[]) => {
    setState((prev) => {
      const nextAttempts = { ...prev.questionAttempts };
      for (const id of questionIds) {
        delete nextAttempts[id];
      }
      return { ...prev, questionAttempts: nextAttempts };
    });
  }, []);

  const toggleCheckbox = useCallback((checkId: string, checked: boolean) => {
    setState((prev) => ({
      ...prev,
      checkedBoxes: { ...prev.checkedBoxes, [checkId]: checked },
    }));
  }, []);

  const toggleStepComplete = useCallback((day: number, step: number, explicit?: boolean) => {
    const key = `d${day}-s${step}`;
    setState((prev) => {
      const nextVal = explicit !== undefined ? explicit : !prev.completedSteps[key];
      return {
        ...prev,
        completedSteps: { ...prev.completedSteps, [key]: nextVal },
      };
    });
  }, []);

  const updateVocabItem = useCallback((wordId: string, patch: Partial<VocabUserItem>) => {
    setState((prev) => {
      const current = prev.vocabProgress[wordId] || DEFAULT_VOCAB_USER;
      return {
        ...prev,
        vocabProgress: {
          ...prev.vocabProgress,
          [wordId]: { ...current, ...patch },
        },
      };
    });
  }, []);

  const addCustomVocab = useCallback((entry: Omit<CustomVocabEntry, 'id'>) => {
    const id = `custom-vocab-${Date.now()}`;
    setState((prev) => ({
      ...prev,
      customVocab: [...prev.customVocab, { ...entry, id }],
    }));
  }, []);

  const deleteCustomVocab = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      customVocab: prev.customVocab.filter((item) => item.id !== id),
    }));
  }, []);

  const addErrorEntry = useCallback(
    (entry: Omit<StudentErrorEntry, 'id' | 'createdAt'>) => {
      const newEntry: StudentErrorEntry = {
        ...entry,
        id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        errorEntries: [newEntry, ...prev.errorEntries],
      }));
    },
    []
  );

  const updateErrorStatus = useCallback(
    (id: string, status: StudentErrorEntry['coldResolveStatus']) => {
      setState((prev) => ({
        ...prev,
        errorEntries: prev.errorEntries.map((item) =>
          item.id === id ? { ...item, coldResolveStatus: status } : item
        ),
      }));
    },
    []
  );

  const deleteErrorEntry = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      errorEntries: prev.errorEntries.filter((item) => item.id !== id),
    }));
  }, []);

  const updateDailyReflection = useCallback(
    (day: number, patch: Partial<DailyReflectionEntry>) => {
      const key = String(day);
      setState((prev) => {
        const current = prev.dailyReflections[key] || DEFAULT_REFLECTION;
        return {
          ...prev,
          dailyReflections: {
            ...prev.dailyReflections,
            [key]: { ...current, ...patch },
          },
        };
      });
    },
    []
  );

  const updateMasteryItem = useCallback((id: string, patch: Partial<MasteryUserItem>) => {
    setState((prev) => {
      const current = prev.masteryProgress[id] || { draft: '', revealed: false };
      return {
        ...prev,
        masteryProgress: {
          ...prev.masteryProgress,
          [id]: { ...current, ...patch },
        },
      };
    });
  }, []);

  const updateCaseItem = useCallback((id: string, patch: Partial<CaseUserItem>) => {
    setState((prev) => {
      const current = prev.caseProgress[id] || { draft: '', revealed: false };
      return {
        ...prev,
        caseProgress: {
          ...prev.caseProgress,
          [id]: { ...current, ...patch },
        },
      };
    });
  }, []);

  const exportStateJson = useCallback(() => JSON.stringify(state, null, 2), [state]);

  const importStateJson = useCallback((raw: string) => {
    try {
      const parsed = JSON.parse(raw) as Partial<CourseProgressState>;
      if (!parsed || typeof parsed !== 'object') return false;
      setState({
        ...EMPTY_STATE,
        ...parsed,
        questionAttempts: parsed.questionAttempts || {},
        checkedBoxes: parsed.checkedBoxes || {},
        completedSteps: parsed.completedSteps || {},
        vocabProgress: parsed.vocabProgress || {},
        customVocab: parsed.customVocab || [],
        errorEntries: parsed.errorEntries || [],
        dailyReflections: parsed.dailyReflections || {},
        masteryProgress: parsed.masteryProgress || {},
        caseProgress: parsed.caseProgress || {},
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  const resetAllProgress = useCallback(() => {
    setState(EMPTY_STATE);
    window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo<CourseStoreContextValue>(
    () => ({
      state,
      route,
      navigate,
      updateQuestionAttempt,
      resetQuestionSet,
      toggleCheckbox,
      toggleStepComplete,
      updateVocabItem,
      addCustomVocab,
      deleteCustomVocab,
      addErrorEntry,
      updateErrorStatus,
      deleteErrorEntry,
      updateDailyReflection,
      updateMasteryItem,
      updateCaseItem,
      exportStateJson,
      importStateJson,
      resetAllProgress,
    }),
    [
      state,
      route,
      navigate,
      updateQuestionAttempt,
      resetQuestionSet,
      toggleCheckbox,
      toggleStepComplete,
      updateVocabItem,
      addCustomVocab,
      deleteCustomVocab,
      addErrorEntry,
      updateErrorStatus,
      deleteErrorEntry,
      updateDailyReflection,
      updateMasteryItem,
      updateCaseItem,
      exportStateJson,
      importStateJson,
      resetAllProgress,
    ]
  );

  return <CourseStoreContext.Provider value={value}>{children}</CourseStoreContext.Provider>;
}

export function useCourseStore(): CourseStoreContextValue {
  const ctx = useContext(CourseStoreContext);
  if (!ctx) {
    throw new Error('useCourseStore must be used inside CourseProvider');
  }
  return ctx;
}
