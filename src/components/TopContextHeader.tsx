import React, { useState } from 'react';
import type { CourseData, RouteView } from '../types/course';
import { useCourseStore } from '../state/useCourseStore';

interface TopContextHeaderProps {
  course: CourseData;
  focusMode: boolean;
  onToggleFocus: () => void;
  onOpenMobileMenu: () => void;
}

export const TopContextHeader: React.FC<TopContextHeaderProps> = ({
  course,
  focusMode,
  onToggleFocus,
  onOpenMobileMenu,
}) => {
  const { route, navigate, exportStateJson, importStateJson, resetAllProgress } =
    useCourseStore();
  const [desmosOpen, setDesmosOpen] = useState(false);
  const [dataModalOpen, setDataModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  // Compute breadcrumb & Prev/Next navigation targets
  let sectionCrumb = 'Course Foundations';
  let pageCrumb = 'Syllabus & Course Hub';
  let prevTarget: RouteView | null = null;
  let nextTarget: RouteView | null = null;

  if (route.kind === 'overview') {
    nextTarget = { kind: 'master-plan', chapter: 1 };
  } else if (route.kind === 'master-plan') {
    const ch = course.masterPlan.chapters.find((c) => c.number === route.chapter);
    sectionCrumb = 'Part 1 · Master Study Plan';
    pageCrumb = ch ? `${ch.number}. ${ch.title}` : 'Master Plan';
    prevTarget =
      route.chapter > 1
        ? { kind: 'master-plan', chapter: route.chapter - 1 }
        : { kind: 'overview' };
    nextTarget =
      route.chapter < course.masterPlan.chapters.length
        ? { kind: 'master-plan', chapter: route.chapter + 1 }
        : { kind: 'day', day: 1, step: 1 };
  } else if (route.kind === 'day') {
    const d = course.days.find((x) => x.day === route.day);
    const st = d?.steps.find((s) => s.stepNumber === route.step);
    sectionCrumb = `Day 0${route.day} · ${d?.shortTitle || ''}`;
    pageCrumb = st ? `${st.stepNumber}. ${st.shortLabel}` : `Step ${route.step}`;

    if (route.step > 1) {
      prevTarget = { kind: 'day', day: route.day, step: route.step - 1 };
    } else if (route.day > 1) {
      prevTarget = { kind: 'day', day: route.day - 1, step: 10 };
    } else {
      prevTarget = { kind: 'master-plan', chapter: course.masterPlan.chapters.length };
    }

    if (route.step < 10) {
      nextTarget = { kind: 'day', day: route.day, step: route.step + 1 };
    } else if (route.day < 7) {
      nextTarget = { kind: 'day', day: route.day + 1, step: 1 };
    } else {
      nextTarget = { kind: 'vocab', tab: 'notebook' };
    }
  } else if (route.kind === 'vocab') {
    sectionCrumb = 'Active Study Studios';
    pageCrumb = '60-Word Vocabulary & Spaced-Review Studio';
    prevTarget = { kind: 'day', day: 7, step: 10 };
    nextTarget = { kind: 'error-log', tab: 'log' };
  } else if (route.kind === 'error-log') {
    sectionCrumb = 'Active Study Studios';
    pageCrumb = 'Diagnostic Error Log & Reflection Workbook';
    prevTarget = { kind: 'vocab', tab: 'notebook' };
  }

  const handleDownloadBackup = () => {
    const blob = new Blob([exportStateJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sat-1400-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMsg('Progress backup downloaded.');
  };

  const handleImport = () => {
    if (!importText.trim()) return;
    const ok = importStateJson(importText);
    setStatusMsg(ok ? 'Study progress restored!' : 'Invalid JSON backup format.');
    if (ok) setImportText('');
  };

  return (
    <>
      <header className="top-context-bar">
        <div className="top-bar-left">
          <button
            type="button"
            className="icon-btn mobile-menu-btn"
            onClick={onOpenMobileMenu}
            aria-label="Open Course Syllabus"
          >
            ☰ Syllabus
          </button>

          <button
            type="button"
            className="icon-btn desktop-focus-btn"
            onClick={onToggleFocus}
            title={focusMode ? 'Show Syllabus Sidebar' : 'Focus Mode (Hide Sidebar)'}
          >
            {focusMode ? '⇥ Show Syllabus' : '⇤ Focus'}
          </button>

          <div className="breadcrumb-trail">
            <span className="crumb-parent">{sectionCrumb}</span>
            <span className="crumb-sep" aria-hidden="true">
              /
            </span>
            <span className="crumb-current">{pageCrumb}</span>
          </div>
        </div>

        <div className="top-bar-actions">
          <button
            type="button"
            className="tool-chip-btn"
            onClick={() => setDesmosOpen((v) => !v)}
          >
            fx Desmos
          </button>

          <button
            type="button"
            className="tool-chip-btn"
            onClick={() => {
              setStatusMsg('');
              setDataModalOpen(true);
            }}
          >
            Backup
          </button>

          <div className="step-nav-pair">
            <button
              type="button"
              className="step-nav-btn"
              disabled={!prevTarget}
              onClick={() => prevTarget && navigate(prevTarget)}
              title="Previous section"
            >
              ← Prev
            </button>
            <button
              type="button"
              className="step-nav-btn"
              disabled={!nextTarget}
              onClick={() => nextTarget && navigate(nextTarget)}
              title="Next section"
            >
              Next →
            </button>
          </div>
        </div>
      </header>

      {/* Desmos Quick Reference & Embedded Calculator Drawer */}
      {desmosOpen && (
        <div className="floating-desmos-drawer" role="dialog" aria-label="Desmos Graphing Calculator">
          <div className="desmos-drawer-header">
            <div>
              <strong>Digital SAT Desmos Graphing Reference &amp; Scratchpad</strong>
              <span className="desmos-sub">5-Second Triage Companion</span>
            </div>
            <div className="desmos-header-btns">
              <a
                href="https://www.desmos.com/testing/cb-digital/graphing"
                target="_blank"
                rel="noopener noreferrer"
                className="desmos-ext-link"
              >
                Open Official CB Testing Calculator ↗
              </a>
              <button
                type="button"
                className="desmos-close-btn"
                onClick={() => setDesmosOpen(false)}
              >
                ✕
              </button>
            </div>
          </div>

          <div className="desmos-drawer-grid">
            <div className="desmos-cheatsheet">
              <h4>Essential Bluebook Desmos Shortcuts</h4>
              <ul>
                <li>
                  <code>y = f(x)</code> &amp; <code>y = g(x)</code> — Click gray intersection dots
                  for systems; check whether prompt asks for <code>x</code>, <code>y</code>, or{' '}
                  <code>x + y</code>.
                </li>
                <li>
                  <code>y_1 ~ a x_1^2 + b x_1 + c</code> — Add a <code>+ Table</code> of points to
                  fit exact linear, quadratic, or exponential functions in 15 seconds.
                </li>
                <li>
                  <code>mean(12, 15, 18, 21)</code> &amp; <code>median(...)</code> — Instant
                  one-variable statistics without arithmetic slips.
                </li>
                <li>
                  <code>a/b icon</code> — Converts any terminating/repeating decimal (like{' '}
                  <code>1.375</code>) into exact SPR fraction <code>11/8</code>.
                </li>
                <li>
                  <code>~ (Slider Regression)</code> — For constant identity questions, test{' '}
                  <code>x_1 = [2, 3, 5]</code> with <code>~</code> to solve constants immediately.
                </li>
              </ul>
            </div>
            <div className="desmos-iframe-wrap">
              <iframe
                title="Desmos Graphing Calculator"
                src="https://www.desmos.com/calculator"
                className="desmos-iframe"
              />
            </div>
          </div>
        </div>
      )}

      {/* Backup / Restore Modal */}
      {dataModalOpen && (
        <div className="modal-overlay" onClick={() => setDataModalOpen(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Study Progress Backup &amp; Restore</h3>
              <button
                type="button"
                className="desmos-close-btn"
                onClick={() => setDataModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <p className="modal-desc">
              Your checked steps, solved practice questions, vocabulary sentences, and Error Log
              entries are saved automatically in this browser. Export a JSON snapshot anytime to
              back up or move devices.
            </p>
            <div className="modal-actions-row">
              <button type="button" className="btn-primary" onClick={handleDownloadBackup}>
                Download Progress JSON
              </button>
              <button
                type="button"
                className="btn-danger-outline"
                onClick={() => {
                  if (
                    window.confirm(
                      'Clear all saved practice answers, checkboxes, and error log entries in this browser?'
                    )
                  ) {
                    resetAllProgress();
                    setStatusMsg('All saved progress has been reset.');
                  }
                }}
              >
                Reset Browser Progress
              </button>
            </div>

            <div className="modal-import-box">
              <label htmlFor="restore-json-input">Restore from JSON Snapshot</label>
              <textarea
                id="restore-json-input"
                rows={4}
                placeholder="Paste contents of your sat-1400-progress.json file here..."
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
              />
              <button type="button" className="btn-secondary" onClick={handleImport}>
                Import Snapshot
              </button>
            </div>
            {statusMsg && <p className="modal-status-msg">{statusMsg}</p>}
          </div>
        </div>
      )}
    </>
  );
};
