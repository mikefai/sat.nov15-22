import type {
  CourseData,
  CourseProgressState,
  DailyReflectionEntry,
  PracticeQuestion,
  StudentErrorEntry,
  VocabUserItem,
} from '../types/course';
import type { CourseProgressRow, ProfileRow } from '../types/supabase';

export interface StudentDayBreakdown {
  day: number;
  shortTitle: string;
  completedSteps: number;
  totalSteps: number;
  solvedQuestions: number;
  correctQuestions: number;
  totalQuestions: number;
}

export interface StudentQuestionAuditItem {
  questionId: string;
  day: number;
  section: 'RW' | 'MATH';
  domain: string;
  skill: string;
  difficulty: string;
  studentResponse: string;
  correctAnswer: string;
  isCorrect: boolean;
  flagged: boolean;
  confidence?: 'C' | '?';
}

export interface StudentVocabAuditItem {
  id: string;
  word: string;
  status: VocabUserItem['status'] | 'custom';
  starred: boolean;
  mySentence: string;
}

export interface StudentReflectionAuditItem extends DailyReflectionEntry {
  day: number;
}

export interface StudentOverviewRecord {
  userId: string;
  displayName: string;
  email: string;
  targetScore: number;
  examDate: string;
  lastActiveAt: string;
  lastRouteHash: string;
  completedSteps: number;
  solvedQuestions: number;
  correctQuestions: number;
  overallAccuracyPct: number | null;
  rwSolved: number;
  rwCorrect: number;
  rwAccuracyPct: number | null;
  mathSolved: number;
  mathCorrect: number;
  mathAccuracyPct: number | null;
  masteredWords: number;
  learningWords: number;
  errorLogCount: number;
  recurringErrorCodes: string[];
  dayBreakdown: StudentDayBreakdown[];
  missedOrFlaggedQuestions: StudentQuestionAuditItem[];
  errorEntries: StudentErrorEntry[];
  writtenVocabItems: StudentVocabAuditItem[];
  reflections: StudentReflectionAuditItem[];
}

