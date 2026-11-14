import React, { useState } from 'react';
import type { CourseData } from '../types/course';
import { useCourseStore } from '../state/useCourseStore';
import { RichHtml } from '../components/RichHtml';

interface MasterPlanViewProps {
  course: CourseData;
  activeChapter: number;
}

export const MasterPlanView: React.FC<MasterPlanViewProps> = ({ course, activeChapter }) => {
  const { navigate } = useCourseStore();
  const [showAllChapters, setShowAllChapters] = useState(false);

  const chapter =
    course.masterPlan.chapters.find((c) => c.number === activeChapter) ||
    course.masterPlan.chapters[0];

  return (
    <div className="course-page-shell">
      <header className="module-masthead">
        <div className="hero-eyebrow">
          <span>PART 1 · STRATEGIC ARCHITECTURE</span>
          <span className="dot-sep">·</span>
          <span>NOV 14 – DEC 5, 2026 RUNWAY</span>
        </div>
        <h1>7-Day Digital SAT Master Study Plan &amp; 1400+ Roadmap</h1>
        {activeChapter === 1 && !showAllChapters && (
          <div className="masthead-intro-prose">
            <RichHtml html={course.masterPlan.introHtml} />
          </div>
        )}

        {/* Chapter Ribbon */}
        <div className="step-ribbon-bar" role="tablist" aria-label="Master Plan Chapters">
          {course.masterPlan.chapters.map((ch) => {
            const selected = !showAllChapters && ch.number === chapter.number;
            return (
              <button
                key={ch.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={`ribbon-tab ${selected ? 'is-active' : ''}`}
                onClick={() => {
                  setShowAllChapters(false);
                  navigate({ kind: 'master-plan', chapter: ch.number });
                }}
              >
                <span className="ribbon-num mono-num">{ch.number}.</span>
                <span>{ch.title}</span>
              </button>
            );
          })}
          <button
            type="button"
            className={`ribbon-tab ${showAllChapters ? 'is-active' : ''}`}
            onClick={() => setShowAllChapters((v) => !v)}
          >
            {showAllChapters ? 'Single Chapter View' : 'Read All 7 Chapters'}
          </button>
        </div>
      </header>

      {showAllChapters ? (
        <div className="reading-sheet-wide">
          {course.masterPlan.chapters.map((ch) => (
            <section key={ch.id} className="chapter-block">
              <h2 className="chapter-major-title">{ch.fullTitle}</h2>
              <RichHtml html={ch.html} />
            </section>
          ))}
        </div>
      ) : (
        <div className="two-col-course-grid">
          <article className="reading-sheet">
            <div className="chapter-kicker mono-num">CHAPTER 0{chapter.number} OF 07</div>
            <h2 className="chapter-major-title">{chapter.title}</h2>
            <RichHtml html={chapter.html} />

            <div className="sheet-bottom-pager">
              {chapter.number > 1 ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => navigate({ kind: 'master-plan', chapter: chapter.number - 1 })}
                >
                  ← Ch. {chapter.number - 1}:{' '}
                  {course.masterPlan.chapters[chapter.number - 2].title}
                </button>
              ) : (
                <span />
              )}

              {chapter.number < course.masterPlan.chapters.length ? (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => navigate({ kind: 'master-plan', chapter: chapter.number + 1 })}
                >
                  Ch. {chapter.number + 1}: {course.masterPlan.chapters[chapter.number].title} →
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => navigate({ kind: 'day', day: 1, step: 1 })}
                >
                  Start Day 01 Workbook →
                </button>
              )}
            </div>
          </article>

          {chapter.outline.length > 0 && (
            <aside className="page-outline-rail" aria-label="In this chapter">
              <div className="outline-heading">In This Chapter</div>
              <ul className="outline-list">
                {chapter.outline.map((item) => (
                  <li key={item.id} className={`outline-lvl-${item.level}`}>
                    <a
                      href={`#${item.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        document
                          .getElementById(item.id)
                          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                    >
                      {item.text}
                    </a>
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </div>
      )}
    </div>
  );
};
