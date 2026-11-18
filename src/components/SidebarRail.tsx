import React, { useEffect, useMemo, useState } from 'react';
import type { CourseData } from '../types/course';
import { useAuth } from '../state/useAuth';
import { useCourseStore } from '../state/useCourseStore';

interface SidebarRailProps {
  course: CourseData;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const SidebarRail: React.FC<SidebarRailProps> = ({
  course,
  mobileOpen,
  onCloseMobile,
}) => {
  const { isAdmin } = useAuth();
  const { state, route, navigate } = useCourseStore();
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>(() => ({
    1: true,
    ...(route.kind === 'day' ? { [route.day]: true } : {}),
  }));
  const [planExpanded, setPlanExpanded] = useState<boolean>(route.kind === 'master-plan');

  useEffect(() => {
    if (route.kind === 'day') {
      setExpandedDays((prev) => ({ ...prev, [route.day]: true }));
    } else if (route.kind === 'master-plan') {
      setPlanExpanded(true);
    }
  }, [route]);

  const metrics = useMemo(() => {
    const attempts = Object.values(state.questionAttempts).filter((a) => a.checked);
    const solved = attempts.length;
    const correct = attempts.filter((a) => a.isCorrect).length;
    const masteredWords = Object.values(state.vocabProgress).filter(
      (v) => v.status === 'mastered'
    ).length;

    // Count recurring error codes >= 3
    const codeCounts: Record<string, number> = {};
    for (const entry of state.errorEntries) {
      if (entry.eCode) codeCounts[entry.eCode] = (codeCounts[entry.eCode] || 0) + 1;
      if (entry.vCode) codeCounts[entry.vCode] = (codeCounts[entry.vCode] || 0) + 1;
    }
    const escalations = Object.values(codeCounts).filter((c) => c >= 3).length;

    return { solved, correct, masteredWords, escalations };
  }, [state.questionAttempts, state.vocabProgress, state.errorEntries]);

  const handleNav = (hashOrRoute: Parameters<typeof navigate>[0]) => {
    navigate(hashOrRoute);
    onCloseMobile();
  };

  const toggleDayAccordion = (day: number) => {
    setExpandedDays((prev) => ({ ...prev, [day]: !prev[day] }));
  };

  const solvedPct = Math.round((metrics.solved / course.stats.totalQuestions) * 100);

  return (
    <>
      {mobileOpen && <div className="sidebar-backdrop" onClick={onCloseMobile} />}
      <aside className={`syllabus-rail ${mobileOpen ? 'is-open' : ''}`} aria-label="Course Syllabus">
        <div className="rail-masthead">
          <div className="rail-cohort-kicker">DEC 5, 2026 COHORT · ESL TRACK</div>
          <button
            type="button"
            className="rail-course-title"
            onClick={() => handleNav({ kind: 'overview' })}
          >
            Digital SAT 1400+ Intensive
          </button>
          <p className="rail-course-sub">1200 → 1400+ Curriculum &amp; Daily Coursebook</p>

          <div className="rail-progress-box">
            <div className="rail-progress-row">
              <span>Practice Bank</span>
              <span className="mono-num">
                {metrics.solved}/{course.stats.totalQuestions}
              </span>
            </div>
            <div className="rail-meter" role="progressbar" aria-valuenow={solvedPct} aria-valuemin={0} aria-valuemax={100}>
              <div className="rail-meter-fill" style={{ width: `${solvedPct}%` }} />
            </div>
            <div className="rail-mini-stats">
              <span>
                Vocab Mastered:{' '}
                <strong className="mono-num">
                  {metrics.masteredWords}/{course.stats.totalVocabWords}
                </strong>
              </span>
              {metrics.solved > 0 && (
                <span>
                  Acc:{' '}
                  <strong className="mono-num">
                    {Math.round((metrics.correct / metrics.solved) * 100)}%
                  </strong>
                </span>
              )}
            </div>
          </div>
        </div>

        <nav className="rail-scroll">
          {/* Group 1: Foundations */}
          <div className="rail-group">
            <div className="rail-group-heading">Course Foundations</div>
            <button
              type="button"
              className={`rail-item ${route.kind === 'overview' ? 'is-active' : ''}`}
              onClick={() => handleNav({ kind: 'overview' })}
            >
              <span className="rail-item-index">00</span>
              <span className="rail-item-label">Syllabus &amp; Course Hub</span>
            </button>

            <div className="rail-accordion">
              <div className={`rail-item-split ${route.kind === 'master-plan' ? 'is-active-parent' : ''}`}>
                <button
                  type="button"
                  className="rail-item-main"
                  onClick={() => handleNav({ kind: 'master-plan', chapter: 1 })}
                >
                  <span className="rail-item-index">P1</span>
                  <span className="rail-item-label">7-Day Master Study Plan</span>
                </button>
                <button
                  type="button"
                  className="rail-chevron-btn"
                  aria-label="Toggle Master Plan Chapters"
                  onClick={() => setPlanExpanded((v) => !v)}
                >
                  {planExpanded ? '▾' : '▸'}
                </button>
              </div>
              {planExpanded && (
                <div className="rail-sublist">
                  {course.masterPlan.chapters.map((ch) => {
                    const active = route.kind === 'master-plan' && route.chapter === ch.number;
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        className={`rail-subitem ${active ? 'is-active' : ''}`}
                        onClick={() => handleNav({ kind: 'master-plan', chapter: ch.number })}
                      >
                        <span className="rail-sub-num">{ch.number}.</span>
                        <span className="rail-sub-text">{ch.title}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Group 2: Daily Modules */}
          <div className="rail-group">
            <div className="rail-group-heading">Part 2 · Daily Modules</div>
            {course.days.map((d) => {
              const isDayOpen = Boolean(expandedDays[d.day]);
              const isDayActive = route.kind === 'day' && route.day === d.day;
              const completedCount = d.steps.filter(
                (st) => state.completedSteps[`d${d.day}-s${st.stepNumber}`]
              ).length;

              return (
                <div key={d.day} className="rail-day-block">
                  <div className={`rail-day-header ${isDayActive ? 'is-active-day' : ''}`}>
                    <button
                      type="button"
                      className="rail-day-trigger"
                      onClick={() => {
                        if (!isDayActive) {
                          handleNav({ kind: 'day', day: d.day, step: 1 });
                        } else {
                          toggleDayAccordion(d.day);
                        }
                      }}
                    >
                      <div className="rail-day-top">
                        <span className="rail-day-pill">DAY 0{d.day}</span>
                        <span className="rail-day-date">{d.dateLabel.replace(', 2026', '')}</span>
                        <span className="rail-day-fraction mono-num">{completedCount}/10</span>
                      </div>
                      <div className="rail-day-title">{d.shortTitle}</div>
                    </button>
                    <button
                      type="button"
                      className="rail-chevron-btn"
                      aria-label={`Toggle Day ${d.day} steps`}
                      onClick={() => toggleDayAccordion(d.day)}
                    >
                      {isDayOpen ? '▾' : '▸'}
                    </button>
                  </div>

                  {isDayOpen && (
                    <div className="rail-sublist rail-steps-list">
                      {d.steps.map((st) => {
                        const isStepActive =
                          route.kind === 'day' &&
                          route.day === d.day &&
                          route.step === st.stepNumber;
                        const isDone = Boolean(
                          state.completedSteps[`d${d.day}-s${st.stepNumber}`]
                        );
                        return (
                          <button
                            key={st.stepNumber}
                            type="button"
                            className={`rail-subitem ${isStepActive ? 'is-active' : ''} ${
                              isDone ? 'is-done' : ''
                            }`}
                            onClick={() =>
                              handleNav({ kind: 'day', day: d.day, step: st.stepNumber })
                            }
                          >
                            <span className="rail-step-check" aria-hidden="true">
                              {isDone ? '✓' : `${st.stepNumber}.`}
                            </span>
                            <span className="rail-sub-text">{st.shortLabel}</span>
                            {st.badge && <span className="rail-step-badge">{st.badge}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Group 3: Live Student Studios */}
          <div className="rail-group">
            <div className="rail-group-heading">Active Study Studios</div>
            <button
              type="button"
              className={`rail-item ${route.kind === 'vocab' ? 'is-active' : ''}`}
              onClick={() => handleNav({ kind: 'vocab', tab: 'notebook' })}
            >
              <span className="rail-item-index">VB</span>
              <span className="rail-item-label">60-Word Vocab Studio</span>
              <span className="rail-pill-count mono-num">60</span>
            </button>

            <button
              type="button"
              className={`rail-item ${route.kind === 'error-log' ? 'is-active' : ''}`}
              onClick={() => handleNav({ kind: 'error-log', tab: 'log' })}
            >
              <span className="rail-item-index">EL</span>
              <span className="rail-item-label">Diagnostic Error Log</span>
              {metrics.escalations > 0 ? (
                <span className="rail-pill-alert mono-num">{metrics.escalations}× 3+</span>
              ) : (
                <span className="rail-pill-count mono-num">{state.errorEntries.length}</span>
              )}
            </button>
          </div>

          {isAdmin && (
            <div className="rail-group">
              <div className="rail-group-heading">Instructor Administration</div>
              <button
                type="button"
                className={`rail-item ${route.kind === 'admin' ? 'is-active' : ''}`}
                onClick={() => handleNav({ kind: 'admin' })}
              >
                <span className="rail-item-index">IN</span>
                <span className="rail-item-label">Student Cohort Inspector</span>
              </button>
            </div>
          )}
        </nav>
      </aside>
    </>
  );
};
