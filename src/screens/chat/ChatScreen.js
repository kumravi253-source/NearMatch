import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Image, ActivityIndicator,
} from 'react-native';
import { supabase } from '../../lib/supabase';

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
    const [{ data: profiles, error: profilesError }, { data: lastMessages, error: messagesError }] =
      await Promise.all([
        supabase.from('profiles').select('*').in('id', otherUserIds),
        supabase
          .from('messages')
          .select('match_id, body, created_at')
          .in('match_id', matchIds)
          .order('created_at', { ascending: false }),
      ]);

    if (profilesError) console.error('Failed to load match profiles', profilesError);
    if (messagesError) console.error('Failed to load last messages', messagesError);

    const profileById = new Map((profiles || []).map((p) => [p.id, p]));
    const lastMessageByMatch = new Map();
    (lastMessages || []).forEach((m) => {
      if (!lastMessageByMatch.has(m.match_id)) lastMessageByMatch.set(m.match_id, m.body);
    });

    const merged = matchRows
      .map((m) => {
        const otherId = m.user_a === userId ? m.user_b : m.user_a;
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
      />
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Messages 💬</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#E8603A" style={{ marginTop: 40 }} />
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
                <Text style={styles.name}>{item.name}</Text>
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

function ConversationView({ userId, match, onBack }) {
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
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.convoHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.convoName}>{match.name}</Text>
        <View style={{ width: 50 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#E8603A" style={{ marginTop: 40 }} />
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
          placeholderTextColor="#B87A68" value={text} onChangeText={setText}
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
  container: { flex: 1, backgroundColor: '#FFF5F0', paddingTop: 60 },
  header: { fontSize: 22, fontWeight: '700', color: '#E8603A', textAlign: 'center', marginBottom: 16 },
  list: { paddingHorizontal: 16 },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 16, padding: 12, marginBottom: 10, borderWidth: 1.5, borderColor: '#F5C4B0',
  },
  avatarCircle: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#FDDDD4',
    alignItems: 'center', justifyContent: 'center', marginRight: 12, overflow: 'hidden',
  },
  avatarImage: { width: 52, height: 52 },
  avatarEmoji: { fontSize: 26 },
  rowText: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: '#3D1A0E' },
  preview: { fontSize: 13, color: '#B87A68', marginTop: 2 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#3D1A0E', marginBottom: 6 },
  emptySubtext: { fontSize: 14, color: '#B87A68', textAlign: 'center' },
  refreshHint: { fontSize: 12, color: '#E8603A', fontWeight: '600', marginTop: 16 },
  convoHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F5C4B0',
  },
  backBtn: { width: 50 },
  backText: { fontSize: 15, color: '#E8603A', fontWeight: '600' },
  convoName: { fontSize: 17, fontWeight: '700', color: '#3D1A0E' },
  messageList: { padding: 16, flexGrow: 1, justifyContent: 'flex-end' },
  convoEmpty: { textAlign: 'center', color: '#B87A68', marginTop: 40, fontStyle: 'italic' },
  bubble: { maxWidth: '75%', borderRadius: 16, padding: 12, marginBottom: 8 },
  bubbleThem: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#F5C4B0', alignSelf: 'flex-start' },
  bubbleMe: { backgroundColor: '#E8603A', alignSelf: 'flex-end' },
  bubbleText: { fontSize: 14, color: '#3D1A0E' },
  bubbleTextMe: { color: '#fff' },
  inputRow: { flexDirection: 'row', padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: '#F5C4B0' },
  input: {
    flex: 1, backgroundColor: '#FEF0EA', borderWidth: 1.5, borderColor: '#F5C4B0',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: '#3D1A0E',
  },
  sendBtn: { backgroundColor: '#E8603A', borderRadius: 20, paddingHorizontal: 18, justifyContent: 'center' },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
