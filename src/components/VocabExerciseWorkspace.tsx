import React, { useMemo, useState } from 'react';
import type { VocabExerciseItem, VocabWordEntry } from '../types/course';
import { DEFAULT_VOCAB_USER, useCourseStore } from '../state/useCourseStore';
import { RichHtml } from './RichHtml';

interface VocabExerciseWorkspaceProps {
  day: number;
  dayWords: VocabWordEntry[];
  exercises: VocabExerciseItem[];
}

export const VocabExerciseWorkspace: React.FC<VocabExerciseWorkspaceProps> = ({
  day,
  dayWords,
  exercises,
}) => {
  const {
    state,
    updateVocabItem,
    updateVocabExerciseAttempt,
    resetVocabExercises,
  } = useCourseStore();

  const [revealAllKeys, setRevealAllKeys] = useState(false);

  const grouped = useMemo(() => {
    const groups: Array<{ title: string; items: VocabExerciseItem[] }> = [];
    for (const ex of exercises) {
      const last = groups[groups.length - 1];
      if (!last || last.title !== ex.groupTitle) {
        groups.push({ title: ex.groupTitle, items: [ex] });
      } else {
        last.items.push(ex);
      }
    }
    return groups;
  }, [exercises]);

  const stats = useMemo(() => {
    const map = state.vocabExerciseAttempts || {};
    let checked = 0;
    let correct = 0;
    let mcChecked = 0;
    for (const ex of exercises) {
      const att = map[ex.id];
      if (att?.checked) {
        checked++;
        if (ex.format === 'MC') {
          mcChecked++;
          if (att.isCorrect) correct++;
        }
      }
    }
    return { checked, correct, mcChecked };
  }, [exercises, state.vocabExerciseAttempts]);

  const attemptsMap = state.vocabExerciseAttempts || {};

  return (
    <div className="vocab-interactive-stack">
      {/* Interactive Core Word Tracker for Today */}
      {dayWords.length > 0 && (
        <section className="reading-sheet-wide vocab-quick-tracker-card">
          <div className="vocab-tracker-head">
            <div>
              <span className="section-kicker">DAY 0{day} CORE WORD CHECKLIST</span>
              <h3>Mark Mastery &amp; Write Your Own Context Sentences</h3>
            </div>
            <span className="score-summary-pill mono-num">
              Mastered:{' '}
              <strong>
                {
                  dayWords.filter(
                    (w) => (state.vocabProgress[w.id]?.status || 'new') === 'mastered'
                  ).length
                }
              </strong>
              /{dayWords.length}
            </span>
          </div>

          <div className="vocab-quick-grid">
            {dayWords.map((w, idx) => {
              const userW = state.vocabProgress[w.id] || DEFAULT_VOCAB_USER;
              return (
                <div key={w.id} className="vocab-quick-row">
                  <div className="vocab-quick-word-col">
                    <div className="vocab-quick-title-line">
                      <span className="q-index-badge mono-num">#{w.number}</span>
                      <strong>{w.word}</strong>
                      <span className="vocab-pos-tag">{w.partOfSpeech}</span>
                      <button
                        type="button"
                        className={`star-btn ${userW.starred ? 'is-starred' : ''}`}
                        onClick={() => updateVocabItem(w.id, { starred: !userW.starred })}
                        title="Star word for extra review"
                      >
                        {userW.starred ? '★' : '☆'}
                      </button>
                    </div>
                    <p className="vocab-quick-meaning">{w.simpleMeaning}</p>
                  </div>

                  <div className="vocab-quick-controls-col">
                    <div className="status-pill-trio" role="group" aria-label={`Status for ${w.word}`}>
                      {(['new', 'learning', 'mastered'] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          className={`mini-status-btn status-${st} ${
                            userW.status === st ? 'is-selected' : ''
                          }`}
                          onClick={() => updateVocabItem(w.id, { status: st })}
                        >
                          {st === 'new' ? 'New' : st === 'learning' ? 'Learning' : 'Mastered'}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      className="vocab-quick-sentence-input"
                      placeholder={`Write your own English sentence using "${w.word}" (Item ${idx + 1})...`}
                      value={userW.mySentence}
                      onChange={(e) => updateVocabItem(w.id, { mySentence: e.target.value })}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Interactive Spaced Retrieval & Active Vocabulary Drills */}
      {exercises.length > 0 && (
        <section className="reading-sheet-wide vocab-drills-sheet">
          <div className="vocab-drills-toolbar">
            <div>
              <span className="section-kicker">INTERACTIVE VOCABULARY DRILLS</span>
              <h3>
                Day 0{day} Spaced Retrieval &amp; Active Practice ({exercises.length} Numbered
                Items)
              </h3>
            </div>

            <div className="vocab-drills-toolbar-actions">
              <span className="score-summary-pill mono-num">
                Checked: <strong>{stats.checked}</strong>/{exercises.length}
                {stats.mcChecked > 0 ? ` · MC: ${stats.correct}/${stats.mcChecked}` : ''}
              </span>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => setRevealAllKeys((v) => !v)}
              >
                {revealAllKeys ? 'Hide All Keys' : 'Reveal All Keys'}
              </button>
              <button
                type="button"
                className="btn-text-subtle"
                onClick={() => {
                  if (window.confirm('Clear your saved vocabulary drill answers for this day?')) {
                    resetVocabExercises(exercises.map((e) => e.id));
                    setRevealAllKeys(false);
                  }
                }}
              >
                Clear Drills
              </button>
            </div>
          </div>

          <div className="vocab-groups-stack">
            {grouped.map((grp) => (
              <div key={grp.title} className="vocab-exercise-group">
                <h4 className="vocab-group-heading">{grp.title}</h4>
                <div className="vocab-exercise-cards">
                  {grp.items.map((ex) => {
                    const att = attemptsMap[ex.id] || { checked: false };
                    const showKey = Boolean(att.checked || revealAllKeys);

                    return (
                      <article key={ex.id} className="vocab-drill-card">
                        <div className="vocab-drill-card-top">
                          <span className="q-index-badge mono-num">Q{ex.number}</span>
                          <span className="q-id-code mono-num">{ex.id}</span>
                          <span className="case-cat-badge">
                            {ex.format === 'MC' ? 'Multiple Choice' : 'Active Recall'}
                          </span>
                        </div>

                        <div className="vocab-drill-prompt">
                          <RichHtml html={ex.promptHtml} />
                        </div>

                        {ex.format === 'MC' ? (
                          <div className="mc-options-list">
                            {ex.choices.map((c) => {
                              const isSelected = att.selectedChoice === c.letter;
                              const isRightOption = c.letter === ex.correctAnswer;
                              let cls = '';
                              if (showKey && ex.correctAnswer) {
                                if (isRightOption) cls = 'choice-correct';
                                else if (isSelected && !isRightOption) cls = 'choice-incorrect';
                              } else if (isSelected) {
                                cls = 'choice-selected';
                              }
                              return (
                                <div key={c.letter} className={`mc-choice-row ${cls}`}>
                                  <button
                                    type="button"
                                    className="mc-choice-select"
                                    onClick={() =>
                                      updateVocabExerciseAttempt(ex.id, (prev) => ({
                                        ...prev,
                                        selectedChoice: c.letter,
                                        checked: false,
                                      }))
                                    }
                                  >
                                    <span className="mc-letter-circle mono-num">{c.letter}</span>
                                    <span
                                      className="mc-choice-text"
                                      dangerouslySetInnerHTML={{ __html: c.html }}
                                    />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="cc-input-row">
                            <input
                              type="text"
                              className="cc-draft-input"
                              placeholder="Type your word, polarity (+ / - / ±), or sentence..."
                              value={att.draft || ''}
                              onChange={(e) =>
                                updateVocabExerciseAttempt(ex.id, (prev) => ({
                                  ...prev,
                                  draft: e.target.value,
                                }))
                              }
                            />
                          </div>
                        )}

                        <div className="vocab-drill-actions">
                          {ex.format === 'MC' ? (
                            <button
                              type="button"
                              className="btn-primary btn-sm"
                              disabled={!att.selectedChoice}
                              onClick={() =>
                                updateVocabExerciseAttempt(ex.id, (prev) => ({
                                  ...prev,
                                  checked: true,
                                  isCorrect: prev.selectedChoice === ex.correctAnswer,
                                }))
                              }
                            >
                              {att.checked ? 'Checked' : 'Check Answer'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              onClick={() =>
                                updateVocabExerciseAttempt(ex.id, (prev) => ({
                                  ...prev,
                                  checked: !prev.checked,
                                }))
                              }
                            >
                              {att.checked ? 'Hide Key' : 'Check Answer'}
                            </button>
                          )}

                          {att.checked && ex.format === 'MC' && (
                            <span
                              className={`vocab-mc-verdict mono-num ${
                                att.isCorrect ? 'verdict-ok' : 'verdict-miss'
                              }`}
                            >
                              {att.isCorrect
                                ? `✓ Correct (${ex.correctAnswer})`
                                : `✕ Correct Key: ${ex.correctAnswer}`}
                            </span>
                          )}
                        </div>

                        {showKey && ex.answerHtml && (
                          <div className="cc-answer-reveal">
                            <RichHtml html={ex.answerHtml} />
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
