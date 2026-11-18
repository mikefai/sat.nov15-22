import React, { useEffect, useMemo, useState } from 'react';
import type { ErrorCodeInfo, PracticeQuestion } from '../types/course';
import { DEFAULT_ATTEMPT, useCourseStore } from '../state/useCourseStore';
import { checkQuestionAnswer, parseSprStudentInput } from '../utils/sprGrading';
import { RichHtml } from './RichHtml';
import { QuickErrorLogger } from './QuickErrorLogger';
import { FloatingStudyTools } from './FloatingStudyTools';

interface PracticeSetWorkspaceProps {
  day: number;
  stepNumber: number;
  sectionType: 'RW' | 'MATH';
  introHtml: string;
  questions: PracticeQuestion[];
  recommendedMinutes: number;
  eCodes: ErrorCodeInfo[];
  vCodes: ErrorCodeInfo[];
}

function formatClock(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const PracticeSetWorkspace: React.FC<PracticeSetWorkspaceProps> = ({
  day,
  stepNumber,
  sectionType,
  introHtml,
  questions,
  recommendedMinutes,
  eCodes,
  vCodes,
}) => {
  const { state, updateQuestionAttempt, resetQuestionSet, toggleStepComplete } =
    useCourseStore();

  const [layoutMode, setLayoutMode] = useState<'deck' | 'worksheet'>('deck');
  const [examSimMode, setExamSimMode] = useState<boolean>(day === 5);
  const [simSubmitted, setSimSubmitted] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number>(0);

  // Timer state
  const [secondsLeft, setSecondsLeft] = useState<number>(recommendedMinutes * 60);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);

  // Per-question UI states (open explanations & open error loggers)
  const [openExplanations, setOpenExplanations] = useState<Record<string, boolean>>({});
  const [openLoggerFor, setOpenLoggerFor] = useState<string | null>(null);
  const [savedLogBanner, setSavedLogBanner] = useState<string | null>(null);
  const [sprHints, setSprHints] = useState<Record<string, string>>({});

  // Reset active card & timer when switching day/section
  useEffect(() => {
    setActiveIndex(0);
    setTimerRunning(false);
    setSecondsLeft(recommendedMinutes * 60);
    setExamSimMode(day === 5);
    setSimSubmitted(false);
    setOpenExplanations({});
    setOpenLoggerFor(null);
  }, [day, sectionType, recommendedMinutes]);

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  const stats = useMemo(() => {
    let answered = 0;
    let checked = 0;
    let correct = 0;
    let flagged = 0;

    for (const q of questions) {
      const att = state.questionAttempts[q.id];
      if (!att) continue;
      if (att.selectedChoice || (att.sprInput && att.sprInput.trim())) answered++;
      if (att.checked) {
        checked++;
        if (att.isCorrect) correct++;
      }
      if (att.flagged) flagged++;
    }
    return { answered, checked, correct, flagged };
  }, [questions, state.questionAttempts]);

  const handleGradeSingle = (q: PracticeQuestion) => {
    const att = state.questionAttempts[q.id] || DEFAULT_ATTEMPT;
    const result = checkQuestionAnswer(q, att.selectedChoice, att.sprInput);
    if (result.formatHint) {
      setSprHints((prev) => ({ ...prev, [q.id]: result.formatHint! }));
      return;
    }
    setSprHints((prev) => {
      const next = { ...prev };
      delete next[q.id];
      return next;
    });

    updateQuestionAttempt(q.id, (prev) => ({
      ...prev,
      checked: true,
      isCorrect: result.isCorrect,
    }));
    setOpenExplanations((prev) => ({ ...prev, [q.id]: true }));

    // Auto-mark step complete if all questions in this set have been checked
    const checkedAfter = questions.filter(
      (item) => item.id === q.id || state.questionAttempts[item.id]?.checked
    ).length;
    if (checkedAfter === questions.length) {
      toggleStepComplete(day, stepNumber, true);
    }
  };

  const handleFinishSimulation = () => {
    setTimerRunning(false);
    for (const q of questions) {
      const att = state.questionAttempts[q.id] || DEFAULT_ATTEMPT;
      const hasInput =
        q.format === 'MC'
          ? Boolean(att.selectedChoice)
          : Boolean(att.sprInput && att.sprInput.trim());
      if (hasInput) {
        const res = checkQuestionAnswer(q, att.selectedChoice, att.sprInput);
        updateQuestionAttempt(q.id, (prev) => ({
          ...prev,
          checked: true,
          isCorrect: res.isCorrect,
        }));
      }
    }
    setSimSubmitted(true);
    toggleStepComplete(day, stepNumber, true);
  };

  const hasJumpQ15 = sectionType === 'RW' && questions.length >= 27;

  const renderQuestionCard = (q: PracticeQuestion, idx: number) => {
    const att = state.questionAttempts[q.id] || DEFAULT_ATTEMPT;
    const showGraded = att.checked && (!examSimMode || simSubmitted);
    const isExpOpen = Boolean(openExplanations[q.id]);
    const sprPreview =
      q.format === 'SPR' && att.sprInput ? parseSprStudentInput(att.sprInput) : null;

    return (
      <article key={q.id} className="practice-card" id={`card-${q.id}`}>
        {q.partTitle && (idx === 0 || questions[idx - 1]?.partTitle !== q.partTitle) && (
          <div className="practice-part-banner">{q.partTitle}</div>
        )}

        {q.pacingNote && (
          <div className="pacing-checkpoint-banner">
            <span className="pacing-dot" aria-hidden="true">
              ⏱
            </span>
            <span>{q.pacingNote}</span>
          </div>
        )}

        <div className="practice-card-top">
          <div className="q-meta-left">
            <span className="q-index-badge mono-num">
              Q{q.number} <span className="q-index-total">/ {questions.length}</span>
            </span>
            <span className="q-id-code mono-num">{q.id}</span>
            <span className="q-domain-crumb">
              {q.domain}
              {q.skill ? ` · ${q.skill}` : ''}
            </span>
            <span
              className={`q-diff-pill diff-${q.difficulty
                .toLowerCase()
                .replace(/[^a-z]/g, '-')}`}
            >
              {q.difficulty}
            </span>
          </div>

          <div className="q-meta-right">
            <div className="confidence-pill-group" role="group" aria-label="Confidence Tag">
              <button
                type="button"
                className={`conf-btn ${att.confidence === 'C' ? 'is-selected-conf' : ''}`}
                onClick={() =>
                  updateQuestionAttempt(q.id, (prev) => ({
                    ...prev,
                    confidence: prev.confidence === 'C' ? undefined : 'C',
                  }))
                }
                title="Mark Confident [C]"
              >
                [C] Firm
              </button>
              <button
                type="button"
                className={`conf-btn conf-unsure ${
                  att.confidence === '?' ? 'is-selected-unsure' : ''
                }`}
                onClick={() =>
                  updateQuestionAttempt(q.id, (prev) => ({
                    ...prev,
                    confidence: prev.confidence === '?' ? undefined : '?',
                  }))
                }
                title="Mark 50-50 / Unsure [?] for Blind Re-Solve"
              >
                [?] 50-50
              </button>
            </div>

            <button
              type="button"
              className={`flag-btn ${att.flagged ? 'is-flagged' : ''}`}
              onClick={() =>
                updateQuestionAttempt(q.id, (prev) => ({ ...prev, flagged: !prev.flagged }))
              }
            >
              {att.flagged ? '⚑ Flagged' : '⚐ Mark'}
            </button>
          </div>
        </div>

        {/* Passage / Math Stem */}
        <div className="q-stem-body">
          <RichHtml html={q.stemHtml} />
        </div>

        {/* Answer Input Area */}
        {q.format === 'MC' ? (
          <div className="mc-options-list" role="radiogroup" aria-label={`Choices for ${q.id}`}>
            {q.choices.map((c) => {
              const isSelected = att.selectedChoice === c.letter;
              const isEliminated = att.eliminatedChoices.includes(c.letter);
              const isRightOption = c.letter === q.correctAnswer;

              let stateClass = '';
              if (showGraded) {
                if (isRightOption) stateClass = 'choice-correct';
                else if (isSelected && !isRightOption) stateClass = 'choice-incorrect';
              } else if (isSelected) {
                stateClass = 'choice-selected';
              }

              return (
                <div
                  key={c.letter}
                  className={`mc-choice-row ${stateClass} ${
                    isEliminated && !isSelected ? 'is-eliminated' : ''
                  }`}
                >
                  <button
                    type="button"
                    className="mc-choice-select"
                    onClick={() => {
                      if (showGraded && examSimMode) return;
                      updateQuestionAttempt(q.id, (prev) => ({
                        ...prev,
                        selectedChoice: c.letter,
                        checked: examSimMode ? false : prev.checked && prev.selectedChoice === c.letter,
                      }));
                    }}
                  >
                    <span className="mc-letter-circle mono-num">{c.letter}</span>
                    <span
                      className="mc-choice-text"
                      dangerouslySetInnerHTML={{ __html: c.html }}
                    />
                  </button>

                  <button
                    type="button"
                    className={`mc-eliminate-btn ${isEliminated ? 'is-active' : ''}`}
                    title={isEliminated ? 'Restore choice' : 'Cross out trap choice'}
                    onClick={() =>
                      updateQuestionAttempt(q.id, (prev) => {
                        const exists = prev.eliminatedChoices.includes(c.letter);
                        return {
                          ...prev,
                          eliminatedChoices: exists
                            ? prev.eliminatedChoices.filter((x) => x !== c.letter)
                            : [...prev.eliminatedChoices, c.letter],
                        };
                      })
                    }
                  >
                    {isEliminated ? 'Undo' : 'Cross'}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="spr-entry-box">
            <label htmlFor={`spr-${q.id}`} className="spr-label">
              Student-Produced Response (SPR)
            </label>
            <div className="spr-input-row">
              <input
                id={`spr-${q.id}`}
                type="text"
                inputMode="text"
                className={`spr-input mono-num ${
                  showGraded ? (att.isCorrect ? 'spr-correct' : 'spr-incorrect') : ''
                }`}
                placeholder="Type integer, decimal, or fraction (e.g. 7/2)"
                value={att.sprInput || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setSprHints((prev) => {
                    const next = { ...prev };
                    delete next[q.id];
                    return next;
                  });
                  updateQuestionAttempt(q.id, (prev) => ({
                    ...prev,
                    sprInput: val,
                    checked: examSimMode ? false : false,
                  }));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !examSimMode) {
                    e.preventDefault();
                    handleGradeSingle(q);
                  }
                }}
              />
              {sprPreview && sprPreview.validFormat && sprPreview.numericValue !== null && (
                <span className="spr-preview-pill mono-num">
                  Preview: {att.sprInput?.trim()}
                </span>
              )}
            </div>
            {sprHints[q.id] && <p className="spr-format-warning">{sprHints[q.id]}</p>}
            <p className="spr-helper-note">
              Bluebook SPR Rule: Enter fractions like <code>11/8</code> or decimals like{' '}
              <code>1.375</code> (4 decimals for non-terminating values). Never enter mixed numbers.
            </p>
          </div>
        )}

        {/* Result Banner when Checked */}
        {showGraded && (
          <div className={`graded-banner ${att.isCorrect ? 'banner-correct' : 'banner-missed'}`}>
            <div className="graded-status-text">
              <strong>{att.isCorrect ? '✓ Accurate' : '✕ Diagnostic Miss'}</strong>
              <span
                className="graded-headline"
                dangerouslySetInnerHTML={{ __html: q.answerHeadlineHtml }}
              />
            </div>
            {!att.isCorrect && (
              <span className="re-solve-nudge">
                Read the method below, hide it, and cold re-solve on blank paper.
              </span>
            )}
          </div>
        )}

        {/* Card Action Footer */}
        <div className="q-card-actions">
          <div className="q-actions-left">
            {!examSimMode && (
              <button
                type="button"
                className="btn-primary"
                disabled={
                  q.format === 'MC'
                    ? !att.selectedChoice
                    : !att.sprInput || !att.sprInput.trim()
                }
                onClick={() => handleGradeSingle(q)}
              >
                {att.checked ? 'Re-Check Answer' : 'Check Answer'}
              </button>
            )}

            {(!examSimMode || simSubmitted) && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  if (!att.checked && !isExpOpen) {
                    const proceed = window.confirm(
                      'Reveal the teaching explanation before checking an answer?'
                    );
                    if (!proceed) return;
                  }
                  setOpenExplanations((prev) => ({ ...prev, [q.id]: !prev[q.id] }));
                }}
              >
                {isExpOpen ? 'Hide Teaching Solution' : 'Teaching Solution & Desmos'}
              </button>
            )}

            <button
              type="button"
              className="btn-ghost-accent"
              onClick={() => setOpenLoggerFor((prev) => (prev === q.id ? null : q.id))}
            >
              + Log Mistake
            </button>
          </div>

          {layoutMode === 'deck' && (
            <div className="q-deck-stepper">
              <button
                type="button"
                className="step-nav-btn"
                disabled={idx === 0}
                onClick={() => setActiveIndex(Math.max(0, idx - 1))}
              >
                ← Prev Q
              </button>
              <button
                type="button"
                className="step-nav-btn"
                disabled={idx >= questions.length - 1}
                onClick={() => setActiveIndex(Math.min(questions.length - 1, idx + 1))}
              >
                Next Q →
              </button>
            </div>
          )}
        </div>

        {/* Inline Quick Error Logger */}
        {openLoggerFor === q.id && (
          <div className="inline-logger-wrap">
            <QuickErrorLogger
              eCodes={eCodes}
              vCodes={vCodes}
              initialValues={{
                dateLabel: `Day ${day}`,
                questionId: q.id,
                section: sectionType === 'RW' ? 'R&W' : 'Math',
                topic: q.domain,
                questionType: `${q.skill || q.domain} (${q.difficulty})`,
              }}
              onCancel={() => setOpenLoggerFor(null)}
              onSaved={() => {
                setOpenLoggerFor(null);
                setSavedLogBanner(`Saved ${q.id} to your Diagnostic Error Log.`);
                window.setTimeout(() => setSavedLogBanner(null), 4000);
              }}
            />
          </div>
        )}

        {/* Teaching Explanation Drawer */}
        {isExpOpen && (!examSimMode || simSubmitted) && (
          <div className="explanation-drawer">
            <div className="explanation-drawer-title">
              <span>Teaching Explanation &amp; Distractor Analysis</span>
              <span
                className="exp-ans-pill"
                dangerouslySetInnerHTML={{ __html: q.answerHeadlineHtml }}
              />
            </div>
            <RichHtml html={q.explanationHtml} />
          </div>
        )}
      </article>
    );
  };

  const activeQuestion = questions[activeIndex] || questions[0];

  return (
    <div className="practice-workspace">
      {introHtml && (
        <div className="practice-intro-sheet">
          <RichHtml html={introHtml} />
        </div>
      )}

      {savedLogBanner && <div className="toast-confirmation">{savedLogBanner}</div>}

      {/* Control Bar */}
      <div className="practice-toolbar">
        <div className="toolbar-group">
          <div className="segmented-toggle" role="group" aria-label="View Layout">
            <button
              type="button"
              className={layoutMode === 'deck' ? 'is-active' : ''}
              onClick={() => setLayoutMode('deck')}
            >
              Focused Card
            </button>
            <button
              type="button"
              className={layoutMode === 'worksheet' ? 'is-active' : ''}
              onClick={() => setLayoutMode('worksheet')}
            >
              Full Worksheet ({questions.length})
            </button>
          </div>

          <div className="segmented-toggle" role="group" aria-label="Grading Mode">
            <button
              type="button"
              className={!examSimMode ? 'is-active' : ''}
              onClick={() => {
                setExamSimMode(false);
              }}
            >
              Tutor Check
            </button>
            <button
              type="button"
              className={examSimMode ? 'is-active' : ''}
              onClick={() => {
                setExamSimMode(true);
                setSimSubmitted(false);
              }}
            >
              Timed Simulation
            </button>
          </div>

          {hasJumpQ15 && layoutMode === 'deck' && (
            <button
              type="button"
              className="btn-split-order"
              onClick={() => setActiveIndex(14)}
              title="Split-Order Strategy: Jump straight to Q15 (Standard English Conventions)"
            >
              Jump to Q15 (Pass 1) ⇢
            </button>
          )}
        </div>

        <div className="toolbar-group toolbar-right">
          {/* Timer Box */}
          <div
            className={`module-timer-box ${
              secondsLeft === 0
                ? 'timer-expired'
                : secondsLeft <= 300
                ? 'timer-warning'
                : ''
            }`}
          >
            <span className="timer-readout mono-num">{formatClock(secondsLeft)}</span>
            <button
              type="button"
              className="timer-ctrl-btn"
              onClick={() => setTimerRunning((r) => !r)}
            >
              {timerRunning ? 'Pause' : 'Start'}
            </button>
            <button
              type="button"
              className="timer-ctrl-btn"
              onClick={() => {
                setTimerRunning(false);
                setSecondsLeft(recommendedMinutes * 60);
              }}
            >
              Reset
            </button>
          </div>

          <div className="score-summary-pill mono-num">
            {stats.checked > 0 ? (
              <span>
                Score: <strong>{stats.correct}</strong>/{stats.checked} (
                {Math.round((stats.correct / stats.checked) * 100)}%)
              </span>
            ) : (
              <span>
                Answered: <strong>{stats.answered}</strong>/{questions.length}
              </span>
            )}
          </div>

          {examSimMode && !simSubmitted && (
            <button type="button" className="btn-primary" onClick={handleFinishSimulation}>
              Finish &amp; Score Module
            </button>
          )}

          <button
            type="button"
            className="btn-text-subtle"
            onClick={() => {
              if (window.confirm('Clear your saved answers for this practice set?')) {
                resetQuestionSet(questions.map((q) => q.id));
                setOpenExplanations({});
                setSimSubmitted(false);
              }
            }}
          >
            Clear Set
          </button>
        </div>
      </div>

      {/* Question Navigator Strip (Deck Mode) */}
      {layoutMode === 'deck' && (
        <div className="question-nav-grid" role="navigation" aria-label="Question Navigator">
          {questions.map((q, idx) => {
            const att = state.questionAttempts[q.id];
            const hasAns =
              att &&
              (Boolean(att.selectedChoice) || Boolean(att.sprInput && att.sprInput.trim()));
            const graded = att?.checked && (!examSimMode || simSubmitted);

            let statusCls = '';
            if (graded) statusCls = att?.isCorrect ? 'qdot-correct' : 'qdot-missed';
            else if (hasAns) statusCls = 'qdot-answered';

            return (
              <button
                key={q.id}
                type="button"
                className={`q-nav-dot mono-num ${idx === activeIndex ? 'is-current' : ''} ${statusCls}`}
                onClick={() => setActiveIndex(idx)}
                title={`${q.id} · ${q.skill || q.domain}`}
              >
                {q.number}
                {att?.flagged && <span className="qdot-flag-pip" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Render either Active Card or Full Worksheet */}
      {layoutMode === 'deck' ? (
        activeQuestion ? (
          renderQuestionCard(activeQuestion, activeIndex)
        ) : null
      ) : (
        <div className="worksheet-stack">
          {questions.map((q, idx) => renderQuestionCard(q, idx))}
        </div>
      )}

      <FloatingStudyTools
        scopeKey={`d${day}-s${stepNumber}`}
        label="Exam Scratchpad & Highlighter"
      />
    </div>
  );
};
