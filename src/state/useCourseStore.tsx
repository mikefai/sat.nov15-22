import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import type { Json } from '../types/supabase';
import { isSupabaseAuthCallbackHash, supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

const STORAGE_KEY = 'sat_1400_courseware_state_v1';

export type CloudSyncStatus = 'local' | 'loading' | 'saving' | 'synced' | 'error';

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
  if (isSupabaseAuthCallbackHash(hash)) return { kind: 'overview' };
  const clean = hash.replace(/^#\/?/, '').trim();
  if (!clean || clean === 'overview') return { kind: 'overview' };

  if (clean.startsWith('master-plan')) {
    const parts = clean.split('/');
    const ch = Number(parts[1]) || 0;
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

  if (clean === 'admin' || clean.startsWith('admin/')) {
    return { kind: 'admin' };
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
    case 'admin':
      return '#/admin';
  }
}

function normalizePartialState(parsed?: Partial<CourseProgressState> | null): CourseProgressState {
  if (!parsed || typeof parsed !== 'object') return EMPTY_STATE;
  return {
    ...EMPTY_STATE,
    ...parsed,
    version: 1,
    lastRouteHash:
      typeof parsed.lastRouteHash === 'string' && parsed.lastRouteHash.startsWith('#/')
        ? parsed.lastRouteHash
        : '#/overview',
    questionAttempts: parsed.questionAttempts || {},
    checkedBoxes: parsed.checkedBoxes || {},
    completedSteps: parsed.completedSteps || {},
    vocabProgress: parsed.vocabProgress || {},
    customVocab: Array.isArray(parsed.customVocab) ? parsed.customVocab : [],
    errorEntries: Array.isArray(parsed.errorEntries) ? parsed.errorEntries : [],
    dailyReflections: parsed.dailyReflections || {},
    masteryProgress: parsed.masteryProgress || {},
    caseProgress: parsed.caseProgress || {},
  };
}

function loadInitialState(): CourseProgressState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    return normalizePartialState(JSON.parse(raw) as Partial<CourseProgressState>);
  } catch {
    return EMPTY_STATE;
  }
}

function hasAnyProgress(s: CourseProgressState): boolean {
  return (
    Object.keys(s.questionAttempts).length > 0 ||
    Object.keys(s.checkedBoxes).length > 0 ||
    Object.keys(s.completedSteps).length > 0 ||
    Object.keys(s.vocabProgress).length > 0 ||
    s.customVocab.length > 0 ||
    s.errorEntries.length > 0 ||
    Object.keys(s.dailyReflections).length > 0 ||
    Object.keys(s.masteryProgress).length > 0 ||
    Object.keys(s.caseProgress).length > 0
  );
}

const VOCAB_STATUS_RANK: Record<VocabUserItem['status'], number> = {
  new: 0,
  learning: 1,
  mastered: 2,
};

