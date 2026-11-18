import React, { useEffect, useState } from 'react';
import { useAuth } from '../state/useAuth';

interface AuthPortalProps {
  variant: 'gate' | 'modal';
}

type EmailTab = 'signin' | 'signup' | 'otp' | 'reset';

const GoogleMarkSvg: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v2.98h3.86c2.26-2.09 3.56-5.17 3.56-8.8z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-2.98c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.27 14.31c-.24-.72-.38-1.49-.38-2.31s.14-1.59.38-2.31V6.6H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.4l3.98-3.09z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.6l3.98 3.09c.95-2.85 3.6-4.94 6.73-4.94z"
    />
  </svg>
);

export const AuthPortal: React.FC<AuthPortalProps> = ({ variant }) => {
  const {
    recoveryMode,
    urlAuthError,
    clearUrlAuthError,
    enterGuestMode,
    closeAuthModal,
    signInWithGoogle,
    signInWithEmailPassword,
    signUpWithEmailPassword,
    resendSignupConfirmation,
    sendEmailMagicLinkOrOtp,
    verifyEmailOtpCode,
    sendPasswordReset,
    completePasswordUpdate,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<EmailTab>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpToken, setOtpToken] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(urlAuthError);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [awaitingEmailConfirm, setAwaitingEmailConfirm] = useState(false);

  useEffect(() => {
    if (urlAuthError) {
      setErrorMsg(urlAuthError);
    }
  }, [urlAuthError]);

  const resetMessages = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (urlAuthError) clearUrlAuthError();
  };

  const switchTab = (next: EmailTab) => {
    setActiveTab(next);
    setAwaitingEmailConfirm(false);
    setOtpSent(false);
    resetMessages();
  };

  const handleGoogleClick = async () => {
    resetMessages();
    setBusy(true);
    const res = await signInWithGoogle();
    if (!res.ok) {
      setErrorMsg(res.message || 'Unable to connect to Google Sign-In.');
      setBusy(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (!email.trim() || !password) {
      setErrorMsg('Enter both your email address and password.');
      return;
    }
    setBusy(true);
    const res = await signInWithEmailPassword(email, password);
    setBusy(false);
    if (!res.ok) {
      setErrorMsg(res.message || 'Invalid login credentials.');
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (!email.trim()) {
      setErrorMsg('Enter your email address.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Choose a password of at least 6 characters.');
      return;
    }
    setBusy(true);
    const res = await signUpWithEmailPassword(email, password, displayName);
    setBusy(false);
    if (!res.ok) {
      setErrorMsg(res.message || 'Could not create account.');
      return;
    }
    if (res.needsEmailConfirmation) {
      setAwaitingEmailConfirm(true);
      setSuccessMsg(res.message || 'Check your email to confirm your account.');
    }
  };

  const handleResendConfirm = async () => {
    if (!email.trim()) return;
    setBusy(true);
    const res = await resendSignupConfirmation(email);
    setBusy(false);
    if (res.ok) setSuccessMsg(res.message || 'Confirmation email resent.');
    else setErrorMsg(res.message || 'Could not resend confirmation email.');
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (!email.trim()) {
      setErrorMsg('Enter your email address to receive a sign-in link and code.');
      return;
    }
    setBusy(true);
    const res = await sendEmailMagicLinkOrOtp(email);
    setBusy(false);
    if (!res.ok) {
      setErrorMsg(res.message || 'Unable to send sign-in email.');
      return;
    }
    setOtpSent(true);
    setSuccessMsg(res.message || 'Check your inbox for your sign-in link or code.');
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (!otpToken.trim()) {
      setErrorMsg('Enter the numeric code from your email.');
      return;
    }
    setBusy(true);
    const res = await verifyEmailOtpCode(email, otpToken);
    setBusy(false);
    if (!res.ok) {
      setErrorMsg(res.message || 'Invalid or expired code.');
    }
  };

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (!email.trim()) {
      setErrorMsg('Enter your account email to receive a password reset link.');
      return;
    }
    setBusy(true);
    const res = await sendPasswordReset(email);
    setBusy(false);
    if (res.ok) setSuccessMsg(res.message || 'Reset link sent.');
    else setErrorMsg(res.message || 'Unable to send password reset email.');
  };

  const handleCompleteRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (newPassword.length < 6) {
      setErrorMsg('Choose a new password of at least 6 characters.');
      return;
    }
    setBusy(true);
    const res = await completePasswordUpdate(newPassword);
    setBusy(false);
    if (!res.ok) {
      setErrorMsg(res.message || 'Unable to update password.');
    }
  };

  const renderFormCard = () => {
    if (recoveryMode) {
      return (
        <div className="auth-card">
          <div className="auth-card-header">
            <span className="section-kicker">ACCOUNT SECURITY</span>
            <h2>Set a New Password</h2>
            <p className="auth-card-sub">
              Enter your new password below to finish recovering your student workbook account.
            </p>
          </div>

          {errorMsg && <div className="auth-banner auth-banner-error">{errorMsg}</div>}
          {successMsg && <div className="auth-banner auth-banner-success">{successMsg}</div>}

          <form onSubmit={handleCompleteRecovery} className="auth-form">
            <label className="auth-field">
              <span>New Password</span>
              <input
                type="password"
                autoComplete="new-password"
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </label>
            <button type="submit" className="btn-primary auth-submit-btn" disabled={busy}>
              {busy ? 'Saving Password…' : 'Save New Password'}
            </button>
          </form>
        </div>
      );
    }

    return (
      <div className="auth-card">
        {variant === 'modal' && (
          <div className="auth-modal-toprow">
            <div>
              <span className="section-kicker">CLOUD WORKBOOK SYNC</span>
              <h2 className="auth-modal-heading">Sign in to save your progress</h2>
            </div>
            <button
              type="button"
              className="desmos-close-btn"
              onClick={closeAuthModal}
              aria-label="Close sign-in dialog"
            >
              ✕
            </button>
          </div>
        )}

        {variant === 'gate' && (
          <div className="auth-card-header">
            <span className="section-kicker">STUDENT SIGN-IN</span>
            <h2>Access Your Workbook</h2>
            <p className="auth-card-sub">
              Sign in with Google or Email to sync your practice sets, vocabulary mastery, and
              diagnostic error log across every device.
            </p>
          </div>
        )}

        {variant === 'modal' && (
          <p className="auth-merge-note">
            Any answers, completed steps, or Error Log entries already recorded in this browser
            will merge automatically into your account.
          </p>
        )}

        {errorMsg && <div className="auth-banner auth-banner-error">{errorMsg}</div>}
        {successMsg && <div className="auth-banner auth-banner-success">{successMsg}</div>}

        <button
          type="button"
          className="btn-google-oauth"
          onClick={handleGoogleClick}
          disabled={busy}
        >
          <GoogleMarkSvg />
          <span>Continue with Google</span>
        </button>

        <div className="auth-divider">
          <span>or continue with email</span>
        </div>

        <div className="auth-tabs" role="tablist" aria-label="Email authentication method">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'signin'}
            className={`auth-tab-btn ${activeTab === 'signin' ? 'is-active' : ''}`}
            onClick={() => switchTab('signin')}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'signup'}
            className={`auth-tab-btn ${activeTab === 'signup' ? 'is-active' : ''}`}
            onClick={() => switchTab('signup')}
          >
            Create Account
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'otp'}
            className={`auth-tab-btn ${activeTab === 'otp' ? 'is-active' : ''}`}
            onClick={() => switchTab('otp')}
          >
            Email Code
          </button>
        </div>

        {activeTab === 'signin' && (
          <form onSubmit={handleEmailSignIn} className="auth-form">
            <label className="auth-field">
              <span>Email Address</span>
              <input
                type="email"
                autoComplete="email"
                placeholder="student@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            <label className="auth-field">
              <div className="auth-field-row">
                <span>Password</span>
                <button
                  type="button"
                  className="auth-inline-link"
                  onClick={() => switchTab('reset')}
                >
                  Forgot password?
                </button>
              </div>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>

            <button type="submit" className="btn-primary auth-submit-btn" disabled={busy}>
              {busy ? 'Signing In…' : 'Sign In with Email →'}
            </button>
          </form>
        )}

        {activeTab === 'signup' && (
          <form onSubmit={handleEmailSignUp} className="auth-form">
            <label className="auth-field">
              <span>Student Name</span>
              <input
                type="text"
                autoComplete="name"
                placeholder="e.g. Alex Kim"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </label>

            <label className="auth-field">
              <span>Email Address</span>
              <input
                type="email"
                autoComplete="email"
                placeholder="student@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            <label className="auth-field">
              <span>Password</span>
              <input
                type="password"
                autoComplete="new-password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>

            <button type="submit" className="btn-primary auth-submit-btn" disabled={busy}>
              {busy ? 'Creating Account…' : 'Create Student Account →'}
            </button>

            {awaitingEmailConfirm && (
              <div className="auth-resend-row">
                <span>Didn’t receive the email?</span>
                <button
                  type="button"
                  className="auth-inline-link"
                  onClick={handleResendConfirm}
                  disabled={busy}
                >
                  Resend verification link
                </button>
              </div>
            )}
          </form>
        )}

        {activeTab === 'otp' && (
          <div className="auth-form">
            <form onSubmit={handleSendOtp} className="auth-form">
              <label className="auth-field">
                <span>Email Address</span>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="student@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>

              <button type="submit" className="btn-secondary auth-submit-btn" disabled={busy}>
                {busy
                  ? 'Sending…'
                  : otpSent
                  ? 'Resend Magic Link & Code'
                  : 'Send Magic Link & One-Time Code'}
              </button>
            </form>

            {otpSent && (
              <form onSubmit={handleVerifyOtp} className="auth-otp-verify-box">
                <label className="auth-field">
                  <span>Or enter the 6-digit code from your email</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="123456"
                    className="mono-num auth-otp-input"
                    value={otpToken}
                    onChange={(e) => setOtpToken(e.target.value)}
                  />
                </label>
                <button type="submit" className="btn-primary auth-submit-btn" disabled={busy}>
                  {busy ? 'Verifying…' : 'Verify Code & Sign In →'}
                </button>
              </form>
            )}
          </div>
        )}

        {activeTab === 'reset' && (
          <form onSubmit={handleSendReset} className="auth-form">
            <p className="auth-reset-note">
              Enter your account email and we’ll send a password recovery link.
            </p>
            <label className="auth-field">
              <span>Email Address</span>
              <input
                type="email"
                autoComplete="email"
                placeholder="student@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <button type="submit" className="btn-primary auth-submit-btn" disabled={busy}>
              {busy ? 'Sending Reset Link…' : 'Send Password Reset Link'}
            </button>
            <button
              type="button"
              className="auth-inline-link auth-back-link"
              onClick={() => switchTab('signin')}
            >
              ← Back to password sign-in
            </button>
          </form>
        )}

        {variant === 'gate' && (
          <div className="auth-guest-footer">
            <button type="button" className="btn-guest-continue" onClick={enterGuestMode}>
              Continue in Guest Mode (browser-only storage) →
            </button>
          </div>
        )}
      </div>
    );
  };

  if (variant === 'modal') {
    return (
      <div className="modal-overlay" onClick={closeAuthModal}>
        <div
          className="auth-modal-wrap"
          role="dialog"
          aria-modal="true"
          aria-label="Sign in to save your progress"
          onClick={(e) => e.stopPropagation()}
        >
          {renderFormCard()}
        </div>
      </div>
    );
  }

  return (
    <div className="auth-gate-shell">
      <div className="auth-gate-grid">
        <section className="auth-dossier-column">
          <div className="hero-eyebrow">
            <span>DEC 5, 2026 COHORT</span>
            <span className="dot-sep">·</span>
            <span>OFFICIAL BLUEBOOK-ALIGNED CURRICULUM</span>
          </div>

          <h1 className="auth-dossier-title">
            Digital SAT 1400+ Intensive Coursebook for International Learners
          </h1>

          <p className="auth-dossier-lead">
            A structured seven-day curriculum and 21-day exam runway engineered for non-native
            English speakers advancing from <strong>1200</strong> toward <strong>1400+</strong>—now
            backed by automatic cloud progress synchronization.
          </p>

          <div className="auth-feature-ledger">
            <div className="auth-ledger-row">
              <span className="auth-ledger-num mono-num">232</span>
              <div>
                <strong>Original R&amp;W + Math Practice Bank</strong>
                <p>
                  Every Multiple-Choice elimination, SPR response, confidence tag, and module
                  simulation syncs automatically across laptop and tablet.
                </p>
              </div>
            </div>

            <div className="auth-ledger-row">
              <span className="auth-ledger-num mono-num">60</span>
              <div>
                <strong>3-Layer Academic Vocabulary Studio</strong>
                <p>
                  Retain mastery statuses, starred words, custom vocabulary discoveries, and your
                  own English context sentences in your personal cloud profile.
                </p>
              </div>
            </div>

            <div className="auth-ledger-row">
              <span className="auth-ledger-num mono-num">E1–E10</span>
              <div>
                <strong>Diagnostic Error Log &amp; Daily Reflections</strong>
                <p>
                  Track root-cause patterns, 3+ recurring mistake alerts, and 15-minute evening
                  reflections privately with Row-Level Security.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="auth-form-column">{renderFormCard()}</section>
      </div>
    </div>
  );
};
