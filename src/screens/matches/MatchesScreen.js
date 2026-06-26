import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function MatchesScreen({ userId, active, onOpenChat }) {
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

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', otherUserIds);

    if (profilesError) {
      console.error('Failed to load match profiles', profilesError);
      setMatches([]);
      return;
    }

    const profileById = new Map((profiles || []).map((p) => [p.id, p]));
    const merged = matchRows
      .map((m) => {
        const otherId = m.user_a === userId ? m.user_b : m.user_a;
        const profile = profileById.get(otherId);
        return profile ? { matchId: m.id, ...profile } : null;
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

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Your Matches 💛</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#E8603A" style={{ marginTop: 40 }} />
      ) : matches.length === 0 ? (
        <TouchableOpacity style={styles.emptyState} onPress={handleRefresh} disabled={refreshing}>
          <Text style={styles.emptyEmoji}>💌</Text>
          <Text style={styles.emptyText}>No matches yet</Text>
          <Text style={styles.emptySubtext}>Keep swiping to find your match!</Text>
          <Text style={styles.refreshHint}>{refreshing ? 'Refreshing…' : 'Tap to refresh'}</Text>
        </TouchableOpacity>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => String(item.matchId)}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => onOpenChat(item.matchId)}>
              <View style={styles.avatarCircle}>
                {item.photo_url ? (
                  <Image source={{ uri: item.photo_url }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarEmoji}>{item.avatar_emoji || '🙂'}</Text>
                )}
              </View>
              <Text style={styles.name}>{item.name}, {item.age}</Text>
              <Text style={styles.subtext}>It's a match!</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F0', paddingTop: 60 },
  header: { fontSize: 22, fontWeight: '700', color: '#E8603A', textAlign: 'center', marginBottom: 16 },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  row: { gap: 12, marginBottom: 12 },
  card: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16,
    alignItems: 'center', borderWidth: 1.5, borderColor: '#F5C4B0',
  },
  avatarCircle: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#FDDDD4',
    alignItems: 'center', justifyContent: 'center', marginBottom: 10, overflow: 'hidden',
  },
  avatarImage: { width: 72, height: 72 },
  avatarEmoji: { fontSize: 36 },
  name: { fontSize: 15, fontWeight: '700', color: '#3D1A0E' },
  subtext: { fontSize: 12, color: '#E8603A', marginTop: 2 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#3D1A0E', marginBottom: 6 },
  emptySubtext: { fontSize: 14, color: '#B87A68', textAlign: 'center' },
  refreshHint: { fontSize: 12, color: '#E8603A', fontWeight: '600', marginTop: 16 },
});
