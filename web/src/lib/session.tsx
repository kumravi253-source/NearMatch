import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { requestAndSaveLocation } from './location';
import { AGE_ATTESTATION_TEXT, DPDP_CONSENT_TEXT } from './legal';
import type { Profile } from './types';

// Web counterpart of the session/profile bookkeeping in App.js.
//
// `undefined` means "not resolved yet" and `null` means "resolved, nothing
// there" for both session and profile. The distinction drives the routing:
// undefined renders the splash, null sends the user to auth (no session) or
// to profile setup (session but no profile row).

type SessionState = {
  session: Session | undefined | null;
  profile: Profile | undefined | null;
  /** Auth resolved and, if signed in, the profile row fetched. */
  ready: boolean;
  setProfile: (profile: Profile) => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Stashed from the signup form and consumed once a session exists. */
  setPendingReferralCode: (code: string) => void;
};

const SessionContext = createContext<SessionState | null>(null);

// Postgres unique_violation. Both consent inserts are unique on user_id, so a
// repeat login hitting an existing row is the expected path, not an error.
const UNIQUE_VIOLATION = '23505';

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | undefined | null>(undefined);
  const [profile, setProfileState] = useState<Profile | undefined | null>(undefined);
  const pendingReferralCode = useRef<string | null>(null);
  const locationRequested = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;

  useEffect(() => {
    if (session === undefined) return;
    if (session === null) {
      setProfileState(undefined);
      return;
    }
    let cancelled = false;
    setProfileState(undefined);
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error('Failed to load profile', error);
        setProfileState((data as Profile | null) ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  // Durable consent records. The signup form gates on both checkboxes, so by
  // the time a session exists the user has already agreed — this just logs it
  // the first time we can. Unique on user_id, so repeat logins no-op.
  useEffect(() => {
    if (!userId) return;

    supabase
      .from('legal_attestations')
      .insert({ user_id: userId, attestation_text: AGE_ATTESTATION_TEXT })
      .then(({ error }) => {
        if (error && error.code !== UNIQUE_VIOLATION) {
          console.error('Failed to record age attestation', error);
        }
      });

    supabase
      .from('dpdp_consents')
      .insert({ user_id: userId, consent_text: DPDP_CONSENT_TEXT })
      .then(({ error }) => {
        if (error && error.code !== UNIQUE_VIOLATION) {
          console.error('Failed to record DPDP consent', error);
        }
      });

    if (pendingReferralCode.current) {
      const code = pendingReferralCode.current;
      pendingReferralCode.current = null;
      supabase.rpc('record_referral', { p_referral_code: code }).then(({ error }) => {
        if (error) console.error('Failed to record referral', error);
      });
    }

    // Enforces its own date window and 300-slot cap server-side and returns
    // false outside them, so calling unconditionally is safe.
    supabase.rpc('claim_launch_promo').then(({ error }) => {
      if (error) console.error('Failed to claim launch promo', error);
    });
  }, [userId]);

  // Once per session, after the profile exists. Silent no-op if the user
  // declines the browser permission prompt.
  useEffect(() => {
    if (!userId || !profile || locationRequested.current) return;
    locationRequested.current = true;
    requestAndSaveLocation(userId);
  }, [userId, profile]);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('Failed to refresh profile', error);
      return;
    }
    setProfileState((data as Profile | null) ?? null);
  }, [userId]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // onAuthStateChange clears the session; reset the once-per-session guard
    // so the next sign-in asks for location again.
    locationRequested.current = false;
  }, []);

  const value = useMemo<SessionState>(
    () => ({
      session,
      profile,
      ready: session !== undefined && (session === null || profile !== undefined),
      setProfile: (next: Profile) => setProfileState(next),
      refreshProfile,
      signOut,
      setPendingReferralCode: (code: string) => {
        pendingReferralCode.current = code || null;
      },
    }),
    [session, profile, refreshProfile, signOut]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside <SessionProvider>');
  return context;
}

/** For screens that only render behind an authenticated route and would
 *  otherwise need a null check on every access. */
export function useAuthedSession() {
  const state = useSession();
  if (!state.session || !state.profile) {
    throw new Error('useAuthedSession used outside an authenticated route');
  }
  return { ...state, session: state.session, profile: state.profile };
}
