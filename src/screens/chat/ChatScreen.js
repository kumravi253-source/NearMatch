import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Alert,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { withSignedPhotoUrls } from '../../lib/avatars';
import { COLORS, FONTS } from '../../theme/theme';

const REPORT_REASONS = [
  { label: 'Inappropriate photos', value: 'inappropriate_photos' },
  { label: 'Harassment', value: 'harassment' },
  { label: 'Fake profile', value: 'fake_profile' },
  { label: 'Spam', value: 'spam' },
  { label: 'Other', value: 'other' },
];

export default function ChatScreen({ userId, active, selectedChatId, onSelectChat }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMatches = useCallback(async () => {
    const { data: matchRows, error: matchError } = await supabase
      .from('matches')
      .select('id, user_a, user_b, created_at')
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (matchError) {
      console.error('Failed to load matches', matchError);
      setMatches([]);
      return;
    }

    const otherUserIds = (matchRows || []).map((m) => (m.user_a === userId ? m.user_b : m.user_a));
    if (otherUserIds.length === 0) {
      setMatches([]);
      return;
    }

    const matchIds = matchRows.map((m) => m.id);
    const [
      { data: profiles, error: profilesError },
      { data: lastMessages, error: messagesError },
      { data: blocks, error: blocksError },
    ] = await Promise.all([
      supabase.from('profiles').select('*').in('id', otherUserIds),
      supabase
        .from('messages')
        .select('match_id, body, created_at')
        .in('match_id', matchIds)
        .order('created_at', { ascending: false }),
      supabase.from('blocks').select('blocker_id, blocked_id').or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`),
    ]);

    if (profilesError) console.error('Failed to load match profiles', profilesError);
    if (messagesError) console.error('Failed to load last messages', messagesError);
    if (blocksError) console.error('Failed to load blocks', blocksError);

    const blockedWith = new Set();
    (blocks || []).forEach((b) => {
      blockedWith.add(b.blocker_id === userId ? b.blocked_id : b.blocker_id);
    });

    const signedProfiles = await withSignedPhotoUrls(profiles || []);
    const profileById = new Map(signedProfiles.map((p) => [p.id, p]));
    const lastMessageByMatch = new Map();
    (lastMessages || []).forEach((m) => {
      if (!lastMessageByMatch.has(m.match_id)) lastMessageByMatch.set(m.match_id, m.body);
    });

    const merged = matchRows
      .map((m) => {
        const otherId = m.user_a === userId ? m.user_b : m.user_a;
        if (blockedWith.has(otherId)) return null;
        const profile = profileById.get(otherId);
        if (!profile) return null;
        return { matchId: m.id, lastMessage: lastMessageByMatch.get(m.id) || null, ...profile };
      })
      .filter(Boolean);

    setMatches(merged);
  }, [userId]);

  useEffect(() => {
    if (!active) return;
    setLoading(true);
    loadMatches().finally(() => setLoading(false));
  }, [active, loadMatches]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMatches();
    setRefreshing(false);
  };

  const selectedMatch = matches.find((m) => m.matchId === selectedChatId);

  if (selectedChatId && selectedMatch) {
    return (
      <ConversationView
        userId={userId}
        match={selectedMatch}
        onBack={() => {
          onSelectChat(null);
          loadMatches();
        }}
        onBlocked={() => {
          onSelectChat(null);
          loadMatches();
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Messages 💬</Text>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.coral} style={{ marginTop: 40 }} />
      ) : matches.length === 0 ? (
        <TouchableOpacity style={styles.emptyState} onPress={handleRefresh} disabled={refreshing}>
          <Text style={styles.emptyEmoji}>🌸</Text>
          <Text style={styles.emptyText}>No conversations yet</Text>
          <Text style={styles.emptySubtext}>Match with someone to start chatting!</Text>
          <Text style={styles.refreshHint}>{refreshing ? 'Refreshing…' : 'Tap to refresh'}</Text>
        </TouchableOpacity>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => String(item.matchId)}
          contentContainerStyle={styles.list}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => onSelectChat(item.matchId)}>
              <View style={styles.avatarCircle}>
                {item.photo_url ? (
                  <Image source={{ uri: item.photo_url }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarEmoji}>{item.avatar_emoji || '🙂'}</Text>
                )}
              </View>
              <View style={styles.rowText}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{item.name}</Text>
                  {item.age_verified && <Text style={styles.badge}>✓</Text>}
                </View>
                <Text style={styles.preview} numberOfLines={1}>
                  {item.lastMessage || 'Say hello! 👋'}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

function ConversationView({ userId, match, onBack, onBlocked }) {
  const [text, setText] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const listRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from('messages')
      .select('*')
      .eq('match_id', match.matchId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error('Failed to load messages', error);
        setMessages(data || []);
        setLoading(false);
      });

    const channel = supabase
      .channel(`messages:match:${match.matchId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${match.matchId}` },
        (payload) => {
          setMessages((prev) => (prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [match.matchId]);

  const handleSend = async () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    const { error } = await supabase
      .from('messages')
      .insert({ match_id: match.matchId, sender_id: userId, body });
    if (error) {
      console.error('Failed to send message', error);
      if (error.message?.includes('rate_limit_exceeded')) {
        Alert.alert("You're sending messages fast!", 'Take a short break and try again in a minute.');
      }
    }
  };

  const handleSafetyMenu = () => {
    Alert.alert(
      match.name,
      'What would you like to do?',
      [
        { text: 'Report', onPress: handleReport, style: 'destructive' },
        { text: 'Block', onPress: handleBlock, style: 'destructive' },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleBlock = async () => {
    const { error } = await supabase
      .from('blocks')
      .insert({ blocker_id: userId, blocked_id: match.id });
    if (error && error.code !== '23505') {
      console.error('Failed to block user', error);
      Alert.alert('Error', 'Could not block this user. Please try again.');
      return;
    }
    Alert.alert('Blocked', `You won't see ${match.name} again.`);
    onBlocked();
  };

  const handleReport = () => {
    Alert.alert(
      `Report ${match.name}`,
      'Why are you reporting this profile?',
      [
        ...REPORT_REASONS.map((r) => ({
          text: r.label,
          onPress: () => submitReport(r.value),
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const submitReport = async (reason) => {
    const { error } = await supabase
      .from('reports')
      .insert({ reporter_id: userId, reported_id: match.id, reason });
    if (error) {
      console.error('Failed to submit report', error);
      Alert.alert('Error', 'Could not submit your report. Please try again.');
      return;
    }
    Alert.alert('Report submitted', "Thanks for letting us know — we'll review this profile.");
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.convoHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.convoName}>{match.name}</Text>
        <TouchableOpacity onPress={handleSafetyMenu} style={styles.convoMenuBtn}>
          <Text style={styles.convoMenuText}>⋯</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.coral} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.sender_id === userId ? styles.bubbleMe : styles.bubbleThem]}>
              <Text style={[styles.bubbleText, item.sender_id === userId && styles.bubbleTextMe]}>
                {item.body}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.convoEmpty}>You matched with {match.name}! Say hi 🌸</Text>
          }
        />
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input} placeholder="Type a message..."
          placeholderTextColor={COLORS.textSecondary} value={text} onChangeText={setText}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
          <Text style={styles.sendBtnText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingTop: 60 },
  header: { fontFamily: FONTS.logo, fontSize: 26, color: COLORS.coral, textAlign: 'center', marginBottom: 16 },
  list: { paddingHorizontal: 16 },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card,
    borderRadius: 16, padding: 12, marginBottom: 10, borderWidth: 1.5, borderColor: COLORS.coralBorder,
  },
  avatarCircle: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.coralLight,
    alignItems: 'center', justifyContent: 'center', marginRight: 12, overflow: 'hidden',
  },
  avatarImage: { width: 52, height: 52 },
  avatarEmoji: { fontSize: 26 },
  rowText: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.textPrimary },
  badge: {
    fontFamily: FONTS.bold, fontSize: 10, color: COLORS.success, backgroundColor: COLORS.successLight,
    borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2,
  },
  preview: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyText: { fontFamily: FONTS.bold, fontSize: 18, color: COLORS.textPrimary, marginBottom: 6 },
  emptySubtext: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
  refreshHint: { fontFamily: FONTS.bold, fontSize: 12, color: COLORS.coral, marginTop: 16 },
  convoHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.coralBorder,
  },
  backBtn: { width: 50 },
  convoMenuBtn: { width: 50, alignItems: 'flex-end' },
  convoMenuText: { fontSize: 22, color: COLORS.textSecondary, fontFamily: FONTS.bold },
  backText: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.coral },
  convoName: { fontFamily: FONTS.bold, fontSize: 17, color: COLORS.textPrimary },
  messageList: { padding: 16, flexGrow: 1, justifyContent: 'flex-end' },
  convoEmpty: { fontFamily: FONTS.medium, textAlign: 'center', color: COLORS.teal, marginTop: 40 },
  bubble: { maxWidth: '75%', borderRadius: 18, padding: 12, marginBottom: 8 },
  bubbleThem: { backgroundColor: COLORS.card, borderWidth: 1.5, borderColor: COLORS.coralBorder, alignSelf: 'flex-start' },
  bubbleMe: { backgroundColor: COLORS.coral, alignSelf: 'flex-end' },
  bubbleText: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.textPrimary },
  bubbleTextMe: { color: COLORS.white },
  inputRow: { flexDirection: 'row', padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: COLORS.coralBorder },
  input: {
    flex: 1, backgroundColor: COLORS.inputBg, borderWidth: 1.5, borderColor: COLORS.coralBorder,
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textPrimary,
  },
  sendBtn: { backgroundColor: COLORS.teal, borderRadius: 20, paddingHorizontal: 18, justifyContent: 'center' },
  sendBtnText: { color: COLORS.white, fontFamily: FONTS.bold, fontSize: 14 },
});