export function buildStudentOverviewRecords(
  profiles: ProfileRow[],
  progressRows: CourseProgressRow[],
  course: CourseData
): StudentOverviewRecord[] {
  const questionById = new Map<string, PracticeQuestion>();
  for (const d of course.days) {
    for (const q of d.rwPractice.questions) questionById.set(q.id, q);
    for (const q of d.mathPractice.questions) questionById.set(q.id, q);
  }

  const wordById = new Map(course.vocabStudio.words.map((w) => [w.id, w]));
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const progressByUserId = new Map(progressRows.map((r) => [r.user_id, r]));

  const allUserIds = new Set<string>([
    ...profiles.map((p) => p.id),
    ...progressRows.map((r) => r.user_id),
  ]);

  const records: StudentOverviewRecord[] = [];

  for (const userId of allUserIds) {
    const profile = profileById.get(userId);
    const progRow = progressByUserId.get(userId);

    const rawJson =
      progRow && progRow.progress_json && typeof progRow.progress_json === 'object'
        ? (progRow.progress_json as Partial<CourseProgressState>)
        : {};

    const questionAttempts = rawJson.questionAttempts || {};
    const completedStepsMap = rawJson.completedSteps || {};
    const vocabProgress = rawJson.vocabProgress || {};
    const customVocab = Array.isArray(rawJson.customVocab) ? rawJson.customVocab : [];
    const errorEntries = Array.isArray(rawJson.errorEntries) ? rawJson.errorEntries : [];
    const dailyReflections = rawJson.dailyReflections || {};

    let solvedQuestions = 0;
    let correctQuestions = 0;
    let rwSolved = 0;
    let rwCorrect = 0;
    let mathSolved = 0;
    let mathCorrect = 0;
    const missedOrFlaggedQuestions: StudentQuestionAuditItem[] = [];

    for (const [qId, att] of Object.entries(questionAttempts)) {
      if (!att) continue;
      const qMeta = questionById.get(qId);
      const isChecked = Boolean(att.checked);
      const isRight = Boolean(att.isCorrect);

      if (isChecked) {
        solvedQuestions++;
        if (isRight) correctQuestions++;

        if (qMeta?.section === 'RW' || qId.startsWith('RW-')) {
          rwSolved++;
          if (isRight) rwCorrect++;
        } else {
          mathSolved++;
          if (isRight) mathCorrect++;
        }
      }

      if ((isChecked && !isRight) || att.flagged) {
        const studentResponse =
          qMeta?.format === 'SPR'
            ? att.sprInput || '—'
            : att.selectedChoice || att.sprInput || '—';
        missedOrFlaggedQuestions.push({
          questionId: qId,
          day: qMeta?.day || 1,
          section: qMeta?.section || (qId.startsWith('RW-') ? 'RW' : 'MATH'),
          domain: qMeta?.domain || '',
          skill: qMeta?.skill || '',
          difficulty: qMeta?.difficulty || '',
          studentResponse,
          correctAnswer: qMeta?.correctAnswer || '',
          isCorrect: isChecked && isRight,
          flagged: Boolean(att.flagged),
          confidence: att.confidence,
        });
      }
    }

    const dayBreakdown: StudentDayBreakdown[] = course.days.map((d) => {
      const doneSteps = d.steps.filter(
        (s) => completedStepsMap[`d${d.day}-s${s.stepNumber}`]
      ).length;
      const dayQs = [...d.rwPractice.questions, ...d.mathPractice.questions];
      let dSolved = 0;
      let dCorrect = 0;
      for (const q of dayQs) {
        const att = questionAttempts[q.id];
        if (att?.checked) {
          dSolved++;
          if (att.isCorrect) dCorrect++;
        }
      }
      return {
        day: d.day,
        shortTitle: d.shortTitle,
        completedSteps: doneSteps,
        totalSteps: d.steps.length,
        solvedQuestions: dSolved,
        correctQuestions: dCorrect,
        totalQuestions: dayQs.length,
      };
    });

    const completedSteps = Object.values(completedStepsMap).filter(Boolean).length;

    let masteredWords = 0;
    let learningWords = 0;
    const writtenVocabItems: StudentVocabAuditItem[] = [];

    for (const [wId, vItem] of Object.entries(vocabProgress)) {
      if (!vItem) continue;
      if (vItem.status === 'mastered') masteredWords++;
      if (vItem.status === 'learning') learningWords++;

      const wMeta = wordById.get(wId);
      if (vItem.mySentence?.trim() || vItem.starred || vItem.status === 'mastered') {
        writtenVocabItems.push({
          id: wId,
          word: wMeta?.word || wId,
          status: vItem.status,
          starred: Boolean(vItem.starred),
          mySentence: vItem.mySentence || '',
        });
      }
    }

    for (const cv of customVocab) {
      writtenVocabItems.push({
        id: cv.id,
        word: cv.word,
        status: 'custom',
        starred: false,
        mySentence: cv.mySentence || cv.satContext || '',
      });
    }

    const codeCounts = new Map<string, number>();
    for (const err of errorEntries) {
      if (err.eCode) codeCounts.set(err.eCode, (codeCounts.get(err.eCode) || 0) + 1);
      if (err.vCode) codeCounts.set(err.vCode, (codeCounts.get(err.vCode) || 0) + 1);
    }
    const recurringErrorCodes = [...codeCounts.entries()]
      .filter(([, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .map(([code, count]) => `${code} (${count})`);

    const reflections: StudentReflectionAuditItem[] = Object.entries(dailyReflections)
      .filter(
        ([, r]) =>
          r &&
          Boolean(
            r.improvedToday?.trim() ||
              r.recurringMistake?.trim() ||
              r.vocabRetained?.trim() ||
              r.pacingNotes?.trim() ||
              r.tomorrowPriority?.trim()
          )
      )
      .map(([dayKey, r]) => ({
        day: Number(dayKey) || 1,
        ...r,
      }))
      .sort((a, b) => a.day - b.day);

    const email = profile?.email || '';
    const displayName =
      profile?.display_name?.trim() ||
      (email ? email.split('@')[0] : `Student ${userId.slice(0, 6)}`);

    const lastActiveAt =
      progRow?.updated_at || profile?.updated_at || profile?.created_at || new Date(0).toISOString();

    records.push({
      userId,
      displayName,
      email,
      targetScore: profile?.target_score || 1400,
      examDate: profile?.exam_date || '2026-12-05',
      lastActiveAt,
      lastRouteHash: progRow?.last_route_hash || rawJson.lastRouteHash || '#/overview',
      completedSteps,
      solvedQuestions,
      correctQuestions,
      overallAccuracyPct:
        solvedQuestions > 0 ? Math.round((correctQuestions / solvedQuestions) * 100) : null,
      rwSolved,
      rwCorrect,
      rwAccuracyPct: rwSolved > 0 ? Math.round((rwCorrect / rwSolved) * 100) : null,
      mathSolved,
      mathCorrect,
      mathAccuracyPct: mathSolved > 0 ? Math.round((mathCorrect / mathSolved) * 100) : null,
      masteredWords,
      learningWords,
      errorLogCount: errorEntries.length,
      recurringErrorCodes,
      dayBreakdown,
      missedOrFlaggedQuestions,
      errorEntries,
      writtenVocabItems,
      reflections,
    });
  }

  return records.sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
}


export type RosterSortKey = 'recent' | 'steps' | 'solved' | 'accuracy' | 'errors';

export function filterAndSortStudents(
  records: StudentOverviewRecord[],
  searchQuery: string,
  sortBy: RosterSortKey
): StudentOverviewRecord[] {
  const q = searchQuery.trim().toLowerCase();
  const filtered = q
    ? records.filter(
        (r) =>
          r.displayName.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q)
      )
    : [...records];

  return filtered.sort((a, b) => {
    switch (sortBy) {
      case 'steps':
        return b.completedSteps - a.completedSteps || b.solvedQuestions - a.solvedQuestions;
      case 'solved':
        return b.solvedQuestions - a.solvedQuestions || b.completedSteps - a.completedSteps;
      case 'accuracy':
        return (b.overallAccuracyPct ?? -1) - (a.overallAccuracyPct ?? -1);
      case 'errors':
        return b.errorLogCount - a.errorLogCount || b.solvedQuestions - a.solvedQuestions;
      case 'recent':
      default:
        return b.lastActiveAt.localeCompare(a.lastActiveAt);
    }
  });
}
