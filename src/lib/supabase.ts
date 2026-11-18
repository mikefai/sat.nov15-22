import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

export const SUPABASE_PROJECT_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://hnbjmogcxgmabqdbfucu.supabase.co';

export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_3K7tO-vEBVtFe5OmE25SAw_79IlMG6b';

export const supabase = createClient<Database>(
  SUPABASE_PROJECT_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'sat_1400_supabase_auth',
    },
  }
);

/**
 * Checks whether the current URL hash or query string carries a Supabase OAuth / email callback
 * error or token so our SPA hash router doesn't overwrite or misparse it.
 */
export function isSupabaseAuthCallbackHash(hash: string): boolean {
  return /^#(access_token=|error=|type=recovery|refresh_token=)/i.test(hash);
}

export function consumeUrlAuthError(): string | null {
  try {
    const url = new URL(window.location.href);
    let errDesc =
      url.searchParams.get('error_description') || url.searchParams.get('error');

    if (!errDesc && window.location.hash.includes('error')) {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      errDesc = hashParams.get('error_description') || hashParams.get('error');
    }

    if (!errDesc) return null;

    const decoded = decodeURIComponent(errDesc.replace(/\+/g, ' '));

    // Clean OAuth error params from the address bar cleanly
    url.searchParams.delete('error');
    url.searchParams.delete('error_code');
    url.searchParams.delete('error_description');
    const cleanHash = isSupabaseAuthCallbackHash(window.location.hash)
      ? '#/overview'
      : window.location.hash;
    window.history.replaceState({}, document.title, url.pathname + url.search + cleanHash);

    if (/provider is not enabled/i.test(decoded)) {
      return 'Google Sign-In needs to be enabled in Supabase Dashboard → Authentication → Sign In / Providers → Google (with your Google OAuth Client ID & Secret). Email sign-in works right away below.';
    }
    return decoded;
  } catch {
    return null;
  }
}
