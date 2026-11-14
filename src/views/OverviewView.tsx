import React, { useMemo } from 'react';
import type { CourseData } from '../types/course';
import { parseHashToRoute, useCourseStore } from '../state/useCourseStore';
import { RichHtml } from '../components/RichHtml';

interface OverviewViewProps {
  course: CourseData;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ course }) => {
  const { state, navigate } = useCourseStore();

  const summary = useMemo(() => {
    const attempts = Object.values(state.questionAttempts).filter((a) => a.checked);
    const solved = attempts.length;
    const correct = attempts.filter((a) => a.isCorrect).length;
    const stepsDone = Object.values(state.completedSteps).filter(Boolean).length;
    const wordsMastered = Object.values(state.vocabProgress).filter(
      (w) => w.status === 'mastered'
    ).length;
    return { solved, correct, stepsDone, wordsMastered };
  }, [state.questionAttempts, state.completedSteps, state.vocabProgress]);

  const canResume =
    state.lastRouteHash &&
    state.lastRouteHash !== '#/overview' &&
    state.lastRouteHash.startsWith('#/');

  const resumeLabel = useMemo(() => {
    if (!canResume) return '';
    const parsed = parseHashToRoute(state.lastRouteHash);
    if (parsed.kind === 'day') {
      const d = course.days.find((x) => x.day === parsed.day);
      const st = d?.steps.find((s) => s.stepNumber === parsed.step);
      return `Day 0${parsed.day}: ${d?.shortTitle || ''} — Step ${parsed.step} (${
        st?.shortLabel || ''
      })`;
    }
    if (parsed.kind === 'master-plan') {
      return `Part 1 Master Study Plan — Chapter ${parsed.chapter}`;
    }
    if (parsed.kind === 'vocab') return '60-Word Vocabulary Studio';
    if (parsed.kind === 'error-log') return 'Diagnostic Error Log';
    return 'Previous Session';
  }, [canResume, state.lastRouteHash, course.days]);

  return (
    <div className="course-page-shell">
      {/* Editorial Course Banner */}
      <section className="editorial-hero">
        <div className="hero-eyebrow">
          <span>OFFICIAL BLUEBOOK-ALIGNED CURRICULUM</span>
          <span className="dot-sep">·</span>
          <span>TARGET EXAM: DECEMBER 5, 2026</span>
        </div>

        <h1 className="hero-title">
          Digital SAT 1400+ Intensive Coursebook for International Learners
        </h1>

        <p className="hero-lead">
          A structured seven-day curriculum engineered for non-native English speakers climbing from{' '}
          <strong>1200 (560 R&amp;W / 640 Math)</strong> toward <strong>1400+</strong>—combining
          clause-stripping comprehension, contextual vocabulary independence without translation,
          and high-speed Desmos fluency.
        </p>

        {/* Student Profile & Live Course Ledger */}
        <div className="ledger-strip">
          <div className="ledger-cell">
            <span className="ledger-kicker">Baseline → Target</span>
            <strong className="ledger-val mono-num">1200 → 1400+</strong>
            <span className="ledger-sub">R&amp;W 560→670+ · Math 640→730+</span>
          </div>
          <div className="ledger-cell">
            <span className="ledger-kicker">Course Steps Completed</span>
            <strong className="ledger-val mono-num">{summary.stepsDone} / 70</strong>
            <span className="ledger-sub">7 Daily Modules × 10 Steps</span>
          </div>
          <div className="ledger-cell">
            <span className="ledger-kicker">Practice Questions Checked</span>
            <strong className="ledger-val mono-num">
              {summary.solved} / {course.stats.totalQuestions}
            </strong>
            <span className="ledger-sub">
              {summary.solved > 0
                ? `${Math.round((summary.correct / summary.solved) * 100)}% cumulative accuracy`
                : '125 R&W · 107 Math (MC + SPR)'}
            </span>
          </div>
          <div className="ledger-cell">
            <span className="ledger-kicker">Academic Word Core</span>
            <strong className="ledger-val mono-num">
              {summary.wordsMastered} / {course.stats.totalVocabWords}
            </strong>
            <span className="ledger-sub">3-Layer Spaced Retrieval</span>
          </div>
        </div>

        <div className="hero-cta-row">
          {canResume ? (
            <button
              type="button"
              className="btn-primary btn-lg"
              onClick={() => navigate(state.lastRouteHash)}
            >
              Resume: {resumeLabel} →
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary btn-lg"
              onClick={() => navigate({ kind: 'day', day: 1, step: 1 })}
            >
              Begin Day 01 Learning Module →
            </button>
          )}
          <button
            type="button"
            className="btn-secondary btn-lg"
            onClick={() => navigate({ kind: 'master-plan', chapter: 1 })}
          >
            Read 7-Day Master Roadmap (Part 1)
          </button>
        </div>
      </section>

      {/* Hierarchical 7-Day Syllabus Grid */}
      <section className="syllabus-overview-section">
        <div className="section-heading-row">
          <div>
            <div className="section-kicker">PART 2 · DAILY LEARNING PACKAGES</div>
            <h2>Seven-Day Intensive Syllabus</h2>
          </div>
          <span className="section-meta-note">4–5 active study hours per day · 10 structured lessons &amp; drills each</span>
        </div>

        <div className="day-cards-grid">
          {course.days.map((d) => {
            const doneSteps = d.steps.filter(
              (s) => state.completedSteps[`d${d.day}-s${s.stepNumber}`]
            ).length;
            const dayQuestions = [...d.rwPractice.questions, ...d.mathPractice.questions];
            const solvedCount = dayQuestions.filter(
              (q) => state.questionAttempts[q.id]?.checked
            ).length;
            const pct = Math.round((doneSteps / 10) * 100);

            return (
              <article key={d.day} className="day-syllabus-card">
                <div className="day-card-top">
                  <span className="day-badge mono-num">DAY 0{d.day}</span>
                  <span className="day-date-text">{d.dateLabel}</span>
                </div>

                <h3 className="day-card-title">
                  <button
                    type="button"
                    className="day-card-title-link"
                    onClick={() => navigate({ kind: 'day', day: d.day, step: 1 })}
                  >
                    {d.shortTitle}
                  </button>
                </h3>

                <p className="day-card-theme">{d.theme}</p>

                <div className="day-card-specs mono-num">
                  <span>{d.rwPractice.questions.length} R&amp;W Qs</span>
                  <span>·</span>
                  <span>{d.mathPractice.questions.length} Math Qs</span>
                  <span>·</span>
                  <span>{d.studyBudget.replace(/\s*\(excluding breaks\)/i, '')}</span>
                </div>

                <div className="day-card-footer">
                  <div className="day-mini-progress">
                    <div className="day-mini-bar">
                      <div className="day-mini-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="mono-num">
                      {doneSteps}/10 steps · {solvedCount}/{dayQuestions.length} Qs
                    </span>
                  </div>
                  <div className="day-quick-links">
                    <button
                      type="button"
                      className="btn-text-action"
                      onClick={() => navigate({ kind: 'day', day: d.day, step: 1 })}
                    >
                      Open Day {d.day} →
                    </button>
                  </div>
                </div>
              </article>
            );
          })}

          {/* Studio Launcher Card */}
          <article className="day-syllabus-card studio-highlight-card">
            <div className="day-card-top">
              <span className="day-badge badge-ochre">LIVE STUDIOS</span>
              <span className="day-date-text">Persistent Daily Companions</span>
            </div>
            <h3 className="day-card-title">Vocabulary &amp; Diagnostic Error Studios</h3>
            <p className="day-card-theme">
              Review all 60 core academic SAT words with 3-layer flashcards, write your own English
              sentences, and track recurring E1–E10 / V1–V7 patterns across the entire 21-day
              runway.
            </p>
            <div className="studio-btn-pair">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate({ kind: 'vocab', tab: 'notebook' })}
              >
                60-Word Vocab Studio →
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate({ kind: 'error-log', tab: 'log' })}
              >
                Error Log &amp; Reflections →
              </button>
            </div>
          </article>
        </div>
      </section>

      {/* Complete Authored README Guide */}
      <section className="authored-readme-sheet">
        <div className="section-kicker">COMPLETE WORKBOOK INDEX &amp; STUDY GUIDE</div>
        {course.overview.sections.map((sec) => (
          <div key={sec.id} className="readme-section-block">
            <h2>{sec.title}</h2>
            <RichHtml html={sec.html} />
          </div>
        ))}
      </section>
    </div>
  );
};
