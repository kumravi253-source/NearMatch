import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from './src/lib/supabase';
import { AGE_ATTESTATION_TEXT } from './src/lib/legal';
import AuthScreen from './src/screens/auth/AuthScreen';
import ProfileSetupScreen from './src/screens/profile/ProfileSetupScreen';
import SwipeScreen from './src/screens/swipe/SwipeScreen';
import MatchesScreen from './src/screens/matches/MatchesScreen';
import ChatScreen from './src/screens/chat/ChatScreen';
import VerifyAgeScreen from './src/screens/verify/VerifyAgeScreen';

const TABS = [
  { key: 'swipe', label: 'Discover', icon: '🔥' },
  { key: 'matches', label: 'Matches', icon: '💛' },
  { key: 'chat', label: 'Chat', icon: '💬' },
];

export default function App() {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(undefined);
  const [splashScreen, setSplashScreen] = useState('splash');
  const [authMode, setAuthMode] = useState('login');
  const [tab, setTab] = useState('swipe');
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [showVerifyAge, setShowVerifyAge] = useState(false);

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
  }, [session]);

  const handleProfileComplete = (savedProfile) => {
    setProfile(savedProfile);
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

  if (session === undefined || (session && profile === undefined)) {
    return (
      <View style={styles.splash}>
        <StatusBar style="auto" />
        <ActivityIndicator size="large" color="#E8603A" />
      </View>
    );
  }

  if (session === null) {
    if (splashScreen === 'auth') {
      return <AuthScreen initialMode={authMode} onBack={() => setSplashScreen('splash')} onSuccess={() => {}} />;
    }
    return (
      <View style={styles.splash}>
        <StatusBar style="auto" />
        <Text style={styles.logo}>🌸 NearMatch</Text>
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
          />
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
  splash: { flex: 1, backgroundColor: '#FFF5F0', alignItems: 'center', justifyContent: 'center', padding: 32 },
  logo: { fontSize: 36, fontWeight: '800', color: '#E8603A', textAlign: 'center', marginBottom: 6 },
  tagline: { fontSize: 16, color: '#8C4A35', textAlign: 'center', marginBottom: 60, fontStyle: 'italic', lineHeight: 24 },
  btnPrimary: { width: '100%', backgroundColor: '#E8603A', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 12 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnSecondary: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1.5, borderColor: '#F5C4B0', marginBottom: 32 },
  btnSecondaryText: { color: '#8C4A35', fontSize: 16, fontWeight: '600' },
  terms: { fontSize: 12, color: '#D4A898', textAlign: 'center' },
  mainContainer: { flex: 1, backgroundColor: '#FFF5F0' },
  tabContent: { flex: 1 },
  tabPane: { flex: 1 },
  tabPaneHidden: { display: 'none' },
  tabBar: {
    flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F5C4B0',
    backgroundColor: '#FFFFFF', paddingBottom: 22, paddingTop: 10,
  },
  tabBtn: { flex: 1, alignItems: 'center' },
  tabIcon: { fontSize: 20, opacity: 0.4 },
  tabIconActive: { opacity: 1 },
  tabLabel: { fontSize: 11, color: '#B87A68', marginTop: 2 },
  tabLabelActive: { color: '#E8603A', fontWeight: '700' },
});
