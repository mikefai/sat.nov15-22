import React, { useEffect, useMemo, useState } from 'react';
import type { CourseData, VocabWordEntry } from '../types/course';
import { DEFAULT_VOCAB_USER, useCourseStore } from '../state/useCourseStore';
import { RichHtml } from '../components/RichHtml';

interface VocabStudioViewProps {
  course: CourseData;
  initialTab?: 'notebook' | 'flashcards' | 'schedule';
  initialDayFilter?: number;
}

export const VocabStudioView: React.FC<VocabStudioViewProps> = ({
  course,
  initialTab = 'notebook',
  initialDayFilter,
}) => {
  const { state, navigate, updateVocabItem, addCustomVocab, deleteCustomVocab } =
    useCourseStore();

  const [tab, setTab] = useState<'notebook' | 'flashcards' | 'schedule'>(initialTab);
  const [dayFilter, setDayFilter] = useState<number | 'all'>(initialDayFilter || 'all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'starred' | 'learning' | 'mastered'>(
    'all'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [coverMeanings, setCoverMeanings] = useState(false);
  const [peekIds, setPeekIds] = useState<Record<string, boolean>>({});

  // Flashcard state
  const [cardIndex, setCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [contextFirstMode, setContextFirstMode] = useState(false);

  // Custom vocab form (Rows 61+)
  const [customWord, setCustomWord] = useState('');
  const [customPos, setCustomPos] = useState('v.');
  const [customMeaning, setCustomMeaning] = useState('');
  const [customContext, setCustomContext] = useState('');
  const [customSyn, setCustomSyn] = useState('');
  const [customSentence, setCustomSentence] = useState('');

  useEffect(() => {
    setTab(initialTab);
    if (initialDayFilter) setDayFilter(initialDayFilter);
  }, [initialTab, initialDayFilter]);

  const filteredWords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return course.vocabStudio.words.filter((w) => {
      if (dayFilter !== 'all' && w.day !== dayFilter) return false;
      const u = state.vocabProgress[w.id] || DEFAULT_VOCAB_USER;
      if (statusFilter === 'starred' && !u.starred) return false;
      if (statusFilter === 'learning' && u.status === 'mastered') return false;
      if (statusFilter === 'mastered' && u.status !== 'mastered') return false;
      if (!q) return true;
      return (
        w.word.toLowerCase().includes(q) ||
        w.simpleMeaning.toLowerCase().includes(q) ||
        w.synonyms.toLowerCase().includes(q) ||
        w.satContextRaw.toLowerCase().includes(q)
      );
    });
  }, [course.vocabStudio.words, dayFilter, statusFilter, searchQuery, state.vocabProgress]);

  useEffect(() => {
    setCardIndex(0);
    setCardFlipped(false);
  }, [dayFilter, statusFilter, searchQuery]);

  const counts = useMemo(() => {
    let mastered = 0;
    let learning = 0;
    let starred = 0;
    for (const w of course.vocabStudio.words) {
      const u = state.vocabProgress[w.id];
      if (!u) continue;
      if (u.status === 'mastered') mastered++;
      if (u.status === 'learning') learning++;
      if (u.starred) starred++;
    }
    return { mastered, learning, starred };
  }, [course.vocabStudio.words, state.vocabProgress]);

  const currentCard: VocabWordEntry | undefined =
    filteredWords[cardIndex] || filteredWords[0];

  const handleGradeCard = (word: VocabWordEntry, nextStatus: 'learning' | 'mastered') => {
    updateVocabItem(word.id, { status: nextStatus });
    setCardFlipped(false);
    if (filteredWords.length > 1) {
      setCardIndex((prev) => (prev + 1) % filteredWords.length);
    }
  };

  const handleAddCustomRow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customWord.trim() || !customMeaning.trim()) return;
    addCustomVocab({
      word: customWord.trim(),
      partOfSpeech: customPos.trim(),
      simpleMeaning: customMeaning.trim(),
      satContext: customContext.trim(),
      synonymsContrast: customSyn.trim(),
      mySentence: customSentence.trim(),
      reviewDates: '+1d, +3d, +7d',
    });
    setCustomWord('');
    setCustomMeaning('');
    setCustomContext('');
    setCustomSyn('');
    setCustomSentence('');
  };

  return (
    <div className="course-page-shell">
      <header className="module-masthead">
        <div className="hero-eyebrow">
          <span>PERSONALIZED ESL VOCABULARY SYSTEM</span>
          <span className="dot-sep">·</span>
          <span>60 PRE-LOADED CORE WORDS + PERSONAL DISCOVERIES</span>
        </div>
        <h1>Academic Vocabulary &amp; Spaced-Retrieval Studio</h1>
        <p className="masthead-theme-line">
          Master high-utility academic SAT verbs, tone adjectives, and concession pivots through
          Simple English meanings, authentic sentence contexts, and active retrieval—never isolated
          translation lists.
        </p>

        <div className="vocab-stats-bar mono-num">
          <span>
            Mastered Cold: <strong>{counts.mastered}</strong> / 60
          </span>
          <span>·</span>
          <span>
            In Review: <strong>{counts.learning}</strong>
          </span>
          <span>·</span>
          <span>
            Starred ★: <strong>{counts.starred}</strong>
          </span>
          <span>·</span>
          <span>
            Personal Rows (61+): <strong>{state.customVocab.length}</strong>
          </span>
        </div>

        <div className="step-ribbon-bar" role="tablist">
          <button
            type="button"
            className={`ribbon-tab ${tab === 'notebook' ? 'is-active' : ''}`}
            onClick={() => {
              setTab('notebook');
              navigate({ kind: 'vocab', tab: 'notebook' });
            }}
          >
            1. Master 7-Column Notebook (60 Words)
          </button>
          <button
            type="button"
            className={`ribbon-tab ${tab === 'flashcards' ? 'is-active' : ''}`}
            onClick={() => {
              setTab('flashcards');
              navigate({ kind: 'vocab', tab: 'flashcards' });
            }}
          >
            2. 3-Layer Retrieval Flashcards
          </button>
          <button
            type="button"
            className={`ribbon-tab ${tab === 'schedule' ? 'is-active' : ''}`}
            onClick={() => {
              setTab('schedule');
              navigate({ kind: 'vocab', tab: 'schedule' });
            }}
          >
            3. Word Parts &amp; 21-Day Spaced Schedule
          </button>
        </div>
      </header>

      {/* Shared Filter Bar for Notebook & Flashcards */}
      {tab !== 'schedule' && (
        <div className="studio-filter-bar">
          <div className="filter-pills-row">
            <button
              type="button"
              className={`filter-chip ${dayFilter === 'all' ? 'is-active' : ''}`}
              onClick={() => setDayFilter('all')}
            >
              All Days (60)
            </button>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <button
                key={d}
                type="button"
                className={`filter-chip ${dayFilter === d ? 'is-active' : ''}`}
                onClick={() => setDayFilter(d)}
              >
                Day {d}
              </button>
            ))}
          </div>

          <div className="filter-controls-right">
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as 'all' | 'starred' | 'learning' | 'mastered'
                )
              }
              aria-label="Filter by mastery status"
            >
              <option value="all">All Statuses</option>
              <option value="learning">Unmastered Only</option>
              <option value="starred">Starred ★ Only</option>
              <option value="mastered">Mastered ✓ Only</option>
            </select>

            <input
              type="search"
              className="studio-search-input"
              placeholder="Search word, meaning, synonym..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {tab === 'notebook' && (
              <button
                type="button"
                className={`btn-secondary btn-sm ${coverMeanings ? 'is-toggled-on' : ''}`}
                onClick={() => {
                  setCoverMeanings((v) => !v);
                  setPeekIds({});
                }}
              >
                {coverMeanings ? 'Show All Meanings' : 'Cover Meanings (Self-Test)'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* TAB 1: NOTEBOOK */}
      {tab === 'notebook' && (
        <div className="lessons-stack">
          <div className="vocab-cards-list">
            {filteredWords.length === 0 ? (
              <div className="empty-studio-state">
                No vocabulary entries match the current filter.
              </div>
            ) : (
              filteredWords.map((w) => {
                const userW = state.vocabProgress[w.id] || DEFAULT_VOCAB_USER;
                const masked = coverMeanings && !peekIds[w.id];

                return (
                  <article key={w.id} className="vocab-entry-row">
                    <div className="vocab-col-word">
                      <div className="vocab-num-row">
                        <span className="mono-num vocab-idx">#{w.number}</span>
                        <span className="vocab-day-tag">Day {w.day}</span>
                        <button
                          type="button"
                          className={`star-btn ${userW.starred ? 'is-starred' : ''}`}
                          onClick={() => updateVocabItem(w.id, { starred: !userW.starred })}
                          title="Star for extra spaced review"
                        >
                          {userW.starred ? '★' : '☆'}
                        </button>
                      </div>
                      <h3 className="vocab-headword">
                        {w.word}{' '}
                        {w.partOfSpeech && <span className="vocab-pos">({w.partOfSpeech})</span>}
                      </h3>

                      <div className="vocab-status-pills">
                        {(['new', 'learning', 'mastered'] as const).map((st) => (
                          <button
                            key={st}
                            type="button"
                            className={`mini-status-btn status-${st} ${
                              userW.status === st ? 'is-selected' : ''
                            }`}
                            onClick={() => updateVocabItem(w.id, { status: st })}
                          >
                            {st === 'new' ? 'New' : st === 'learning' ? 'Review' : '✓ Mastered'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="vocab-col-details">
                      {masked ? (
                        <button
                          type="button"
                          className="masked-meaning-overlay"
                          onClick={() => setPeekIds((prev) => ({ ...prev, [w.id]: true }))}
                        >
                          Recall plain-English meaning &amp; polarity first — click to peek
                        </button>
                      ) : (
                        <>
                          <div className="vocab-layer">
                            <span className="layer-tag">Layer 1 · Simple English</span>
                            <p className="vocab-meaning-text">{w.simpleMeaning}</p>
                          </div>

                          <div className="vocab-layer">
                            <span className="layer-tag">Layer 2 · SAT Context</span>
                            <p
                              className="vocab-context-quote"
                              dangerouslySetInnerHTML={{ __html: w.satContextHtml }}
                            />
                          </div>

                          <div className="vocab-meta-split">
                            <div>
                              <span className="layer-tag">Synonyms &amp; Contrast</span>
                              <p className="vocab-syn-line">
                                <strong>Syn:</strong> {w.synonyms}
                                {w.contrasts && (
                                  <>
                                    {' · '}
                                    <strong>Con:</strong> {w.contrasts}
                                  </>
                                )}
                              </p>
                            </div>
                            <div>
                              <span className="layer-tag">Word Family &amp; Review</span>
                              <p className="vocab-syn-line">
                                <span
                                  dangerouslySetInnerHTML={{ __html: w.wordFamilyHtml }}
                                />{' '}
                                <span className="review-dates-chip">({w.reviewDates})</span>
                              </p>
                            </div>
                          </div>
                        </>
                      )}

                      <div className="vocab-own-sentence-box">
                        <label htmlFor={`sent-${w.id}`} className="layer-tag">
                          Layer 3 · My Own English Sentence (Model: &ldquo;{w.modelSentence}&rdquo;)
                        </label>
                        <input
                          id={`sent-${w.id}`}
                          type="text"
                          placeholder="Write your own academic sentence using this word..."
                          value={userW.mySentence}
                          onChange={(e) => updateVocabItem(w.id, { mySentence: e.target.value })}
                        />
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          {/* Personal Discovery Rows 61+ */}
          <section className="reading-sheet-wide">
            <div className="section-kicker">ROWS 61+ · PERSONAL BLUEBOOK DISCOVERIES</div>
            <h3>Add Unfamiliar High-Utility Words from Official Practice</h3>

            {state.customVocab.length > 0 && (
              <div className="custom-vocab-list">
                {state.customVocab.map((cw, i) => (
                  <div key={cw.id} className="custom-vocab-card">
                    <div className="custom-vocab-head">
                      <strong>
                        #{61 + i} {cw.word} ({cw.partOfSpeech})
                      </strong>
                      <button
                        type="button"
                        className="btn-text-subtle"
                        onClick={() => deleteCustomVocab(cw.id)}
                      >
                        Remove
                      </button>
                    </div>
                    <p>
                      <strong>Meaning:</strong> {cw.simpleMeaning}
                    </p>
                    {cw.satContext && (
                      <p>
                        <strong>Context:</strong> <em>{cw.satContext}</em>
                      </p>
                    )}
                    {cw.mySentence && (
                      <p>
                        <strong>My Sentence:</strong> {cw.mySentence}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <form className="custom-vocab-form" onSubmit={handleAddCustomRow}>
              <div className="logger-grid-4">
                <label>
                  <span>Word</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g.ameliorate"
                    value={customWord}
                    onChange={(e) => setCustomWord(e.target.value)}
                  />
                </label>
                <label>
                  <span>Part of Speech</span>
                  <input
                    type="text"
                    placeholder="v. / adj. / adv."
                    value={customPos}
                    onChange={(e) => setCustomPos(e.target.value)}
                  />
                </label>
                <label>
                  <span>Simple English Meaning</span>
                  <input
                    type="text"
                    required
                    placeholder="Clear everyday explanation..."
                    value={customMeaning}
                    onChange={(e) => setCustomMeaning(e.target.value)}
                  />
                </label>
                <label>
                  <span>Synonyms / Contrast</span>
                  <input
                    type="text"
                    placeholder="Syn: improve · Con: worsen"
                    value={customSyn}
                    onChange={(e) => setCustomSyn(e.target.value)}
                  />
                </label>
              </div>
              <div className="logger-grid-2">
                <label>
                  <span>SAT Passage Context</span>
                  <input
                    type="text"
                    placeholder="Short quote or clue from Bluebook..."
                    value={customContext}
                    onChange={(e) => setCustomContext(e.target.value)}
                  />
                </label>
                <label>
                  <span>My Own Sentence</span>
                  <input
                    type="text"
                    placeholder="Write 1 sentence of your own..."
                    value={customSentence}
                    onChange={(e) => setCustomSentence(e.target.value)}
                  />
                </label>
              </div>
              <button type="submit" className="btn-primary">
                + Add Word to Personal Notebook (Row {61 + state.customVocab.length})
              </button>
            </form>
          </section>
        </div>
      )}

      {/* TAB 2: FLASHCARDS */}
      {tab === 'flashcards' && (
        <div className="flashcard-stage">
          {!currentCard ? (
            <div className="empty-studio-state">
              No cards match this filter. Switch filter to &ldquo;All Statuses&rdquo; or &ldquo;All
              Days&rdquo;.
            </div>
          ) : (
            <div className="flashcard-container">
              <div className="flashcard-top-controls">
                <span className="mono-num">
                  Card {cardIndex + 1} of {filteredWords.length} · Day {currentCard.day} (#
                  {currentCard.number})
                </span>
                <div className="segmented-toggle">
                  <button
                    type="button"
                    className={!contextFirstMode ? 'is-active' : ''}
                    onClick={() => {
                      setContextFirstMode(false);
                      setCardFlipped(false);
                    }}
                  >
                    Word Front
                  </button>
                  <button
                    type="button"
                    className={contextFirstMode ? 'is-active' : ''}
                    onClick={() => {
                      setContextFirstMode(true);
                      setCardFlipped(false);
                    }}
                  >
                    SAT Context Front
                  </button>
                </div>
              </div>

              <div
                className={`flashcard-sheet ${cardFlipped ? 'is-flipped' : ''}`}
                onClick={() => setCardFlipped((f) => !f)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    setCardFlipped((f) => !f);
                  }
                }}
              >
                {!cardFlipped ? (
                  <div className="flashcard-face">
                    <span className="section-kicker">
                      {contextFirstMode
                        ? 'INFER MEANING FROM CONTEXT'
                        : 'CLOSED-NOTES ACTIVE RECALL'}
                    </span>
                    {contextFirstMode ? (
                      <p
                        className="flashcard-context-front"
                        dangerouslySetInnerHTML={{ __html: currentCard.satContextHtml }}
                      />
                    ) : (
                      <h2 className="flashcard-big-word">
                        {currentCard.word}{' '}
                        {currentCard.partOfSpeech && (
                          <span className="vocab-pos">({currentCard.partOfSpeech})</span>
                        )}
                      </h2>
                    )}
                    <p className="flashcard-tap-hint">
                      Explain in simple English + +/- polarity, then click to flip
                    </p>
                  </div>
                ) : (
                  <div className="flashcard-face flashcard-back">
                    <div className="flashcard-back-head">
                      <h3>
                        {currentCard.word}{' '}
                        {currentCard.partOfSpeech && (
                          <span className="vocab-pos">({currentCard.partOfSpeech})</span>
                        )}
                      </h3>
                      <span className="vocab-day-tag">Day {currentCard.day}</span>
                    </div>
                    <p className="flashcard-meaning">{currentCard.simpleMeaning}</p>
                    <blockquote
                      className="flashcard-quote"
                      dangerouslySetInnerHTML={{ __html: currentCard.satContextHtml }}
                    />
                    <div className="flashcard-syn-grid">
                      <div>
                        <strong>Synonyms:</strong> {currentCard.synonyms}
                      </div>
                      {currentCard.contrasts && (
                        <div>
                          <strong>Contrast:</strong> {currentCard.contrasts}
                        </div>
                      )}
                    </div>
                    <p className="flashcard-model-sent">
                      <strong>Model Application:</strong> {currentCard.modelSentence}
                    </p>
                  </div>
                )}
              </div>

              <div className="flashcard-Controls-bottom">
                <button
                  type="button"
                  className="step-nav-btn"
                  onClick={() => {
                    setCardFlipped(false);
                    setCardIndex(
                      (prev) => (prev - 1 + filteredWords.length) % filteredWords.length
                    );
                  }}
                >
                  ← Prev
                </button>

                <div className="flashcard-grade-pair">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleGradeCard(currentCard, 'learning')}
                  >
                    ↻ Needs Another Pass
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => handleGradeCard(currentCard, 'mastered')}
                  >
                    ✓ Got It Cold (Mastered)
                  </button>
                </div>

                <button
                  type="button"
                  className="step-nav-btn"
                  onClick={() => {
                    setCardFlipped(false);
                    setCardIndex((prev) => (prev + 1) % filteredWords.length);
                  }}
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MORPHOLOGY & SPACED SCHEDULE */}
      {tab === 'schedule' && (
        <div className="lessons-stack">
          <article className="reading-sheet-wide">
            <h2>1. Daily Contextual Vocabulary Protocol</h2>
            <RichHtml html={course.vocabStudio.howToUseHtml} />
          </article>
          <article className="reading-sheet-wide">
            <h2>2. High-Utility Academic Word Parts</h2>
            <RichHtml html={course.vocabStudio.wordPartsHtml} />
          </article>
          <article className="reading-sheet-wide">
            <h2>3. 21-Day Spaced Retrieval Log (Nov 14 – Dec 4, 2026)</h2>
            <RichHtml html={course.vocabStudio.spacedScheduleHtml} />
          </article>
        </div>
      )}
    </div>
  );
};