function mergeCourseProgress(
  local: CourseProgressState,
  remoteRaw?: Partial<CourseProgressState> | null
): CourseProgressState {
  const remote = normalizePartialState(remoteRaw);
  if (!hasAnyProgress(local)) return remote;
  if (!hasAnyProgress(remote)) return local;

  const questionAttempts: Record<string, QuestionAttempt> = {
    ...local.questionAttempts,
  };
  for (const [qId, rAtt] of Object.entries(remote.questionAttempts)) {
    const lAtt = questionAttempts[qId];
    if (!lAtt) {
      questionAttempts[qId] = rAtt;
    } else if (rAtt.checked && !lAtt.checked) {
      questionAttempts[qId] = rAtt;
    } else if (rAtt.checked === lAtt.checked) {
      questionAttempts[qId] = rAtt;
    }
  }

  const checkedBoxes: Record<string, boolean> = { ...local.checkedBoxes };
  for (const [k, v] of Object.entries(remote.checkedBoxes)) {
    checkedBoxes[k] = Boolean(checkedBoxes[k] || v);
  }

  const completedSteps: Record<string, boolean> = { ...local.completedSteps };
  for (const [k, v] of Object.entries(remote.completedSteps)) {
    completedSteps[k] = Boolean(completedSteps[k] || v);
  }

  const vocabProgress: Record<string, VocabUserItem> = { ...local.vocabProgress };
  for (const [wId, rVoc] of Object.entries(remote.vocabProgress)) {
    const lVoc = vocabProgress[wId];
    if (!lVoc) {
      vocabProgress[wId] = rVoc;
    } else {
      const status =
        VOCAB_STATUS_RANK[rVoc.status] >= VOCAB_STATUS_RANK[lVoc.status]
          ? rVoc.status
          : lVoc.status;
      vocabProgress[wId] = {
        status,
        mySentence: rVoc.mySentence || lVoc.mySentence,
        starred: Boolean(rVoc.starred || lVoc.starred),
      };
    }
  }

  const customVocabMap = new Map<string, CustomVocabEntry>();
  for (const item of [...remote.customVocab, ...local.customVocab]) {
    if (!customVocabMap.has(item.id)) customVocabMap.set(item.id, item);
  }

  const errorMap = new Map<string, StudentErrorEntry>();
  for (const item of [...remote.errorEntries, ...local.errorEntries]) {
    if (!errorMap.has(item.id)) errorMap.set(item.id, item);
  }
  const errorEntries = [...errorMap.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );

  const dailyReflections: Record<string, DailyReflectionEntry> = {
    ...local.dailyReflections,
  };
  for (const [dayKey, rRef] of Object.entries(remote.dailyReflections)) {
    const lRef = dailyReflections[dayKey];
    if (!lRef) {
      dailyReflections[dayKey] = rRef;
    } else {
      dailyReflections[dayKey] = {
        improvedToday: rRef.improvedToday || lRef.improvedToday,
        recurringMistake: rRef.recurringMistake || lRef.recurringMistake,
        vocabRetained: rRef.vocabRetained || lRef.vocabRetained,
        pacingNotes: rRef.pacingNotes || lRef.pacingNotes,
        tomorrowPriority: rRef.tomorrowPriority || lRef.tomorrowPriority,
      };
    }
  }

  const masteryProgress: Record<string, MasteryUserItem> = {
    ...local.masteryProgress,
    ...remote.masteryProgress,
  };

  const caseProgress: Record<string, CaseUserItem> = {
    ...local.caseProgress,
    ...remote.caseProgress,
  };

  const lastRouteHash =
    remote.lastRouteHash && remote.lastRouteHash !== '#/overview'
      ? remote.lastRouteHash
      : local.lastRouteHash;

  return {
    version: 1,
    lastRouteHash,
    questionAttempts,
    checkedBoxes,
    completedSteps,
    vocabProgress,
    customVocab: [...customVocabMap.values()],
    errorEntries,
    dailyReflections,
    masteryProgress,
    caseProgress,
  };
}

function buildCloudRowPayload(userId: string, s: CourseProgressState) {
  const checkedAttempts = Object.values(s.questionAttempts).filter((a) => a.checked);
  const solved_questions = checkedAttempts.length;
  const correct_questions = checkedAttempts.filter((a) => a.isCorrect).length;
  const completed_steps = Object.values(s.completedSteps).filter(Boolean).length;
  const mastered_words = Object.values(s.vocabProgress).filter(
    (w) => w.status === 'mastered'
  ).length;
  const error_log_count = s.errorEntries.length;

  return {
    user_id: userId,
    state_version: 1,
    last_route_hash: s.lastRouteHash || '#/overview',
    solved_questions,
    correct_questions,
    completed_steps,
    mastered_words,
    error_log_count,
    progress_json: s as unknown as Json,
  };
}

interface CourseStoreContextValue {
  state: CourseProgressState;
  route: RouteView;
  syncStatus: CloudSyncStatus;
  lastSyncedAt: string | null;
  syncNow: () => Promise<void>;
  navigate: (next: RouteView | string) => void;
  updateQuestionAttempt: (
    questionId: string,
    updater: (prev: QuestionAttempt) => QuestionAttempt
  ) => void;
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
  const { user } = useAuth();
  const [state, setState] = useState<CourseProgressState>(loadInitialState);
  const [route, setRoute] = useState<RouteView>(() =>
    parseHashToRoute(window.location.hash || '#/overview')
  );
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>('local');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const stateRef = useRef<CourseProgressState>(state);
  stateRef.current = state;

  const hydratedUserIdRef = useRef<string | null>(null);
  const prevUserIdRef = useRef<string | null>(null);
  const skipNextAutoSaveRef = useRef(false);

