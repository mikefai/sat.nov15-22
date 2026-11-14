import React, { useEffect, useMemo, useState } from 'react';
import type { CourseData } from '../types/course';
import { DEFAULT_REFLECTION, useCourseStore } from '../state/useCourseStore';
import { RichHtml } from '../components/RichHtml';
import { QuickErrorLogger } from '../components/QuickErrorLogger';

interface ErrorLogViewProps {
  course: CourseData;
  initialTab?: 'log' | 'reflections' | 'taxonomy';
}

export const ErrorLogView: React.FC<ErrorLogViewProps> = ({ course, initialTab = 'log' }) => {
  const { state, navigate, updateErrorStatus, deleteErrorEntry, updateDailyReflection } =
    useCourseStore();

  const [tab, setTab] = useState<'log' | 'reflections' | 'taxonomy'>(initialTab);
  const [sectionFilter, setSectionFilter] = useState<'all' | 'R&W' | 'Math' | 'pending'>('all');
  const [showModels, setShowModels] = useState(true);
  const [activeReflectionDay, setActiveReflectionDay] = useState<number>(1);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  // Detect 3+ Recurring Error Patterns automatically!
  const escalations = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of state.errorEntries) {
      if (e.eCode) counts[e.eCode] = (counts[e.eCode] || 0) + 1;
      if (e.vCode) counts[e.vCode] = (counts[e.vCode] || 0) + 1;
    }

    const codeLookup = new Map<string, string>();
    course.errorLogStudio.eCodes.forEach((c) => codeLookup.set(c.code, c.label));
    course.errorLogStudio.vCodes.forEach((c) => codeLookup.set(c.code, c.label));

    return Object.entries(counts)
      .filter(([, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .map(([code, count]) => ({
        code,
        count,
        label: codeLookup.get(code) || 'Recurring Pattern',
      }));
  }, [state.errorEntries, course.errorLogStudio]);

  const filteredEntries = useMemo(() => {
    return state.errorEntries.filter((entry) => {
      if (sectionFilter === 'R&W' && entry.section !== 'R&W') return false;
      if (sectionFilter === 'Math' && entry.section !== 'Math') return false;
      if (sectionFilter === 'pending' && entry.coldResolveStatus === 'resolved') return false;
      return true;
    });
  }, [state.errorEntries, sectionFilter]);

  const currentReflection =
    state.dailyReflections[String(activeReflectionDay)] || DEFAULT_REFLECTION;

  return (
    <div className="course-page-shell">
      <header className="module-masthead">
        <div className="hero-eyebrow">
          <span>DIAGNOSTIC SCORE-REPAIR ENGINE</span>
          <span className="dot-sep">·</span>
          <span>E1–E10 &amp; V1–V7 TAXONOMY + 3+ ESCALATION</span>
        </div>
        <h1>Digital SAT Error Log &amp; Daily Reflection Workbook</h1>
        <p className="masthead-theme-line">
          Every missed or 50-50 question is diagnostic data. Spend 15–20 minutes each morning
          cold re-solving flagged items from this log without peeking at explanations.
        </p>

        <div className="step-ribbon-bar" role="tablist">
          <button
            type="button"
            className={`ribbon-tab ${tab === 'log' ? 'is-active' : ''}`}
            onClick={() => {
              setTab('log');
              navigate({ kind: 'error-log', tab: 'log' });
            }}
          >
            1. Master Error Log ({state.errorEntries.length})
          </button>
          <button
            type="button"
            className={`ribbon-tab ${tab === 'reflections' ? 'is-active' : ''}`}
            onClick={() => {
              setTab('reflections');
              navigate({ kind: 'error-log', tab: 'reflections' });
            }}
          >
            2. Daily 15-Minute Reflection Cards (Days 1–7)
          </button>
          <button
            type="button"
            className={`ribbon-tab ${tab === 'taxonomy' ? 'is-active' : ''}`}
            onClick={() => {
              setTab('taxonomy');
              navigate({ kind: 'error-log', tab: 'taxonomy' });
            }}
          >
            3. E1–E10 / V1–V7 Taxonomy &amp; 3+ Rule
          </button>
        </div>
      </header>

      {/* Live 3+ Escalation Alert */}
      {escalations.length > 0 && (
        <section className="escalation-alert-banner">
          <div className="escalation-title">
            <strong>⚠ Priority 3+ Recurring Weakness Detected!</strong>
            <span>
              Dedicate the first 15 minutes of your next block to targeted Khan Academy + CB
              Question Bank repair (with &ldquo;Exclude Active Questions&rdquo; ON):
            </span>
          </div>
          <div className="escalation-chips">
            {escalations.map((esc) => (
              <span key={esc.code} className="escalation-pill mono-num">
                {esc.code} ({esc.label}) × {esc.count}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* TAB 1: MASTER LOG */}
      {tab === 'log' && (
        <div className="lessons-stack">
          <QuickErrorLogger
            eCodes={course.errorLogStudio.eCodes}
            vCodes={course.errorLogStudio.vCodes}
          />

          <div className="studio-filter-bar">
            <div className="filter-pills-row">
              {(
                [
                  ['all', `All Logged (${state.errorEntries.length})`],
                  ['R&W', 'Reading & Writing'],
                  ['Math', 'Math'],
                  ['pending', 'Needs Cold Re-Solve'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`filter-chip ${sectionFilter === key ? 'is-active' : ''}`}
                  onClick={() => setSectionFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="btn-text-subtle"
              onClick={() => setShowModels((v) => !v)}
            >
              {showModels ? 'Hide Model Examples' : 'Show Model Examples'}
            </button>
          </div>

          <div className="error-entries-stack">
            {filteredEntries.map((entry) => (
              <article key={entry.id} className="error-entry-card">
                <div className="error-entry-top">
                  <div className="error-tags-left">
                    <span className="q-index-badge">{entry.section}</span>
                    {entry.questionId && (
                      <span className="q-id-code mono-num">{entry.questionId}</span>
                    )}
                    <span className="error-code-pill mono-num">{entry.eCode}</span>
                    {entry.vCode && (
                      <span className="error-code-pill v-code-pill mono-num">{entry.vCode}</span>
                    )}
                    <span className="q-domain-crumb">
                      {entry.topic} · {entry.questionType}
                    </span>
                  </div>

                  <div className="error-actions-right">
                    <span className="entry-date-text">{entry.dateLabel}</span>
                    <select
                      className={`resolve-status-select status-${entry.coldResolveStatus}`}
                      value={entry.coldResolveStatus}
                      onChange={(e) =>
                        updateErrorStatus(
                          entry.id,
                          e.target.value as 'pending' | 'resolved' | 'needs-repair'
                        )
                      }
                      aria-label="Cold Re-Solve Status"
                    >
                      <option value="pending">○ Cold Re-Solve Pending</option>
                      <option value="resolved">✓ Solved Cold</option>
                      <option value="needs-repair">↻ Missed Cold (Repair!)</option>
                    </select>
                    <button
                      type="button"
                      className="btn-text-subtle"
                      onClick={() => deleteErrorEntry(entry.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="error-entry-columns">
                  <div>
                    <span className="layer-tag">Why I Missed It</span>
                    <p>{entry.whyMissed}</p>
                  </div>
                  {entry.correctMethod && (
                    <div>
                      <span className="layer-tag">Correct Rule / Method</span>
                      <p>{entry.correctMethod}</p>
                    </div>
                  )}
                  <div>
                    <span className="layer-tag">Next-Time Firewall Rule</span>
                    <p className="firewall-rule-text">{entry.nextTimeRule}</p>
                  </div>
                </div>
              </article>
            ))}

            {filteredEntries.length === 0 && (
              <div className="empty-studio-state">
                No personal errors logged under this filter yet. Log mistakes above or directly
                from any Practice Question card using <strong>+ Log Mistake</strong>.
              </div>
            )}

            {showModels && (
              <div className="model-entries-section">
                <div className="section-kicker">MODEL REFERENCE ENTRIES (DO NOT WRITE VAGUE REASONS)</div>
                {course.errorLogStudio.modelEntries.map((m) => (
                  <article key={m.id} className="error-entry-card model-error-card">
                    <div className="error-entry-top">
                      <div className="error-tags-left">
                        <span className="q-index-badge">{m.section}</span>
                        <span className="q-domain-crumb">
                          {m.date} · {m.topic} · {m.questionType}
                        </span>
                      </div>
                      <span className="spoiler-tag">MODEL EXAMPLE</span>
                    </div>
                    <div className="error-entry-columns">
                      <div>
                        <span className="layer-tag">Why I Missed It</span>
                        <p>{m.whyMissed}</p>
                      </div>
                      <div>
                        <span className="layer-tag">Correct Rule / Method</span>
                        <p>{m.correctMethod}</p>
                      </div>
                      <div>
                        <span className="layer-tag">What I Will Do Next Time</span>
                        <p className="firewall-rule-text">{m.nextTimeRule}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DAILY REFLECTIONS */}
      {tab === 'reflections' && (
        <div className="lessons-stack">
          <article className="reading-sheet-wide">
            <div className="section-kicker">15-MINUTE END-OF-DAY CONSOLIDATION</div>
            <h2>Interactive Daily Reflection Cards (Days 1–7)</h2>

            <div className="filter-pills-row reflection-day-tabs">
              {course.days.map((d) => (
                <button
                  key={d.day}
                  type="button"
                  className={`filter-chip ${activeReflectionDay === d.day ? 'is-active' : ''}`}
                  onClick={() => setActiveReflectionDay(d.day)}
                >
                  Day {d.day} · {d.dateLabel.replace(', 2026', '')}
                </button>
              ))}
            </div>

            <div className="reflection-journal-card">
              <h3>
                Day 0{activeReflectionDay} End-of-Day Review —{' '}
                {course.days[activeReflectionDay - 1]?.shortTitle}
              </h3>
              <div className="reflection-fields-stack">
                <label>
                  <span>1. Which SAT skill or rule improved noticeably today?</span>
                  <textarea
                    rows={2}
                    value={currentReflection.improvedToday}
                    placeholder="e.g. Clause stripping helped me isolate main verbs on 5/6 SEC questions..."
                    onChange={(e) =>
                      updateDailyReflection(activeReflectionDay, {
                        improvedToday: e.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  <span>2. Which specific mistake pattern (E-code / V-code) appeared more than once?</span>
                  <textarea
                    rows={2}
                    value={currentReflection.recurringMistake}
                    placeholder="e.g. V4 missed contrast pivot twice; E4 forgot to box target expression once..."
                    onChange={(e) =>
                      updateDailyReflection(activeReflectionDay, {
                        recurringMistake: e.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  <span>3. Which academic words did I retain cold vs. miss on retrieval?</span>
                  <textarea
                    rows={2}
                    value={currentReflection.vocabRetained}
                    placeholder="e.g. 9/10 retained; starred 'reconcile' and 'notwithstanding' for tomorrow morning..."
                    onChange={(e) =>
                      updateDailyReflection(activeReflectionDay, {
                        vocabRetained: e.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  <span>4. Did timing or mental translation hurt accuracy today? Where?</span>
                  <textarea
                    rows={2}
                    value={currentReflection.pacingNotes}
                    placeholder="e.g. Stalled 2m15s on dense biology inference Q11 instead of flagging at 75s..."
                    onChange={(e) =>
                      updateDailyReflection(activeReflectionDay, {
                        pacingNotes: e.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  <span>5. What is my #1 concrete repair priority for tomorrow morning&apos;s first 20 minutes?</span>
                  <textarea
                    rows={2}
                    value={currentReflection.tomorrowPriority}
                    placeholder="e.g. Cold re-solve MATH-D1-Q12 & Q13 in Desmos + review starred vocab words..."
                    onChange={(e) =>
                      updateDailyReflection(activeReflectionDay, {
                        tomorrowPriority: e.target.value,
                      })
                    }
                  />
                </label>
              </div>
            </div>
          </article>

          <article className="reading-sheet-wide">
            <RichHtml html={course.errorLogStudio.reflectionGuideHtml} />
          </article>
        </div>
      )}

      {/* TAB 3: TAXONOMY REFERENCE */}
      {tab === 'taxonomy' && (
        <div className="lessons-stack">
          <div className="taxonomy-two-col">
            <article className="reading-sheet">
              <div className="section-kicker">MASTER ERROR CODES</div>
              <h2>Ten Primary Error Categories (E1–E10)</h2>
              <div className="tax-cards-list">
                {course.errorLogStudio.eCodes.map((c) => (
                  <div key={c.code} className="tax-item-row">
                    <span className="error-code-pill mono-num">{c.code}</span>
                    <div>
                      <strong>{c.label}</strong>
                      <p>{c.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="reading-sheet">
              <div className="section-kicker">ESL LANGUAGE SUB-LABELS</div>
              <h2>Seven Vocabulary &amp; Language Codes (V1–V7)</h2>
              <div className="tax-cards-list">
                {course.errorLogStudio.vCodes.map((c) => (
                  <div key={c.code} className="tax-item-row">
                    <span className="error-code-pill v-code-pill mono-num">{c.code}</span>
                    <div>
                      <strong>{c.label}</strong>
                      <p>{c.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <article className="reading-sheet-wide">
            <RichHtml html={course.errorLogStudio.escalationHtml} />
          </article>
        </div>
      )}
    </div>
  );
};
