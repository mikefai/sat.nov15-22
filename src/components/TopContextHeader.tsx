import React, { useEffect, useState } from 'react';
import type { CourseData, RouteView } from '../types/course';
import { useAuth } from '../state/useAuth';
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
  const {
    user,
    profile,
    isAdmin,
    adminNotice,
    clearAdminNotice,
    openAuthModal,
    claimInstructorAdmin,
    updateProfile,
    signOut,
  } = useAuth();
  const {
    route,
    syncStatus,
    lastSyncedAt,
    syncNow,
    navigate,
    exportStateJson,
    importStateJson,
    resetAllProgress,
  } = useCourseStore();

  const [desmosOpen, setDesmosOpen] = useState(false);
  const [dataModalOpen, setDataModalOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const [editName, setEditName] = useState('');
  const [editTarget, setEditTarget] = useState(1400);
  const [accountMsg, setAccountMsg] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [showClaimInput, setShowClaimInput] = useState(false);
  const [claimCode, setClaimCode] = useState('');
  const [claimingAdmin, setClaimingAdmin] = useState(false);

  useEffect(() => {
    if (profile) {
      setEditName(profile.display_name || '');
      setEditTarget(profile.target_score || 1400);
    } else if (user?.email) {
      setEditName(user.email.split('@')[0]);
    }
  }, [profile, user?.email]);

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
  } else if (route.kind === 'admin') {
    sectionCrumb = 'Instructor Portal';
    pageCrumb = 'Student Cohort & Progress Inspector';
    prevTarget = { kind: 'overview' };
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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setAccountMsg('');
    const clampedTarget = Math.min(1600, Math.max(400, Number(editTarget) || 1400));
    const res = await updateProfile({
      display_name: editName.trim() || null || undefined,
      target_score: clampedTarget,
    });
    setSavingProfile(false);
    setAccountMsg(res.message || (res.ok ? 'Saved.' : 'Could not update profile.'));
  };

  const displayLabel =
    profile?.display_name || (user?.email ? user.email.split('@')[0] : 'Account');
  const avatarInitial = (displayLabel[0] || 'S').toUpperCase();

  const syncBadgeLabel =
    syncStatus === 'saving' || syncStatus === 'loading'
      ? 'Syncing…'
      : syncStatus === 'synced'
      ? 'Synced'
      : syncStatus === 'error'
      ? 'Sync Retry'
      : 'Local';

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

          {isAdmin && (
            <button
              type="button"
              className={`tool-chip-btn btn-instructor-chip ${
                route.kind === 'admin' ? 'is-active-chip' : ''
              }`}
              onClick={() => navigate({ kind: 'admin' })}
              title="Open Instructor Student Inspector"
            >
              Instructor
            </button>
          )}

          {user ? (
            <button
              type="button"
              className="account-sync-pill"
              onClick={() => {
                setAccountMsg('');
                setAccountModalOpen(true);
              }}
              title="Student Account & Cloud Sync"
            >
              <span className="account-avatar-dot">{avatarInitial}</span>
              <span className="account-pill-name">{displayLabel}</span>
              <span className={`sync-status-dot status-${syncStatus}`} />
              <span className="sync-status-text">{syncBadgeLabel}</span>
            </button>
          ) : (
            <button
              type="button"
              className="btn-signin-chip"
              onClick={openAuthModal}
              title="Sign in with Google or Email to sync your progress"
            >
              Sign In · Sync
            </button>
          )}

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

      {adminNotice && (
        <div className="admin-top-notice" role="status">
          <span>{adminNotice}</span>
          <button type="button" className="auth-inline-link" onClick={clearAdminNotice}>
            Dismiss
          </button>
        </div>
      )}

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
              {user
                ? `Signed in as ${user.email}. Your study progress syncs automatically to your cloud account and is also cached locally.`
                : 'Your checked steps, solved practice questions, vocabulary sentences, and Error Log entries are saved in this browser. Sign in to sync across devices or export a JSON snapshot.'}
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
                      user
                        ? 'Clear all saved practice answers, checkboxes, and error log entries in both this browser and your cloud account?'
                        : 'Clear all saved practice answers, checkboxes, and error log entries in this browser?'
                    )
                  ) {
                    resetAllProgress();
                    setStatusMsg('All saved progress has been reset.');
                  }
                }}
              >
                Reset All Progress
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

      {/* Authenticated Student Account & Cloud Sync Modal */}
      {accountModalOpen && user && (
        <div className="modal-overlay" onClick={() => setAccountModalOpen(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Student Account &amp; Cloud Sync</h3>
              <button
                type="button"
                className="desmos-close-btn"
                onClick={() => setAccountModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="account-summary-strip">
              <div className="account-avatar-lg">{avatarInitial}</div>
              <div className="account-meta-col">
                <strong>{displayLabel}</strong>
                <span>{user.email}</span>
                <span className="account-sync-caption mono-num">
                  Status: {syncBadgeLabel}
                  {lastSyncedAt
                    ? ` · Last saved ${new Date(lastSyncedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}`
                    : ''}
                </span>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="account-profile-form">
              <div className="account-form-grid">
                <label className="auth-field">
                  <span>Display Name</span>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Your name"
                  />
                </label>
                <label className="auth-field">
                  <span>Target SAT Score</span>
                  <input
                    type="number"
                    min={400}
                    max={1600}
                    step={10}
                    className="mono-num"
                    value={editTarget}
                    onChange={(e) => setEditTarget(Number(e.target.value))}
                  />
                </label>
              </div>

              <div className="account-actions-bar">
                <button type="submit" className="btn-primary" disabled={savingProfile}>
                  {savingProfile ? 'Saving…' : 'Save Profile'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={async () => {
                    await syncNow();
                    setAccountMsg('Progress synced to Supabase cloud.');
                  }}
                >
                  Sync Now
                </button>
                <button
                  type="button"
                  className="btn-danger-outline"
                  onClick={async () => {
                    setAccountModalOpen(false);
                    await signOut();
                  }}
                >
                  Sign Out
                </button>
              </div>
            </form>

            {accountMsg && <p className="modal-status-msg">{accountMsg}</p>}

            <div className="account-instructor-section">
              {isAdmin ? (
                <div className="instructor-unlocked-row">
                  <span className="day-badge badge-ochre">INSTRUCTOR ADMIN</span>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setAccountModalOpen(false);
                      navigate({ kind: 'admin' });
                    }}
                  >
                    Open Student Cohort Inspector →
                  </button>
                </div>
              ) : (
                <div>
                  <button
                    type="button"
                    className="auth-inline-link"
                    onClick={() => setShowClaimInput((v) => !v)}
                  >
                    {showClaimInput
                      ? '▾ Hide instructor access code'
                      : '▸ Course instructor? Unlock student cohort view'}
                  </button>
                  {showClaimInput && (
                    <div className="instructor-claim-row">
                      <input
                        type="password"
                        placeholder="Instructor Access Code"
                        value={claimCode}
                        onChange={(e) => setClaimCode(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={claimingAdmin}
                        onClick={async () => {
                          setClaimingAdmin(true);
                          setAccountMsg('');
                          const res = await claimInstructorAdmin(claimCode);
                          setClaimingAdmin(false);
                          setAccountMsg(res.message || '');
                          if (res.ok) {
                            setClaimCode('');
                            setShowClaimInput(false);
                          }
                        }}
                      >
                        {claimingAdmin ? 'Checking…' : 'Unlock'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