  // Sync localStorage whenever state updates
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota errors cleanly
    }
  }, [state]);

  // Listen to browser hashchange without interfering with OAuth callback hashes
  useEffect(() => {
    const onHashChange = () => {
      if (isSupabaseAuthCallbackHash(window.location.hash)) return;
      const next = parseHashToRoute(window.location.hash);
      setRoute(next);
      const canonical = routeToHash(next);
      if (canonical !== '#/overview' && canonical !== '#/admin') {
        setState((prev) =>
          prev.lastRouteHash === canonical ? prev : { ...prev, lastRouteHash: canonical }
        );
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const pushStateToCloud = useCallback(
    async (userId: string, snapshot: CourseProgressState) => {
      setSyncStatus('saving');
      const payload = buildCloudRowPayload(userId, snapshot);
      const { data, error } = await supabase
        .from('course_progress')
        .upsert(payload, { onConflict: 'user_id' })
        .select('updated_at')
        .maybeSingle();

      if (error) {
        setSyncStatus('error');
        return;
      }
      setSyncStatus('synced');
      setLastSyncedAt(data?.updated_at || new Date().toISOString());
    },
    []
  );

  // Hydrate & merge cloud state when user signs in; clear local cache on explicit sign-out
  useEffect(() => {
    const currentUserId = user?.id ?? null;

    if (!currentUserId) {
      if (prevUserIdRef.current) {
        // User just signed out — clear local state so shared computers don't retain answers
        hydratedUserIdRef.current = null;
        prevUserIdRef.current = null;
        setState(EMPTY_STATE);
        setSyncStatus('local');
        setLastSyncedAt(null);
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch {
          // Ignore storage errors
        }
      } else {
        setSyncStatus('local');
      }
      return;
    }

    if (hydratedUserIdRef.current === currentUserId) {
      return;
    }

    prevUserIdRef.current = currentUserId;
    let cancelled = false;

    const loadAndMerge = async () => {
      setSyncStatus('loading');
      const { data, error } = await supabase
        .from('course_progress')
        .select('progress_json, updated_at')
        .eq('user_id', currentUserId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        hydratedUserIdRef.current = currentUserId;
        setSyncStatus('error');
        return;
      }

      const remoteJson = (data?.progress_json ?? null) as Partial<CourseProgressState> | null;
      const localSnapshot = stateRef.current;
      const merged = mergeCourseProgress(localSnapshot, remoteJson);

      skipNextAutoSaveRef.current = true;
      hydratedUserIdRef.current = currentUserId;
      setState(merged);

      // Push back immediately if local had progress to merge or remote row wasn't initialized yet
      if (!data || hasAnyProgress(localSnapshot)) {
        await pushStateToCloud(currentUserId, merged);
      } else {
        setSyncStatus('synced');
        setLastSyncedAt(data.updated_at);
      }
    };

    void loadAndMerge();

    return () => {
      cancelled = true;
    };
  }, [user?.id, pushStateToCloud]);

  // Debounced auto-save to Supabase whenever `state` mutates for an authenticated user
  useEffect(() => {
    const currentUserId = user?.id ?? null;
    if (!currentUserId || hydratedUserIdRef.current !== currentUserId) return;

    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false;
      return;
    }

    setSyncStatus('saving');
    const timer = window.setTimeout(() => {
      void pushStateToCloud(currentUserId, state);
    }, 850);

    return () => window.clearTimeout(timer);
  }, [state, user?.id, pushStateToCloud]);

  const syncNow = useCallback(async () => {
    if (!user?.id) return;
    await pushStateToCloud(user.id, stateRef.current);
  }, [user?.id, pushStateToCloud]);

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
      setState(normalizePartialState(parsed));
      return true;
    } catch {
      return false;
    }
  }, []);

  const resetAllProgress = useCallback(() => {
    setState(EMPTY_STATE);
    window.localStorage.removeItem(STORAGE_KEY);
    if (user?.id) {
      void pushStateToCloud(user.id, EMPTY_STATE);
    }
  }, [user?.id, pushStateToCloud]);

  const value = useMemo<CourseStoreContextValue>(
    () => ({
      state,
      route,
      syncStatus,
      lastSyncedAt,
      syncNow,
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
      syncStatus,
      lastSyncedAt,
      syncNow,
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
