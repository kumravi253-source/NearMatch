import { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useFonts } from 'expo-font';
import { ObserveRoot, useObserve } from 'expo-observe';
import { Pacifico_400Regular } from '@expo-google-fonts/pacifico';
import { Quicksand_400Regular, Quicksand_500Medium, Quicksand_700Bold } from '@expo-google-fonts/quicksand';
import { supabase } from './src/lib/supabase';
import { requestAndSaveLocation } from './src/lib/location';
import { AGE_ATTESTATION_TEXT, DPDP_CONSENT_TEXT } from './src/lib/legal';
import { COLORS, FONTS } from './src/theme/theme';
import AuthScreen from './src/screens/auth/AuthScreen';
import ProfileSetupScreen from './src/screens/profile/ProfileSetupScreen';
import SwipeScreen from './src/screens/swipe/SwipeScreen';
import MatchesScreen from './src/screens/matches/MatchesScreen';
import ChatScreen from './src/screens/chat/ChatScreen';
import VerifyAgeScreen from './src/screens/verify/VerifyAgeScreen';
import LikesScreen from './src/screens/likes/LikesScreen';
import NextFeatureScreen from './src/screens/next/NextFeatureScreen';
import { vexo } from 'vexo-analytics';

// Initialize Vexo at module scope, before any component mounts. Guarded to
// production so development sessions don't pollute analytics.
if (__DEV__ === false) {
  vexo('8facfbf4-0055-4782-9e17-c3c9728a6025');
}

const TABS = [
  { key: 'swipe', label: 'Discover', icon: '🔥' },
  { key: 'likes', label: 'Likes', icon: '💫' },
  { key: 'matches', label: 'Matches', icon: '💛' },
  { key: 'chat', label: 'Chat', icon: '💬' },
  { key: 'next', label: 'Next', icon: '✨' },
];

