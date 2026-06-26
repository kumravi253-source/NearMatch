import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AuthScreen from './src/screens/auth/AuthScreen';
import ProfileSetupScreen from './src/screens/profile/ProfileSetupScreen';
import SwipeScreen from './src/screens/swipe/SwipeScreen';
import MatchesScreen from './src/screens/matches/MatchesScreen';
import ChatScreen from './src/screens/chat/ChatScreen';

const TABS = [
  { key: 'swipe', label: 'Discover', icon: '🔥' },
  { key: 'matches', label: 'Matches', icon: '💛' },
  { key: 'chat', label: 'Chat', icon: '💬' },
];

export default function App() {
  const [screen, setScreen] = useState('splash');
  const [authMode, setAuthMode] = useState('login');
  const [tab, setTab] = useState('swipe');
  const [matches, setMatches] = useState([]);
  const [conversations, setConversations] = useState({});
  const [selectedChatId, setSelectedChatId] = useState(null);

  const handleAuthSuccess = (mode) => {
    setScreen(mode === 'signup' ? 'profileSetup' : 'main');
  };

  const handleProfileComplete = () => {
    setScreen('main');
  };

  const handleMatch = (profile) => {
    setMatches((prev) => (prev.find((m) => m.id === profile.id) ? prev : [...prev, profile]));
  };

  const handleOpenChat = (match) => {
    setSelectedChatId(match.id);
    setTab('chat');
  };

  const handleSendMessage = (matchId, text) => {
    setConversations((prev) => ({
      ...prev,
      [matchId]: [...(prev[matchId] || []), { from: 'me', text }],
    }));
  };

  if (screen === 'splash') {
    return (
      <View style={styles.splash}>
        <StatusBar style="auto" />
        <Text style={styles.logo}>🌸 NearMatch</Text>
        <Text style={styles.tagline}>Warm connections, just around the corner</Text>
        <TouchableOpacity style={styles.btnPrimary} onPress={() => { setAuthMode('signup'); setScreen('auth'); }}>
          <Text style={styles.btnPrimaryText}>Create Account</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => { setAuthMode('login'); setScreen('auth'); }}>
          <Text style={styles.btnSecondaryText}>Sign In</Text>
        </TouchableOpacity>
        <Text style={styles.terms}>By continuing, you agree to our Terms & Privacy Policy</Text>
      </View>
    );
  }

  if (screen === 'auth') {
    return (
      <AuthScreen
        initialMode={authMode}
        onBack={() => setScreen('splash')}
        onSuccess={handleAuthSuccess}
      />
    );
  }

  if (screen === 'profileSetup') {
    return <ProfileSetupScreen onComplete={handleProfileComplete} />;
  }

  return (
    <View style={styles.mainContainer}>
      <StatusBar style="auto" />
      <View style={styles.tabContent}>
        <View style={tab === 'swipe' ? styles.tabPane : styles.tabPaneHidden}>
          <SwipeScreen onMatch={handleMatch} />
        </View>
        <View style={tab === 'matches' ? styles.tabPane : styles.tabPaneHidden}>
          <MatchesScreen matches={matches} onOpenChat={handleOpenChat} />
        </View>
        <View style={tab === 'chat' ? styles.tabPane : styles.tabPaneHidden}>
          <ChatScreen
            matches={matches}
            conversations={conversations}
            onSendMessage={handleSendMessage}
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
