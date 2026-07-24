import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, Alert, Linking } from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, FONTS } from '../../theme/theme';

const PRICING_URL = 'https://nearmatch.in/pricing.html';

export default function LikesScreen({ active }) {
  const [likes, setLikes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [premiumRequired, setPremiumRequired] = useState(false);

  const loadLikes = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_pending_likes', { p_limit: 30 });
    if (error) {
      if (error.message?.includes('premium_required')) {
        setPremiumRequired(true);
      } else {
        console.error('Failed to load likes', error);
      }
      setLikes([]);
      return;
    }
    setPremiumRequired(false);
    setLikes(data || []);
  }, []);

  useEffect(() => {
    if (!active) return;
    setLoading(true);
    loadLikes().finally(() => setLoading(false));
  }, [active, loadLikes]);

  const handleLikeBack = async (profile) => {
    const { data, error } = await supabase
      .rpc('record_swipe', { p_swiped_id: profile.id, p_direction: 'like' })
      .single();
    if (error) {
      console.error('Failed to like back', error);
      Alert.alert('Error', 'Could not record your like. Please try again.');
      return;
    }
    setLikes((prev) => prev.filter((p) => p.id !== profile.id));
    if (data?.matched) {
      Alert.alert("It's a match! 🎉", `You and ${profile.name} liked each other.`);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Who Liked You 💫</Text>
        <ActivityIndicator size="large" color={COLORS.coral} style={{ marginTop: 40 }} />
      </View>
    );
  }

  if (premiumRequired) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Who Liked You 💫</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>👑</Text>
          <Text style={styles.emptyText}>See who already likes you</Text>
          <Text style={styles.emptySubtext}>
            This is a Premium feature — upgrade to instantly see everyone who's already liked your profile, no more guessing.
          </Text>
          <TouchableOpacity style={styles.upgradeBtn} onPress={() => Linking.openURL(PRICING_URL)}>
            <Text style={styles.upgradeBtnText}>Upgrade to Premium</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Who Liked You 💫</Text>

      {likes.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>💛</Text>
          <Text style={styles.emptyText}>No likes yet</Text>
          <Text style={styles.emptySubtext}>When someone likes your profile, they'll show up here.</Text>
        </View>
      ) : (
        <FlatList
          data={likes}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.avatarCircle}>
                {item.photo_url ? (
                  <Image source={{ uri: item.photo_url }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarEmoji}>{item.avatar_emoji || '🙂'}</Text>
                )}
              </View>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{item.name}, {item.age}</Text>
                {item.age_verified && <Text style={styles.badge}>✓</Text>}
              </View>
              {item.distance_label && <Text style={styles.distance}>📍 {item.distance_label}</Text>}
              <TouchableOpacity style={styles.likeBackBtn} onPress={() => handleLikeBack(item)}>
                <Text style={styles.likeBackBtnText}>♥ Like Back</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingTop: 60 },
  header: { fontFamily: FONTS.logo, fontSize: 26, color: COLORS.coral, textAlign: 'center', marginBottom: 16 },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  row: { gap: 12, marginBottom: 12 },
  card: {
    flex: 1, backgroundColor: COLORS.card, borderRadius: 18, padding: 16,
    alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.coralBorder,
  },
  avatarCircle: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.coralLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10, overflow: 'hidden',
  },
  avatarImage: { width: 72, height: 72 },
  avatarEmoji: { fontSize: 36 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.textPrimary },
  badge: {
    fontFamily: FONTS.bold, fontSize: 10, color: COLORS.success, backgroundColor: COLORS.successLight,
    borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2,
  },
  distance: { fontFamily: FONTS.medium, fontSize: 11, color: COLORS.teal, marginTop: 2 },
  likeBackBtn: {
    marginTop: 10, backgroundColor: COLORS.coral, borderRadius: 12,
    paddingVertical: 6, paddingHorizontal: 14,
  },
  likeBackBtnText: { fontFamily: FONTS.bold, fontSize: 12, color: COLORS.white },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyText: { fontFamily: FONTS.bold, fontSize: 18, color: COLORS.textPrimary, marginBottom: 6, textAlign: 'center' },
  emptySubtext: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  upgradeBtn: { marginTop: 20, backgroundColor: COLORS.coral, borderRadius: 16, paddingVertical: 13, paddingHorizontal: 28 },
  upgradeBtnText: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.white },
});