function App() {
  const { markInteractive } = useObserve();
  const [fontsLoaded] = useFonts({
    Pacifico_400Regular,
    Quicksand_400Regular,
    Quicksand_500Medium,
    Quicksand_700Bold,
  });
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(undefined);
  const [splashScreen, setSplashScreen] = useState('splash');
  const [authMode, setAuthMode] = useState('login');
  const [tab, setTab] = useState('swipe');
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [showVerifyAge, setShowVerifyAge] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const locationRequestedRef = useRef(false);
  const pendingReferralCodeRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    if (session === null) {
      setProfile(undefined);
      setSplashScreen('splash');
      setTab('swipe');
      setSelectedChatId(null);
      return;
    }
    let cancelled = false;
    setProfile(undefined);
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('Failed to load profile', error);
        }
        setProfile(data ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (!session) return;
    // Records the 18+ attestation the user agreed to at signup. The
    // signup form requires the checkbox before it submits, so by the
    // time any session exists, the attestation already happened —
    // this just durably logs it the first time we can (unique on
    // user_id, so repeat logins are harmless no-ops).
    supabase
      .from('legal_attestations')
      .insert({ user_id: session.user.id, attestation_text: AGE_ATTESTATION_TEXT })
      .then(({ error }) => {
        if (error && error.code !== '23505') {
          console.error('Failed to record age attestation', error);
        }
      });
    // Same idea, but for DPDP Act 2023 consent to data processing —
    // a separate durable record from the age attestation above, since
    // they're distinct legal requirements.
    supabase
      .from('dpdp_consents')
      .insert({ user_id: session.user.id, consent_text: DPDP_CONSENT_TEXT })
      .then(({ error }) => {
        if (error && error.code !== '23505') {
          console.error('Failed to record DPDP consent', error);
        }
      });
    // If the signup form had a referral code typed in, record it once.
    // record_referral is a one-shot per account server-side (unique on
    // referred_id) regardless, but clearing the ref means a re-login
    // on the same device doesn't even bother trying again.
    if (pendingReferralCodeRef.current) {
      const code = pendingReferralCodeRef.current;
      pendingReferralCodeRef.current = null;
      supabase.rpc('record_referral', { p_referral_code: code }).then(({ error }) => {
        if (error) {
          console.error('Failed to record referral', error);
        }
      });
    }
    // Launch promo: first 300 signups on or after launch get 15 days
    // of free Premium. The function itself enforces the date and the
    // 300-slot cap server-side and just no-ops (returns false) outside
    // those conditions, so it's safe to call unconditionally here too.
    supabase.rpc('claim_launch_promo').then(({ error }) => {
      if (error) {
        console.error('Failed to claim launch promo', error);
      }
    });
  }, [session]);

  useEffect(() => {
    // Fires once per app session, the first time we have both a
    // session and a completed profile — covers brand-new signups and
    // existing users alike (existing users won't have a
    // profile_locations row yet either, so this backfills them on
    // their next open). requestAndSaveLocation no-ops silently on
    // denial, so this is safe to call unconditionally.
    if (!session || !profile || locationRequestedRef.current) return;
    locationRequestedRef.current = true;
    requestAndSaveLocation(session.user.id);
  }, [session, profile]);

  useEffect(() => {
    // Fires once the loading gate below clears, whichever screen the
    // user lands on: the logged-out splash, profile setup for new
    // signups, or the main tabs for returning users.
    const stillLoading = !fontsLoaded || session === undefined || (session && profile === undefined);
    if (stillLoading) return;
    markInteractive();
  }, [fontsLoaded, session, profile, markInteractive]);

  const handleProfileComplete = (savedProfile) => {
    setProfile(savedProfile);
    setEditingProfile(false);
  };

  const handleOpenChat = (matchId) => {
    setSelectedChatId(matchId);
    setTab('chat');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleVerifyAgeDone = async () => {
    setShowVerifyAge(false);
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    if (data) setProfile(data);
  };

  if (!fontsLoaded || session === undefined || (session && profile === undefined)) {
    return (
      <View style={styles.splash}>
        <StatusBar style="auto" />
        <ActivityIndicator size="large" color={COLORS.coral} />
      </View>
    );
  }

  if (session === null) {
    if (splashScreen === 'auth') {
      return (
        <AuthScreen
          initialMode={authMode}
          onBack={() => setSplashScreen('splash')}
          onSuccess={(_mode, referralCode) => {
            if (referralCode) pendingReferralCodeRef.current = referralCode;
          }}
        />
      );
    }
    return (
      <View style={styles.splash}>
        <StatusBar style="auto" />
        <Text style={styles.logo}>NearMatch</Text>
        <Text style={styles.tagline}>Warm connections, just around the corner</Text>
        <TouchableOpacity style={styles.btnPrimary} onPress={() => { setAuthMode('signup'); setSplashScreen('auth'); }}>
          <Text style={styles.btnPrimaryText}>Create Account</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => { setAuthMode('login'); setSplashScreen('auth'); }}>
          <Text style={styles.btnSecondaryText}>Sign In</Text>
        </TouchableOpacity>
        <Text style={styles.terms}>By continuing, you agree to our Terms & Privacy Policy</Text>
      </View>
    );
  }

  if (profile === null) {
    return <ProfileSetupScreen userId={session.user.id} onComplete={handleProfileComplete} />;
  }

  if (showVerifyAge) {
    return <VerifyAgeScreen onDone={handleVerifyAgeDone} />;
  }

  if (editingProfile) {
    return (
      <ProfileSetupScreen
        userId={session.user.id}
        existingProfile={profile}
        onComplete={handleProfileComplete}
        onCancel={() => setEditingProfile(false)}
      />
    );
  }

  return (
    <View style={styles.mainContainer}>
      <StatusBar style="auto" />
      <View style={styles.tabContent}>
        <View style={tab === 'swipe' ? styles.tabPane : styles.tabPaneHidden}>
          <SwipeScreen
            userId={session.user.id}
            onSignOut={handleSignOut}
            isAgeVerified={profile.age_verified}
            onVerifyAge={() => setShowVerifyAge(true)}
            onEditProfile={() => setEditingProfile(true)}
            referralCode={profile.referral_code}
          />
        </View>
        <View style={tab === 'likes' ? styles.tabPane : styles.tabPaneHidden}>
          <LikesScreen active={tab === 'likes'} />
        </View>
        <View style={tab === 'matches' ? styles.tabPane : styles.tabPaneHidden}>
          <MatchesScreen userId={session.user.id} active={tab === 'matches'} onOpenChat={handleOpenChat} />
        </View>
        <View style={tab === 'chat' ? styles.tabPane : styles.tabPaneHidden}>
          <ChatScreen
            userId={session.user.id}
            active={tab === 'chat'}
            selectedChatId={selectedChatId}
            onSelectChat={setSelectedChatId}
          />
        </View>
        <View style={tab === 'next' ? styles.tabPane : styles.tabPaneHidden}>
          <NextFeatureScreen userId={session.user.id} active={tab === 'next'} />
        </View>
      </View>

      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={styles.tabBtn}
            onPress={() => { setTab(t.key); if (t.key !== 'chat') setSelectedChatId(null); }}
          >
            <Text style={[styles.tabIcon, tab === t.key && styles.tabIconActive]}>{t.icon}</Text>
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
  logo: { fontFamily: FONTS.logo, fontSize: 42, color: COLORS.coral, textAlign: 'center', marginBottom: 10 },
  tagline: { fontFamily: FONTS.medium, fontSize: 16, color: COLORS.teal, textAlign: 'center', marginBottom: 60, lineHeight: 24 },
  btnPrimary: { width: '100%', backgroundColor: COLORS.coral, borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 12 },
  btnPrimaryText: { fontFamily: FONTS.bold, color: COLORS.white, fontSize: 16 },
  btnSecondary: { width: '100%', backgroundColor: COLORS.teal, borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 32 },
  btnSecondaryText: { fontFamily: FONTS.bold, color: COLORS.white, fontSize: 16 },
  terms: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary, textAlign: 'center' },
  mainContainer: { flex: 1, backgroundColor: COLORS.bg },
  tabContent: { flex: 1 },
  tabPane: { flex: 1 },
  tabPaneHidden: { display: 'none' },
  tabBar: {
    flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLORS.coralBorder,
    backgroundColor: COLORS.card, paddingBottom: 22, paddingTop: 10,
  },
  tabBtn: { flex: 1, alignItems: 'center' },
  tabIcon: { fontSize: 20, opacity: 0.4 },
  tabIconActive: { opacity: 1 },
  tabLabel: { fontFamily: FONTS.medium, fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  tabLabelActive: { fontFamily: FONTS.bold, color: COLORS.coral },
});

export default ObserveRoot.wrap(App);
