import React, { useState } from 'react';
import type { CourseData, DayWorkbook, TeachingLesson } from '../types/course';
import { useCourseStore } from '../state/useCourseStore';
import { RichHtml } from '../components/RichHtml';
import { PracticeSetWorkspace } from '../components/PracticeSetWorkspace';
import { QuickErrorLogger } from '../components/QuickErrorLogger';
import { VocabExerciseWorkspace } from '../components/VocabExerciseWorkspace';
import { FloatingStudyTools } from '../components/FloatingStudyTools';

interface DayStepViewProps {
  course: CourseData;
  dayData: DayWorkbook;
  step: number;
}

const InlineChecksPanel: React.FC<{ lesson: TeachingLesson }> = ({ lesson }) => {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  if (lesson.checks.length === 0) return null;

  return (
    <div className="inline-checks-box">
      <div className="inline-checks-header">
        <div>
          <span className="checks-kicker">ACTIVE RETRIEVAL CHECK</span>
          <h4>Verify Lesson Comprehension ({lesson.checks.length} Quick Prompts)</h4>
        </div>
        <button
          type="button"
          className="btn-text-subtle"
          onClick={() => {
            const allOpen = lesson.checks.every((c) => revealed[c.id]);
            const next: Record<string, boolean> = {};
            lesson.checks.forEach((c) => {
              next[c.id] = !allOpen;
            });
            setRevealed(next);
          }}
        >
          {lesson.checks.every((c) => revealed[c.id]) ? 'Hide All Keys' : 'Reveal All Keys'}
        </button>
      </div>

      <div className="inline-checks-stack">
        {lesson.checks.map((chk, idx) => {
          const isOpen = Boolean(revealed[chk.id]);
          return (
            <div key={chk.id} className="cc-interactive-item">
              <div className="cc-top-row">
                <span className="q-index-badge mono-num">Q{idx + 1}</span>
                <span className="cc-id-pill mono-num">{chk.id}</span>
                {chk.promptHtml && (
                  <span
                    className="cc-prompt-preview"
                    dangerouslySetInnerHTML={{ __html: chk.promptHtml }}
                  />
                )}
              </div>
              <div className="cc-input-row">
                <input
                  type="text"
                  className="cc-draft-input"
                  placeholder="Jot your quick answer before revealing the teaching check..."
                  value={drafts[chk.id] || ''}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [chk.id]: e.target.value }))}
                />
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => setRevealed((prev) => ({ ...prev, [chk.id]: !prev[chk.id] }))}
                >
                  {isOpen ? 'Hide Key' : 'Check Answer'}
                </button>
              </div>
              {isOpen && (
                <div className="cc-answer-reveal">
                  <RichHtml html={chk.answerHtml} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const DayStepView: React.FC<DayStepViewProps> = ({ course, dayData, step }) => {
  const {
    state,
    navigate,
    toggleStepComplete,
    updateCaseItem,
    updateMasteryItem,
  } = useCourseStore();

  const [vocabKeyOpen, setVocabKeyOpen] = useState(false);
  const [openVaultIds, setOpenVaultIds] = useState<Record<string, boolean>>({});
  const [caseSavedMsg, setCaseSavedMsg] = useState('');

  // Reset spoiler drawers when navigating across days/steps
  React.useEffect(() => {
    setVocabKeyOpen(false);
    setOpenVaultIds({});
    setCaseSavedMsg('');
  }, [dayData.day, step]);

  const stepMeta = dayData.steps.find((s) => s.stepNumber === step) || dayData.steps[0];
  const isStepDone = Boolean(state.completedSteps[`d${dayData.day}-s${step}`]);

  const goNext = () => {
    if (step < 10) {
      navigate({ kind: 'day', day: dayData.day, step: step + 1 });
    } else if (dayData.day < 7) {
      navigate({ kind: 'day', day: dayData.day + 1, step: 1 });
    } else {
      navigate({ kind: 'vocab', tab: 'notebook' });
    }
  };

  const renderStepBody = () => {
    switch (step) {
      case 1:
        return (
          <article className="reading-sheet-wide">
            {dayData.noticeHtml && (
              <div className="day-notice-box">
                <RichHtml html={dayData.noticeHtml} />
              </div>
            )}
            <h2 className="chapter-major-title">1. {stepMeta.fullTitle}</h2>
            <RichHtml html={dayData.timetable.html} />
          </article>
        );

      case 2:
        return (
          <article className="reading-sheet">
            <h2 className="chapter-major-title">2. {stepMeta.fullTitle}</h2>
            <RichHtml html={dayData.objectives.html} />
          </article>
        );

      case 3:
      case 6: {
        const block = step === 3 ? dayData.rwLessons : dayData.mathLessons;
        return (
          <div className="two-col-course-grid">
            <div className="lessons-stack">
              {block.introHtml && (
                <div className="reading-sheet">
                  <RichHtml html={block.introHtml} />
                </div>
              )}
              {block.lessons.map((lesson) => (
                <article key={lesson.id} id={lesson.id} className="reading-sheet lesson-card">
                  <h2
                    className="lesson-card-title"
                    dangerouslySetInnerHTML={{ __html: lesson.titleHtml }}
                  />
                  <RichHtml html={lesson.html} />
                  <InlineChecksPanel lesson={lesson} />
                </article>
              ))}
            </div>

            <aside className="page-outline-rail" aria-label="Lessons on this page">
              <div className="outline-heading">Lessons in This Block</div>
              <ul className="outline-list">
                {block.lessons.map((l) => (
                  <li key={l.id} className="outline-lvl-2">
                    <a
                      href={`#${l.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        document
                          .getElementById(l.id)
                          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                    >
                      {l.title}
                    </a>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        );
      }

      case 4: {
        const dayWords = course.vocabStudio.words.filter((w) => w.day === dayData.day);
        const coreWordSections = dayData.vocabulary.subSections.filter((sub) =>
          /Core Academic Vocabulary/i.test(sub.title)
        );
        return (
          <div className="lessons-stack">
            <div className="vocab-studio-bridge-banner">
              <div>
                <div className="section-kicker">THREE-LAYER ACADEMIC VOCABULARY</div>
                <h3>Day 0{dayData.day} Contextual Word Studio ({dayWords.length} Core Words)</h3>
                <p>
                  Study today&apos;s 3-layer profiles, track mastery &amp; write your own context
                  sentences, and complete all numbered interactive drills below.
                </p>
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={() =>
                  navigate({ kind: 'vocab', tab: 'flashcards', dayFilter: dayData.day })
                }
              >
                Practice Day {dayData.day} Flashcards →
              </button>
            </div>

            {dayData.vocabulary.introHtml && (
              <div className="reading-sheet">
                <RichHtml html={dayData.vocabulary.introHtml} />
              </div>
            )}

            {coreWordSections.map((sub) => (
              <article key={sub.id} className="reading-sheet-wide">
                <h2
                  className="lesson-card-title"
                  dangerouslySetInnerHTML={{ __html: sub.titleHtml || sub.title }}
                />
                <RichHtml html={sub.html} />
              </article>
            ))}

            <VocabExerciseWorkspace
              day={dayData.day}
              dayWords={dayWords}
              exercises={dayData.vocabulary.exercises || []}
            />

            {dayData.vocabulary.answerKeyHtml && (
              <section className="spoiler-vault-card">
                <div className="spoiler-vault-header">
                  <div>
                    <span className="spoiler-tag">SPOILER GUARD</span>
                    <h4>Day 0{dayData.day} Complete Vocabulary Answer Key (Full Reference)</h4>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setVocabKeyOpen((v) => !v)}
                  >
                    {vocabKeyOpen ? 'Hide Full Reference Key' : 'Reveal Full Reference Key'}
                  </button>
                </div>
                {vocabKeyOpen && (
                  <div className="spoiler-vault-body">
                    <RichHtml html={dayData.vocabulary.answerKeyHtml} />
                  </div>
                )}
              </section>
            )}

            <FloatingStudyTools
              scopeKey={`d${dayData.day}-s4`}
              label="Vocab Scratchpad & Highlighter"
            />
          </div>
        );
      }

      case 5:
        return (
          <PracticeSetWorkspace
            day={dayData.day}
            stepNumber={5}
            sectionType="RW"
            introHtml={dayData.rwPractice.introHtml}
            questions={dayData.rwPractice.questions}
            recommendedMinutes={dayData.recommendedTimers.rwMinutes}
            eCodes={course.errorLogStudio.eCodes}
            vCodes={course.errorLogStudio.vCodes}
          />
        );

      case 7:
        return (
          <PracticeSetWorkspace
            day={dayData.day}
            stepNumber={7}
            sectionType="MATH"
            introHtml={dayData.mathPractice.introHtml}
            questions={dayData.mathPractice.questions}
            recommendedMinutes={dayData.recommendedTimers.mathMinutes}
            eCodes={course.errorLogStudio.eCodes}
            vCodes={course.errorLogStudio.vCodes}
          />
        );

      case 8:
        return (
          <div className="lessons-stack">
            <div className="reading-sheet">
              <div className="section-kicker">SECTION 08 · TEACHING SOLUTIONS VAULT</div>
              <h2 className="chapter-major-title">Complete Answer Keys &amp; Explanations</h2>
              <RichHtml html={dayData.answerVault.introHtml} />
              <div className="vault-global-btns">
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => {
                    const next: Record<string, boolean> = {};
                    dayData.answerVault.subSections.forEach((s) => {
                      next[s.id] = true;
                    });
                    setOpenVaultIds(next);
                  }}
                >
                  Expand All Drawers
                </button>
                <button
                  type="button"
                  className="btn-text-subtle"
                  onClick={() => setOpenVaultIds({})}
                >
                  Collapse All
                </button>
              </div>
            </div>

            {dayData.answerVault.subSections.map((sub) => {
              const isOpen = Boolean(openVaultIds[sub.id]);
              return (
                <section key={sub.id} className="spoiler-vault-card">
                  <div className="spoiler-vault-header">
                    <div>
                      <span className="spoiler-tag">SPOILER PROTECTED</span>
                      <h3 dangerouslySetInnerHTML={{ __html: sub.titleHtml || sub.title }} />
                    </div>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() =>
                        setOpenVaultIds((prev) => ({ ...prev, [sub.id]: !prev[sub.id] }))
                      }
                    >
                      {isOpen ? 'Hide Key' : 'Open Answer Key'}
                    </button>
                  </div>
                  {isOpen && (
                    <div className="spoiler-vault-body">
                      <RichHtml html={sub.html} />
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        );

      case 9:
        return (
          <div className="lessons-stack">
            <article className="reading-sheet-wide">
              <h2 className="chapter-major-title">9. {stepMeta.fullTitle}</h2>
              <RichHtml html={dayData.errorLab.beforeKeyHtml} />

              {dayData.errorLab.cases.length > 0 && (
                <div className="diagnostic-cases-stack">
                  {dayData.errorLab.cases.map((c, idx) => {
                    const userCase = state.caseProgress[c.id] || { draft: '', revealed: false };
                    return (
                      <div key={c.id} className="case-study-card">
                        <div className="case-card-top">
                          <span className="q-index-badge mono-num">Case {idx + 1}</span>
                          <span className="q-id-code mono-num">{c.id}</span>
                          {c.categoryLabel && (
                            <span className="case-cat-badge">{c.categoryLabel}</span>
                          )}
                        </div>
                        <p
                          className="case-prompt-text"
                          dangerouslySetInnerHTML={{ __html: c.promptHtml }}
                        />
                        <div className="cc-input-row">
                          <input
                            type="text"
                            className="cc-draft-input"
                            placeholder="Predict Error Code(s) (e.g. E2 + V2, E4, E6, E8 + E9) & 1-line rule..."
                            value={userCase.draft}
                            onChange={(e) => updateCaseItem(c.id, { draft: e.target.value })}
                          />
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            onClick={() =>
                              updateCaseItem(c.id, { revealed: !userCase.revealed })
                            }
                          >
                            {userCase.revealed ? 'Hide Diagnosis' : 'Check Diagnosis'}
                          </button>
                        </div>
                        {userCase.revealed && c.answerHtml && (
                          <div className="cc-answer-reveal">
                            <div dangerouslySetInnerHTML={{ __html: c.answerHtml }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {dayData.errorLab.afterKeyHtml && (
                <div className="error-lab-after">
                  <RichHtml html={dayData.errorLab.afterKeyHtml} />
                </div>
              )}
            </article>

            {caseSavedMsg && <div className="toast-confirmation">{caseSavedMsg}</div>}

            <QuickErrorLogger
              eCodes={course.errorLogStudio.eCodes}
              vCodes={course.errorLogStudio.vCodes}
              initialValues={{ dateLabel: `Day ${dayData.day}` }}
              onSaved={() => {
                setCaseSavedMsg('Mistake saved to your Master Diagnostic Error Log!');
                window.setTimeout(() => setCaseSavedMsg(''), 4000);
              }}
            />
          </div>
        );

      case 10: {
        const items = dayData.mastery.masteryItems;
        const masteredCount = items.filter(
          (m) => state.masteryProgress[m.id]?.grade === 'mastered'
        ).length;
        const gradedCount = items.filter((m) => state.masteryProgress[m.id]?.grade).length;
        const pct = items.length > 0 ? Math.round((masteredCount / items.length) * 100) : 0;

        return (
          <div className="lessons-stack">
            <article className="reading-sheet-wide">
              <div className="mastery-gate-header">
                <div>
                  <div className="section-kicker">CLOSED-NOTES SYNTHESIS CHECK</div>
                  <h2 className="chapter-major-title">10. {stepMeta.fullTitle}</h2>
                </div>
                {items.length > 0 && (
                  <div className="mastery-score-badge mono-num">
                    <span>Mastered: {masteredCount}/{items.length}</span>
                    <strong>{pct}%</strong>
                  </div>
                )}
              </div>

              <RichHtml html={dayData.mastery.introHtml} />

              {items.length > 0 && (
                <div className="mastery-cards-stack">
                  {items.map((item) => {
                    const prog = state.masteryProgress[item.id] || {
                      draft: '',
                      revealed: false,
                    };
                    return (
                      <div key={item.id} className="mastery-item-card">
                        <div className="case-card-top">
                          <span className="q-index-badge mono-num">Q{item.number}</span>
                          <span className="q-id-code mono-num">{item.id}</span>
                          {item.topic && <span className="case-cat-badge">{item.topic}</span>}
                        </div>
                        <div
                          className="mastery-prompt"
                          dangerouslySetInnerHTML={{ __html: item.promptHtml }}
                        />
                        <div className="cc-input-row">
                          <input
                            type="text"
                            className="cc-draft-input"
                            placeholder="Type your closed-notes answer..."
                            value={prog.draft}
                            onChange={(e) => updateMasteryItem(item.id, { draft: e.target.value })}
                          />
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            onClick={() =>
                              updateMasteryItem(item.id, { revealed: !prog.revealed })
                            }
                          >
                            {prog.revealed ? 'Hide Key' : 'Reveal Key'}
                          </button>
                        </div>

                        {prog.revealed && (
                          <div className="mastery-reveal-box">
                            <div
                              className="mastery-official-ans"
                              dangerouslySetInnerHTML={{ __html: item.answerHtml }}
                            />
                            <div className="self-grade-btns">
                              <span>Self-Grade:</span>
                              <button
                                type="button"
                                className={`grade-chip ${
                                  prog.grade === 'mastered' ? 'is-mastered' : ''
                                }`}
                                onClick={() => updateMasteryItem(item.id, { grade: 'mastered' })}
                              >
                                ✓ Got It Cold
                              </button>
                              <button
                                type="button"
                                className={`grade-chip ${
                                  prog.grade === 'review' ? 'is-review' : ''
                                }`}
                                onClick={() => updateMasteryItem(item.id, { grade: 'review' })}
                              >
                                ↻ Review Tonight
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {gradedCount === items.length && items.length > 0 && (
                <div className={`gate-verdict-banner ${pct >= 80 ? 'gate-pass' : 'gate-revisit'}`}>
                  <strong>
                    {pct >= 80
                      ? `✓ Advancement Threshold Met (${masteredCount}/${items.length} — ${pct}%)`
                      : `↻ Review Needed (${masteredCount}/${items.length} — ${pct}%, Target ≥ 80%)`}
                  </strong>
                  <span>
                    {pct >= 80
                      ? `You are cleared to log today's 15-minute reflection and advance to the next module.`
                      : `Re-read the rule boxes for any missed items tonight before advancing.`}
                  </span>
                </div>
              )}

              {dayData.mastery.matrixHtml && (
                <div className="advancement-matrix-block">
                  {dayData.mastery.matrixTitle && <h3>{dayData.mastery.matrixTitle}</h3>}
                  <RichHtml html={dayData.mastery.matrixHtml} />
                </div>
              )}
            </article>

            <FloatingStudyTools
              scopeKey={`d${dayData.day}-s10`}
              label="Mastery Scratchpad & Highlighter"
            />
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="course-page-shell">
      {/* Day Module Masthead */}
      <header className="module-masthead">
        <div className="hero-eyebrow">
          <span>DAY 0{dayData.day} OF 07</span>
          <span className="dot-sep">·</span>
          <span>{dayData.dateLabel.toUpperCase()}</span>
          <span className="dot-sep">·</span>
          <span>BUDGET: {dayData.studyBudget.toUpperCase()}</span>
        </div>
        <h1>
          Day {dayData.day}: {dayData.shortTitle}
        </h1>
        <p className="masthead-theme-line">{dayData.theme}</p>

        {/* Horizontal 10-Step Course Ribbon */}
        <div className="step-ribbon-bar" role="navigation" aria-label={`Day ${dayData.day} Steps`}>
          {dayData.steps.map((s) => {
            const active = s.stepNumber === step;
            const done = Boolean(state.completedSteps[`d${dayData.day}-s${s.stepNumber}`]);
            return (
              <button
                key={s.stepNumber}
                type="button"
                className={`ribbon-tab ${active ? 'is-active' : ''} ${done ? 'is-done' : ''}`}
                onClick={() =>
                  navigate({ kind: 'day', day: dayData.day, step: s.stepNumber })
                }
              >
                <span className="ribbon-num mono-num">{done ? '✓' : `${s.stepNumber}.`}</span>
                <span>{s.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Step Content */}
      {renderStepBody()}

      {/* Step Completion & Next Footer */}
      <footer className="step-completion-footer">
        <button
          type="button"
          className={`btn-complete-toggle ${isStepDone ? 'is-completed' : ''}`}
          onClick={() => toggleStepComplete(dayData.day, step)}
        >
          {isStepDone ? '✓ Step Completed (Click to Undo)' : '○ Mark This Step Complete'}
        </button>

        <div className="footer-right-actions">
          {step === 10 && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate({ kind: 'error-log', tab: 'reflections' })}
            >
              Open Day {dayData.day} Reflection Card
            </button>
          )}
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              toggleStepComplete(dayData.day, step, true);
              goNext();
            }}
          >
            {step < 10
              ? `Complete & Continue to Step ${step + 1} →`
              : dayData.day < 7
              ? `Complete Day ${dayData.day} & Open Day ${dayData.day + 1} →`
              : 'Complete Day 7 & Open Vocab Studio →'}
          </button>
        </div>
      </footer>
    </div>
  );
};
