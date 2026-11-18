import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../state/useAuth';
import { useCourseStore } from '../state/useCourseStore';
import type { CourseData } from '../types/course';
import type { CourseProgressRow, ProfileRow } from '../types/supabase';
import {
  buildStudentOverviewRecords,
  filterAndSortStudents,
  type RosterSortKey,
  type StudentOverviewRecord,
} from '../utils/adminAnalytics';

interface AdminDashboardViewProps {
  course: CourseData;
}

type DrilldownTab = 'days' | 'questions' | 'errors' | 'notes';

function formatRelativeTime(iso: string): string {
  const ts = Date.parse(iso);
  if (!ts || Number.isNaN(ts) || ts <= 0) return 'Never';
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 14) return `${diffDays}d ago`;
  return new Date(ts).toLocaleDateString();
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ course }) => {
  const { user, isAdmin, openAuthModal, claimInstructorAdmin } = useAuth();
  const { navigate } = useCourseStore();

  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [progressRows, setProgressRows] = useState<CourseProgressRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<RosterSortKey>('recent');
  const [hideOwnAccount, setHideOwnAccount] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [drillTab, setDrillTab] = useState<DrilldownTab>('days');

  const [unlockCode, setUnlockCode] = useState('');
  const [unlockMsg, setUnlockMsg] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  const loadCohortData = useCallback(async () => {
    if (!user || !isAdmin) return;
    setLoading(true);
    setFetchError(null);

    const [profRes, progRes] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('course_progress').select('*'),
    ]);

    setLoading(false);

    if (profRes.error || progRes.error) {
      setFetchError(
        profRes.error?.message || progRes.error?.message || 'Unable to load student records.'
      );
      return;
    }

    setProfiles(profRes.data || []);
    setProgressRows(progRes.data || []);
  }, [user, isAdmin]);

  useEffect(() => {
    void loadCohortData();
  }, [loadCohortData]);

  const allRecords = useMemo(() => {
    const built = buildStudentOverviewRecords(profiles, progressRows, course);
    return hideOwnAccount && user
      ? built.filter((r) => r.userId !== user.id)
      : built;
  }, [profiles, progressRows, course, hideOwnAccount, user]);

  const visibleRecords = useMemo(
    () => filterAndSortStudents(allRecords, searchQuery, sortBy),
    [allRecords, searchQuery, sortBy]
  );

  useEffect(() => {
    if (visibleRecords.length === 0) {
      setSelectedUserId(null);
      return;
    }
    if (!selectedUserId || !visibleRecords.some((r) => r.userId === selectedUserId)) {
      setSelectedUserId(visibleRecords[0].userId);
    }
  }, [visibleRecords, selectedUserId]);

  const selectedStudent: StudentOverviewRecord | null = useMemo(
    () => visibleRecords.find((r) => r.userId === selectedUserId) || null,
    [visibleRecords, selectedUserId]
  );

  const cohortKpis = useMemo(() => {
    const total = allRecords.length;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const active7d = allRecords.filter(
      (r) => Date.parse(r.lastActiveAt) >= sevenDaysAgo
    ).length;
    const avgSteps =
      total > 0
        ? Math.round(
            (allRecords.reduce((acc, r) => acc + r.completedSteps, 0) / total) * 10
          ) / 10
        : 0;
    const totalSolved = allRecords.reduce((acc, r) => acc + r.solvedQuestions, 0);
    const totalCorrect = allRecords.reduce((acc, r) => acc + r.correctQuestions, 0);
    const cohortAcc =
      totalSolved > 0 ? `${Math.round((totalCorrect / totalSolved) * 100)}%` : '—';

    return { total, active7d, avgSteps, cohortAcc, totalSolved };
  }, [allRecords]);

  if (!user || !isAdmin) {
    return (
      <div className="course-page-shell">
        <section className="reading-sheet admin-restricted-card">
          <span className="section-kicker">INSTRUCTOR PORTAL · ACCESS RESTRICTED</span>
          <h2>Course Instructor Sign-In Required</h2>
          <p>
            This cohort dashboard is reserved for the course instructor. Sign in with your
            approved instructor account or enter your Instructor Access Code below.
          </p>

          {!user ? (
            <div className="hero-cta-row">
              <button type="button" className="btn-primary" onClick={openAuthModal}>
                Sign In as Instructor →
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate({ kind: 'overview' })}
              >
                ← Back to Course Hub
              </button>
            </div>
          ) : (
            <div className="admin-unlock-inline-form">
              <div className="instructor-claim-row">
                <input
                  type="password"
                  placeholder="Enter Instructor Access Code"
                  value={unlockCode}
                  onChange={(e) => setUnlockCode(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-primary"
                  disabled={unlocking}
                  onClick={async () => {
                    setUnlocking(true);
                    setUnlockMsg('');
                    const res = await claimInstructorAdmin(unlockCode);
                    setUnlocking(false);
                    setUnlockMsg(res.message || '');
                  }}
                >
                  {unlocking ? 'Verifying…' : 'Unlock Instructor Dashboard'}
                </button>
              </div>
              {unlockMsg && <p className="modal-status-msg">{unlockMsg}</p>}
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate({ kind: 'overview' })}
              >
                ← Back to Course Hub
              </button>
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="course-page-shell">
      {/* Masthead */}
      <section className="editorial-hero admin-hero-banner">
        <div className="admin-hero-top">
          <div>
            <div className="hero-eyebrow">
              <span>INSTRUCTOR COHORT PORTAL</span>
              <span className="dot-sep">·</span>
              <span>READ-ONLY STUDENT INSPECTOR</span>
            </div>
            <h1 className="hero-title">Student Progress &amp; Diagnostic Overview</h1>
            <p className="hero-lead">
              Monitor step completion, R&amp;W vs. Math practice accuracy, recurring{' '}
              <code>E1–E10</code> / <code>V1–V7</code> mistake patterns, and daily reflections
              across your enrolled students.
            </p>
          </div>

          <button
            type="button"
            className="btn-secondary"
            onClick={loadCohortData}
            disabled={loading}
          >
            {loading ? 'Refreshing…' : '↻ Refresh Roster'}
          </button>
        </div>

        <div className="ledger-strip">
          <div className="ledger-cell">
            <span className="ledger-kicker">Registered Accounts</span>
            <strong className="ledger-val mono-num">{cohortKpis.total}</strong>
            <span className="ledger-sub">{cohortKpis.active7d} active in last 7 days</span>
          </div>
          <div className="ledger-cell">
            <span className="ledger-kicker">Average Steps Done</span>
            <strong className="ledger-val mono-num">{cohortKpis.avgSteps} / 70</strong>
            <span className="ledger-sub">Across 7 Daily Learning Packages</span>
          </div>
          <div className="ledger-cell">
            <span className="ledger-kicker">Cohort Practice Accuracy</span>
            <strong className="ledger-val mono-num">{cohortKpis.cohortAcc}</strong>
            <span className="ledger-sub">{cohortKpis.totalSolved} total items graded</span>
          </div>
          <div className="ledger-cell">
            <span className="ledger-kicker">Data Isolation</span>
            <strong className="ledger-val mono-num">Read-Only</strong>
            <span className="ledger-sub">Inspecting never overwrites student work</span>
          </div>
        </div>
      </section>

      {fetchError && <div className="auth-banner auth-banner-error">{fetchError}</div>}

      {/* Roster Filter & Table */}
      <section className="reading-sheet-wide admin-roster-sheet">
        <div className="admin-toolbar">
          <input
            type="search"
            className="admin-search-input"
            placeholder="Search student by name or email…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="admin-toolbar-right">
            <label className="admin-checkbox-toggle">
              <input
                type="checkbox"
                checked={hideOwnAccount}
                onChange={(e) => setHideOwnAccount(e.target.checked)}
              />
              <span>Hide my instructor account</span>
            </label>

            <select
              aria-label="Sort students by"
              className="admin-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as RosterSortKey)}
            >
              <option value="recent">Sort: Last Active</option>
              <option value="steps">Sort: Steps Completed</option>
              <option value="solved">Sort: Questions Checked</option>
              <option value="accuracy">Sort: Accuracy %</option>
              <option value="errors">Sort: Error Log Count</option>
            </select>
          </div>
        </div>

        {visibleRecords.length === 0 ? (
          <div className="admin-empty-state">
            <p>
              {loading
                ? 'Loading student roster from Supabase…'
                : 'No student accounts match the current filter yet. Once students sign in with Google or Email, their live progress appears here automatically.'}
            </p>
          </div>
        ) : (
          <div className="table-scroll-wrap">
            <table className="course-table admin-roster-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Target</th>
                  <th>Steps</th>
                  <th>Practice</th>
                  <th>R&amp;W Acc</th>
                  <th>Math Acc</th>
                  <th>Vocab</th>
                  <th>Error Log</th>
                  <th>Last Active</th>
                  <th>Inspect</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map((stu) => {
                  const isSelected = stu.userId === selectedStudent?.userId;
                  return (
                    <tr
                      key={stu.userId}
                      className={isSelected ? 'admin-row-selected' : ''}
                      onClick={() => setSelectedUserId(stu.userId)}
                    >
                      <td>
                        <div className="admin-student-cell">
                          <strong>
                            {stu.displayName}
                            {stu.userId === user.id ? ' (You)' : ''}
                          </strong>
                          <span>{stu.email || 'No email'}</span>
                        </div>
                      </td>
                      <td className="mono-num">{stu.targetScore}</td>
                      <td className="mono-num">{stu.completedSteps}/70</td>
                      <td className="mono-num">
                        {stu.solvedQuestions}/{course.stats.totalQuestions}
                      </td>
                      <td className="mono-num">
                        {stu.rwAccuracyPct !== null ? `${stu.rwAccuracyPct}%` : '—'}
                      </td>
                      <td className="mono-num">
                        {stu.mathAccuracyPct !== null ? `${stu.mathAccuracyPct}%` : '—'}
                      </td>
                      <td className="mono-num">
                        {stu.masteredWords}/{course.stats.totalVocabWords}
                      </td>
                      <td className="mono-num">
                        {stu.errorLogCount}
                        {stu.recurringErrorCodes.length > 0 && (
                          <span className="admin-alert-chip">
                            {stu.recurringErrorCodes.join(', ')}
                          </span>
                        )}
                      </td>
                      <td className="mono-num">{formatRelativeTime(stu.lastActiveAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-text-action"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedUserId(stu.userId);
                          }}
                        >
                          {isSelected ? 'Selected ✓' : 'Inspect →'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Selected Student Drill-Down Inspector */}
      {selectedStudent && (
        <section className="reading-sheet-wide admin-drilldown-sheet">
          <div className="admin-drill-header">
            <div>
              <span className="section-kicker">STUDENT DRILL-DOWN INSPECTOR</span>
              <h2>
                {selectedStudent.displayName}{' '}
                <span className="admin-drill-email">({selectedStudent.email || 'No email'})</span>
              </h2>
              <p className="admin-drill-meta mono-num">
                Target: {selectedStudent.targetScore} · Exam: {selectedStudent.examDate} · Last
                Location: {selectedStudent.lastRouteHash} · Overall Accuracy:{' '}
                {selectedStudent.overallAccuracyPct !== null
                  ? `${selectedStudent.overallAccuracyPct}% (${selectedStudent.correctQuestions}/${selectedStudent.solvedQuestions})`
                  : 'No graded items yet'}
              </p>
            </div>
          </div>

          <div className="admin-drill-tabs">
            <button
              type="button"
              className={`chapter-tab-btn ${drillTab === 'days' ? 'is-active' : ''}`}
              onClick={() => setDrillTab('days')}
            >
              1. 7-Day Module Progress
            </button>
            <button
              type="button"
              className={`chapter-tab-btn ${drillTab === 'questions' ? 'is-active' : ''}`}
              onClick={() => setDrillTab('questions')}
            >
              2. Missed &amp; Flagged Qs ({selectedStudent.missedOrFlaggedQuestions.length})
            </button>
            <button
              type="button"
              className={`chapter-tab-btn ${drillTab === 'errors' ? 'is-active' : ''}`}
              onClick={() => setDrillTab('errors')}
            >
              3. Diagnostic Error Log ({selectedStudent.errorEntries.length})
            </button>
            <button
              type="button"
              className={`chapter-tab-btn ${drillTab === 'notes' ? 'is-active' : ''}`}
              onClick={() => setDrillTab('notes')}
            >
              4. Vocab Sentences &amp; Reflections (
              {selectedStudent.writtenVocabItems.length + selectedStudent.reflections.length})
            </button>
          </div>

          {drillTab === 'days' && (
            <div className="admin-days-grid">
              {selectedStudent.dayBreakdown.map((d) => {
                const stepPct = Math.round((d.completedSteps / d.totalSteps) * 100);
                const accStr =
                  d.solvedQuestions > 0
                    ? `${Math.round((d.correctQuestions / d.solvedQuestions) * 100)}% acc`
                    : 'Not started';
                return (
                  <div key={d.day} className="admin-day-card">
                    <div className="day-card-top">
                      <span className="day-badge mono-num">DAY 0{d.day}</span>
                      <span className="mono-num admin-day-acc">{accStr}</span>
                    </div>
                    <strong>{d.shortTitle}</strong>
                    <div className="day-mini-bar">
                      <div className="day-mini-fill" style={{ width: `${stepPct}%` }} />
                    </div>
                    <div className="admin-day-stats mono-num">
                      <span>
                        {d.completedSteps}/{d.totalSteps} steps
                      </span>
                      <span>
                        {d.solvedQuestions}/{d.totalQuestions} Qs checked
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {drillTab === 'questions' && (
            <div>
              {selectedStudent.missedOrFlaggedQuestions.length === 0 ? (
                <p className="admin-empty-sub">
                  No missed or flagged practice questions recorded yet for this student.
                </p>
              ) : (
                <div className="table-scroll-wrap">
                  <table className="course-table">
                    <thead>
                      <tr>
                        <th>Question ID</th>
                        <th>Section · Skill</th>
                        <th>Difficulty</th>
                        <th>Student Answer</th>
                        <th>Correct Key</th>
                        <th>Flags &amp; Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedStudent.missedOrFlaggedQuestions.map((q) => (
                        <tr key={q.questionId}>
                          <td className="mono-num">
                            <strong>{q.questionId}</strong>
                          </td>
                          <td>
                            {q.section} · {q.skill || q.domain}
                          </td>
                          <td>{q.difficulty}</td>
                          <td className="mono-num">{q.studentResponse}</td>
                          <td className="mono-num">{q.correctAnswer}</td>
                          <td className="mono-num">
                            {!q.isCorrect ? '✗ Missed ' : '✓ Right '}
                            {q.flagged ? '· ⚑ Flagged ' : ''}
                            {q.confidence ? `· [${q.confidence}]` : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {drillTab === 'errors' && (
            <div>
              {selectedStudent.recurringErrorCodes.length > 0 && (
                <div className="auth-banner auth-banner-error">
                  <strong>3+ Recurring Escalation Alert:</strong>{' '}
                  {selectedStudent.recurringErrorCodes.join(' · ')}
                </div>
              )}

              {selectedStudent.errorEntries.length === 0 ? (
                <p className="admin-empty-sub">
                  This student has not logged any Error Log entries yet.
                </p>
              ) : (
                <div className="table-scroll-wrap">
                  <table className="course-table">
                    <thead>
                      <tr>
                        <th>Date / QID</th>
                        <th>Section &amp; Topic</th>
                        <th>Codes</th>
                        <th>Why Missed</th>
                        <th>Next-Time Rule</th>
                        <th>Cold Re-Solve</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedStudent.errorEntries.map((err) => (
                        <tr key={err.id}>
                          <td className="mono-num">
                            {err.dateLabel}
                            {err.questionId ? ` · ${err.questionId}` : ''}
                          </td>
                          <td>
                            {err.section} · {err.topic}
                          </td>
                          <td className="mono-num">
                            {[err.eCode, err.vCode].filter(Boolean).join(' / ') || '—'}
                          </td>
                          <td>{err.whyMissed}</td>
                          <td>{err.nextTimeRule}</td>
                          <td className="mono-num">{err.coldResolveStatus}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {drillTab === 'notes' && (
            <div className="admin-notes-split">
              <div>
                <h3>Vocabulary Mastery &amp; Student Sentences</h3>
                {selectedStudent.writtenVocabItems.length === 0 ? (
                  <p className="admin-empty-sub">
                    No mastered words, starred entries, or personal English sentences recorded yet.
                  </p>
                ) : (
                  <ul className="admin-vocab-list">
                    {selectedStudent.writtenVocabItems.map((v) => (
                      <li key={v.id}>
                        <strong>{v.word}</strong>{' '}
                        <span className="mono-num">
                          [{v.status}
                          {v.starred ? ' ★' : ''}]
                        </span>
                        {v.mySentence && <p>“{v.mySentence}”</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3>Daily 15-Minute Reflections</h3>
                {selectedStudent.reflections.length === 0 ? (
                  <p className="admin-empty-sub">No daily reflection cards filled out yet.</p>
                ) : (
                  <div className="admin-reflection-stack">
                    {selectedStudent.reflections.map((r) => (
                      <div key={r.day} className="admin-reflection-card">
                        <strong>Day 0{r.day} Reflection</strong>
                        {r.improvedToday && (
                          <p>
                            <em>Improved:</em> {r.improvedToday}
                          </p>
                        )}
                        {r.recurringMistake && (
                          <p>
                            <em>Recurring Mistake:</em> {r.recurringMistake}
                          </p>
                        )}
                        {r.vocabRetained && (
                          <p>
                            <em>Vocab Retained:</em> {r.vocabRetained}
                          </p>
                        )}
                        {r.pacingNotes && (
                          <p>
                            <em>Pacing:</em> {r.pacingNotes}
                          </p>
                        )}
                        {r.tomorrowPriority && (
                          <p>
                            <em>Next Priority:</em> {r.tomorrowPriority}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
