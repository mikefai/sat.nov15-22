import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
  consumeUrlAuthError,
  isSupabaseAuthCallbackHash,
  supabase,
  SUPABASE_PROJECT_URL,
  SUPABASE_PUBLISHABLE_KEY,
} from '../lib/supabase';
import type { ProfileRow } from '../types/supabase';

const GUEST_MODE_KEY = 'sat_1400_guest_mode_v1';
const PENDING_INSTRUCTOR_CODE_KEY = 'sat_1400_pending_instructor_code';
const PRIMARY_INSTRUCTOR_EMAIL = 'mikeperac@gmail.com';

export interface AuthActionResult {
  ok: boolean;
  needsEmailConfirmation?: boolean;
  message?: string;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: ProfileRow | null;
  isAdmin: boolean;
  adminLoading: boolean;
  adminNotice: string | null;
  clearAdminNotice: () => void;
  authLoading: boolean;
  guestMode: boolean;
  authModalOpen: boolean;
  recoveryMode: boolean;
  urlAuthError: string | null;
  clearUrlAuthError: () => void;
  enterGuestMode: () => void;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  signInWithGoogle: (instructorCode?: string) => Promise<AuthActionResult>;
  signInWithEmailPassword: (email: string, password: string) => Promise<AuthActionResult>;
  signUpWithEmailPassword: (
    email: string,
    password: string,
    displayName: string,
    instructorCode?: string
  ) => Promise<AuthActionResult>;
  claimInstructorAdmin: (passcode: string) => Promise<AuthActionResult>;
  resendSignupConfirmation: (email: string) => Promise<AuthActionResult>;
  sendEmailMagicLinkOrOtp: (email: string) => Promise<AuthActionResult>;
  verifyEmailOtpCode: (email: string, token: string) => Promise<AuthActionResult>;
  sendPasswordReset: (email: string) => Promise<AuthActionResult>;
  completePasswordUpdate: (newPassword: string) => Promise<AuthActionResult>;
  updateProfile: (patch: { display_name?: string; target_score?: number }) => Promise<AuthActionResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminNotice, setAdminNotice] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const adminSyncInFlightRef = useRef<{ userId: string; promise: Promise<void> } | null>(null);
  const [guestMode, setGuestMode] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(GUEST_MODE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [urlAuthError, setUrlAuthError] = useState<string | null>(() => consumeUrlAuthError());

  const invokeClaimInstructor = useCallback(async (passcode: string): Promise<AuthActionResult> => {
    const { data, error } = await supabase.functions.invoke('claim-instructor', {
      body: { passcode: passcode.trim() },
    });

    if (error) {
      return {
        ok: false,
        message: 'Invalid Instructor Access Code.',
      };
    }

    const parsed = data as { ok?: boolean; error?: string } | null;
    if (!parsed?.ok) {
      return {
        ok: false,
        message: parsed?.error || 'Invalid Instructor Access Code.',
      };
    }

    setIsAdmin(true);
    return { ok: true, message: 'Instructor Admin access unlocked.' };
  }, []);

  const syncAdminStatus = useCallback(
    (authUser: User): Promise<void> => {
      if (adminSyncInFlightRef.current?.userId === authUser.id) {
        return adminSyncInFlightRef.current.promise;
      }

      setAdminLoading(true);
      const run = (async () => {
        try {
          let pendingCode: string | null = null;
          try {
            pendingCode = window.localStorage.getItem(PENDING_INSTRUCTOR_CODE_KEY);
          } catch {
            pendingCode = null;
          }

          if (pendingCode) {
            const claimRes = await invokeClaimInstructor(pendingCode);
            try {
              window.localStorage.removeItem(PENDING_INSTRUCTOR_CODE_KEY);
            } catch {
              // Ignore storage restrictions
            }
            if (claimRes.ok) {
              setIsAdmin(true);
              return;
            }
            setAdminNotice(
              'Account signed in, though the Instructor Access Code did not match. You can re-enter it in your Account menu.'
            );
          }

          const { data: rpcAdmin } = await supabase.rpc('is_my_account_admin');
          if (rpcAdmin) {
            setIsAdmin(true);
            return;
          }

          if (
            Boolean(authUser.email_confirmed_at) &&
            (authUser.email ?? '').trim().toLowerCase() === PRIMARY_INSTRUCTOR_EMAIL
          ) {
            const autoRes = await invokeClaimInstructor('');
            setIsAdmin(Boolean(autoRes.ok));
            return;
          }

          setIsAdmin(false);
        } finally {
          if (adminSyncInFlightRef.current?.userId === authUser.id) {
            adminSyncInFlightRef.current = null;
          }
          setAdminLoading(false);
        }
      })();

      adminSyncInFlightRef.current = { userId: authUser.id, promise: run };
      return run;
    },
    [invokeClaimInstructor]
  );

  const fetchOrEnsureProfile = useCallback(async (authUser: User) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (!error && data) {
      setProfile(data);
      return;
    }

    const fallbackName =
      (authUser.user_metadata?.full_name as string | undefined) ||
      (authUser.user_metadata?.name as string | undefined) ||
      (authUser.email ? authUser.email.split('@')[0] : 'Student');

    const fallbackAvatar =
      (authUser.user_metadata?.avatar_url as string | undefined) ||
      (authUser.user_metadata?.picture as string | undefined) ||
      null;

    const { data: upserted } = await supabase
      .from('profiles')
      .upsert(
        {
          id: authUser.id,
          email: authUser.email ?? null,
          display_name: fallbackName,
          avatar_url: fallbackAvatar,
        },
        { onConflict: 'id' }
      )
      .select('*')
      .maybeSingle();

    if (upserted) {
      setProfile(upserted);
    }
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (!active) return;
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user) {
        void fetchOrEnsureProfile(initialSession.user);
        await syncAdminStatus(initialSession.user);
      }
      if (active) setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true);
        setAuthModalOpen(true);
      }

      if (nextSession?.user) {
        void fetchOrEnsureProfile(nextSession.user);
        void syncAdminStatus(nextSession.user);
        setAuthModalOpen((prev) => (event === 'PASSWORD_RECOVERY' ? prev : false));

        const url = new URL(window.location.href);
        if (url.searchParams.has('code') || isSupabaseAuthCallbackHash(window.location.hash)) {
          url.searchParams.delete('code');
          const safeHash = isSupabaseAuthCallbackHash(window.location.hash)
            ? '#/overview'
            : window.location.hash || '#/overview';
          window.history.replaceState({}, document.title, url.pathname + url.search + safeHash);
        }
      } else {
        setProfile(null);
        setIsAdmin(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [fetchOrEnsureProfile, syncAdminStatus]);

  const enterGuestMode = useCallback(() => {
    setGuestMode(true);
    try {
      window.localStorage.setItem(GUEST_MODE_KEY, 'true');
    } catch {
      // Ignore storage failures cleanly
    }
  }, []);

  const openAuthModal = useCallback(() => setAuthModalOpen(true), []);
  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
    setRecoveryMode(false);
  }, []);

  const clearUrlAuthError = useCallback(() => setUrlAuthError(null), []);
  const clearAdminNotice = useCallback(() => setAdminNotice(null), []);

  const signInWithGoogle = useCallback(async (instructorCode?: string): Promise<AuthActionResult> => {
    try {
      try {
        const settingsRes = await fetch(`${SUPABASE_PROJECT_URL}/auth/v1/settings`, {
          headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
        });
        if (settingsRes.ok) {
          const settingsJson = (await settingsRes.json()) as {
            external?: { google?: boolean };
          };
          if (settingsJson.external && settingsJson.external.google === false) {
            return {
              ok: false,
              message:
                'Google OAuth is wired up in the app, and just needs your Google Client ID & Secret enabled in Supabase Dashboard → Authentication → Sign In / Providers → Google. Meanwhile, Email sign-in below works immediately.',
            };
          }
        }
      } catch {
        // Proceed directly to OAuth redirect if pre-flight check is unreachable
      }

      if (instructorCode?.trim()) {
        try {
          window.localStorage.setItem(PENDING_INSTRUCTOR_CODE_KEY, instructorCode.trim());
        } catch {
          // Ignore storage restrictions
        }
      }

      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
        },
      });
      if (error) {
        return { ok: false, message: error.message };
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Unable to start Google sign-in.',
      };
    }
  }, []);

  const signInWithEmailPassword = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
      const cleanEmail = email.trim();
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (error) {
        return { ok: false, message: error.message };
      }
      return { ok: true, message: 'Signed in successfully.' };
    },
    []
  );

  const signUpWithEmailPassword = useCallback(
    async (
      email: string,
      password: string,
      displayName: string,
      instructorCode?: string
    ): Promise<AuthActionResult> => {
      const cleanEmail = email.trim();
      const cleanName = displayName.trim() || cleanEmail.split('@')[0];
      const cleanCode = (instructorCode || '').trim();
      const redirectTo = `${window.location.origin}${window.location.pathname}`;

      if (cleanCode) {
        try {
          window.localStorage.setItem(PENDING_INSTRUCTOR_CODE_KEY, cleanCode);
        } catch {
          // Ignore storage restrictions
        }
      }

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            full_name: cleanName,
          },
        },
      });

      if (error) {
        try {
          window.localStorage.removeItem(PENDING_INSTRUCTOR_CODE_KEY);
        } catch {
          // Ignore
        }
        return { ok: false, message: error.message };
      }

      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        try {
          window.localStorage.removeItem(PENDING_INSTRUCTOR_CODE_KEY);
        } catch {
          // Ignore
        }
        return {
          ok: false,
          message:
            'An account with this email already exists. Switch to the Sign In tab or reset your password.',
        };
      }

      if (data.session && data.user) {
        await syncAdminStatus(data.user);
        return { ok: true, message: 'Account created and signed in.' };
      }

      return {
        ok: true,
        needsEmailConfirmation: true,
        message: `Verification email sent to ${cleanEmail}. Click the confirmation link in your inbox to activate your account.`,
      };
    },
    [syncAdminStatus]
  );

  const claimInstructorAdmin = useCallback(
    async (passcode: string): Promise<AuthActionResult> => {
      if (!passcode.trim() && (user?.email ?? '').trim().toLowerCase() !== PRIMARY_INSTRUCTOR_EMAIL) {
        return { ok: false, message: 'Enter your Instructor Access Code.' };
      }
      return invokeClaimInstructor(passcode);
    },
    [invokeClaimInstructor, user?.email]
  );

  const resendSignupConfirmation = useCallback(
    async (email: string): Promise<AuthActionResult> => {
      const cleanEmail = email.trim();
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: cleanEmail,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) {
        return { ok: false, message: error.message };
      }
      return {
        ok: true,
        message: `Sent a fresh confirmation email to ${cleanEmail}.`,
      };
    },
    []
  );

  const sendEmailMagicLinkOrOtp = useCallback(
    async (email: string): Promise<AuthActionResult> => {
      const cleanEmail = email.trim();
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          emailRedirectTo: redirectTo,
        },
      });
      if (error) {
        return { ok: false, message: error.message };
      }
      return {
        ok: true,
        message: `Sent a sign-in link and one-time code to ${cleanEmail}. Click the link in your email or enter the code below.`,
      };
    },
    []
  );

  const verifyEmailOtpCode = useCallback(
    async (email: string, token: string): Promise<AuthActionResult> => {
      const cleanEmail = email.trim();
      const cleanToken = token.trim();
      const { error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanToken,
        type: 'email',
      });
      if (error) {
        return { ok: false, message: error.message };
      }
      return { ok: true, message: 'Signed in successfully.' };
    },
    []
  );

  const sendPasswordReset = useCallback(async (email: string): Promise<AuthActionResult> => {
    const cleanEmail = email.trim();
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo,
    });
    if (error) {
      return { ok: false, message: error.message };
    }
    return {
      ok: true,
      message: `Password reset instructions sent to ${cleanEmail}.`,
    };
  }, []);

  const completePasswordUpdate = useCallback(
    async (newPassword: string): Promise<AuthActionResult> => {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        return { ok: false, message: error.message };
      }
      setRecoveryMode(false);
      setAuthModalOpen(false);
      return { ok: true, message: 'Your password has been updated.' };
    },
    []
  );

  const updateProfile = useCallback(
    async (patch: { display_name?: string; target_score?: number }): Promise<AuthActionResult> => {
      if (!user) return { ok: false, message: 'Not signed in.' };
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', user.id)
        .select('*')
        .maybeSingle();

      if (error) {
        return { ok: false, message: error.message };
      }
      if (data) setProfile(data);
      return { ok: true, message: 'Profile saved.' };
    },
    [user]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
    setAdminNotice(null);
    setGuestMode(false);
    try {
      window.localStorage.removeItem(GUEST_MODE_KEY);
      window.localStorage.removeItem(PENDING_INSTRUCTOR_CODE_KEY);
    } catch {
      // Ignore storage failures cleanly
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      isAdmin,
      adminLoading,
      adminNotice,
      clearAdminNotice,
      authLoading,
      guestMode,
      authModalOpen,
      recoveryMode,
      urlAuthError,
      clearUrlAuthError,
      enterGuestMode,
      openAuthModal,
      closeAuthModal,
      signInWithGoogle,
      signInWithEmailPassword,
      signUpWithEmailPassword,
      claimInstructorAdmin,
      resendSignupConfirmation,
      sendEmailMagicLinkOrOtp,
      verifyEmailOtpCode,
      sendPasswordReset,
      completePasswordUpdate,
      updateProfile,
      signOut,
    }),
    [
      user,
      session,
      profile,
      isAdmin,
      adminLoading,
      adminNotice,
      clearAdminNotice,
      authLoading,
      guestMode,
      authModalOpen,
      recoveryMode,
      urlAuthError,
      clearUrlAuthError,
      enterGuestMode,
      openAuthModal,
      closeAuthModal,
      signInWithGoogle,
      signInWithEmailPassword,
      signUpWithEmailPassword,
      claimInstructorAdmin,
      resendSignupConfirmation,
      sendEmailMagicLinkOrOtp,
      verifyEmailOtpCode,
      sendPasswordReset,
      completePasswordUpdate,
      updateProfile,
      signOut,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
