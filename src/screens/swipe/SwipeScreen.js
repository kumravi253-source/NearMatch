import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, PanResponder, AccessibilityInfo,
  Dimensions, TouchableOpacity, Image, ActivityIndicator, Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../../lib/supabase';
import { withSignedPhotoUrls } from '../../lib/avatars';
import { getPremiumStatus, getWalletBalancePaise, formatPaiseAsRupees } from '../../lib/premium';
import { COLORS, FONTS } from '../../theme/theme';
import { useScreenTopPadding } from '../../theme/layout';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.28;

export default function SwipeScreen({ userId, onSignOut, isAgeVerified, onVerifyAge, onEditProfile, referralCode }) {
  const screenTopPadding = useScreenTopPadding();
  const [profiles, setProfiles] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const position = useRef(new Animated.ValueXY()).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotionEnabled);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotionEnabled);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadCandidates = async () => {
      setLoading(true);

      const { data: candidates, error: candidatesError } = await supabase.rpc('get_candidate_profiles', {
        p_limit: 30,
      });

      if (cancelled) return;

      if (candidatesError) {
        console.error('Failed to load candidates', candidatesError);
        setProfiles([]);
      } else {
        const signed = await withSignedPhotoUrls(candidates || []);
        if (cancelled) return;
        setProfiles(signed);
      }
      setIndex(0);
      setLoading(false);
    };

    loadCandidates();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const resetPosition = () => {
    if (reduceMotionEnabled) {
      position.setValue({ x: 0, y: 0 });
      return;
    }
    Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
  };

  const swipeOff = (direction) => {
    const profile = profiles[index];
    if (!profile) return;

    const afterSwipe = async () => {
      position.setValue({ x: 0, y: 0 });
      setIndex((i) => i + 1);

      const { data, error } = await supabase
        .rpc('record_swipe', {
          p_swiped_id: profile.id,
          p_direction: direction > 0 ? 'like' : 'pass',
        })
        .single();

      if (error) {
        console.error('Failed to record swipe', error);
        if (error.message?.includes('rate_limit_exceeded')) {
          Alert.alert("You're swiping fast!", 'Take a short break and try again in a minute.');
        } else if (error.message?.includes('daily_like_limit_reached')) {
          // No purchase link on either platform. Apple's guidelines
          // don't allow linking out to external payment for unlocking
          // in-app features, and Google's Payments policy says the same
          // for India — its external payment links program covers Japan
          // only. Premium is sold on the website, but the app must not
          // route users there. Restore an in-app path once Google Play
          // Billing is integrated.
          Alert.alert(
            "You've used today's 10 free likes",
            'Free plan allows 10 likes per day. Come back tomorrow for more.',
            [{ text: 'OK' }]
          );
        }
        return;
      }
      if (data?.matched) {
        Alert.alert("It's a match! 🎉", `You and ${profile.name} liked each other.`);
      }
    };

    if (reduceMotionEnabled) {
      afterSwipe();
      return;
    }

    Animated.timing(position, {
      toValue: { x: direction * SCREEN_WIDTH * 1.5, y: 0 },
      duration: 250,
      useNativeDriver: false,
    }).start(afterSwipe);
  };

  const handleAccountMenu = () => {
    Alert.alert(
      'Account',
      'What would you like to do?',
      [
        { text: 'Edit Profile', onPress: onEditProfile },
        { text: 'Premium & Wallet', onPress: handlePremiumMenu },
        { text: 'Sign Out', onPress: onSignOut },
        { text: 'Delete Account', style: 'destructive', onPress: handleDeleteAccount },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handlePremiumMenu = async () => {
    const [isPremium, walletPaise] = await Promise.all([getPremiumStatus(), getWalletBalancePaise()]);
    const walletLine = walletPaise > 0
      ? `Wallet balance: ${formatPaiseAsRupees(walletPaise)} (applied automatically toward your next Premium purchase)`
      : 'Wallet balance: ₹0';

    Alert.alert(
      isPremium ? 'You are Premium 👑' : 'Free plan',
      `${isPremium ? "Unlimited likes, priority discovery, and you're visible in Who Liked You." : '10 likes/day. Upgrade for unlimited likes and to see who liked you.'}\n\n${walletLine}\n\nYour referral code: ${referralCode || '—'}\nShare it — friends who sign up with it earn you ₹100 each, with no limit.`,
      [
        { text: 'Copy referral code', onPress: () => referralCode && Clipboard.setStringAsync(referralCode) },
        { text: 'Close', style: 'cancel' },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your profile, matches, and messages. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: confirmDeleteAccount },
      ]
    );
  };

  const confirmDeleteAccount = async () => {
    const { error } = await supabase.functions.invoke('delete-account');
    if (error) {
      console.error('Failed to delete account', error);
      Alert.alert('Error', 'Could not delete your account. Please try again.');
      return;
    }
    onSignOut();
  };

  const handleSafetyMenu = (targetProfile) => {
    Alert.alert(
      targetProfile.name,
      'What would you like to do?',
      [
        { text: 'Report', onPress: () => handleReport(targetProfile), style: 'destructive' },
        { text: 'Block', onPress: () => handleBlock(targetProfile), style: 'destructive' },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleBlock = async (targetProfile) => {
    const { error } = await supabase
      .from('blocks')
      .insert({ blocker_id: userId, blocked_id: targetProfile.id });
    if (error && error.code !== '23505') {
      console.error('Failed to block user', error);
      Alert.alert('Error', 'Could not block this user. Please try again.');
      return;
    }
    setProfiles((prev) => prev.filter((p) => p.id !== targetProfile.id));
    Alert.alert('Blocked', `You won't see ${targetProfile.name} again.`);
  };

  const REPORT_REASONS = [
    { label: 'Inappropriate photos', value: 'inappropriate_photos' },
    { label: 'Harassment', value: 'harassment' },
    { label: 'Fake profile', value: 'fake_profile' },
    { label: 'Spam', value: 'spam' },
    { label: 'Other', value: 'other' },
  ];

  const handleReport = (targetProfile) => {
    Alert.alert(
      `Report ${targetProfile.name}`,
      'Why are you reporting this profile?',
      [
        ...REPORT_REASONS.map((r) => ({
          text: r.label,
          onPress: () => submitReport(targetProfile, r.value),
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const submitReport = async (targetProfile, reason) => {
    const { error } = await supabase
      .from('reports')
      .insert({ reporter_id: userId, reported_id: targetProfile.id, reason });
    if (error) {
      console.error('Failed to submit report', error);
      Alert.alert('Error', 'Could not submit your report. Please try again.');
      return;
    }
    Alert.alert('Report submitted', "Thanks for letting us know — we'll review this profile.");
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          swipeOff(1);
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          swipeOff(-1);
        } else {
          resetPosition();
        }
      },
    })
  ).current;

  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
    outputRange: ['-12deg', '0deg', '12deg'],
  });

  const likeOpacity = position.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const nopeOpacity = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const profile = profiles[index];
  const nextProfile = profiles[index + 1];

  return (
    <View style={[styles.container, screenTopPadding]}>
      <View style={styles.headerRow}>
        <View style={styles.headerSpacer} />
        <Text style={styles.header}>Discover 🌸</Text>
        <View style={styles.headerSpacer}>
          <TouchableOpacity onPress={handleAccountMenu}>
            <Text style={styles.accountMenuText}>Account ⋯</Text>
          </TouchableOpacity>
          {isAgeVerified ? (
            <Text style={styles.verifiedText}>✓ Verified</Text>
          ) : (
            <TouchableOpacity onPress={onVerifyAge}>
              <Text style={styles.verifyLinkText}>Get Verified</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.cardArea}>
        {loading && <ActivityIndicator size="large" color={COLORS.coral} />}

        {!loading && !profile && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🌅</Text>
            <Text style={styles.emptyText}>You've seen everyone nearby!</Text>
            <Text style={styles.emptySubtext}>Check back later for new profiles.</Text>
          </View>
        )}

        {!loading && nextProfile && (
          <View style={[styles.card, styles.cardBehind]}>
            <ProfileCard profile={nextProfile} />
          </View>
        )}

        {!loading && profile && (
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.card,
              {
                transform: [
                  { translateX: position.x },
                  { translateY: position.y },
                  { rotate },
                ],
              },
            ]}
          >
            <Animated.View style={[styles.badge, styles.likeBadge, { opacity: likeOpacity }]}>
              <Text style={styles.badgeText}>LIKE</Text>
            </Animated.View>
            <Animated.View style={[styles.badge, styles.nopeBadge, { opacity: nopeOpacity }]}>
              <Text style={styles.badgeText}>NOPE</Text>
            </Animated.View>
            <TouchableOpacity style={styles.safetyBtn} onPress={() => handleSafetyMenu(profile)}>
              <Text style={styles.safetyBtnText}>⋯</Text>
            </TouchableOpacity>
            <ProfileCard profile={profile} />
          </Animated.View>
        )}
      </View>

      {!loading && profile && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtnNope} onPress={() => swipeOff(-1)}>
            <Text style={styles.actionIconNope}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtnLike} onPress={() => swipeOff(1)}>
            <Text style={styles.actionIconLike}>♥</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function ProfileCard({ profile }) {
  return (
    <>
      <View style={styles.photoPlaceholder}>
        {profile.photo_url ? (
          <Image source={{ uri: profile.photo_url }} style={styles.photoImage} />
        ) : (
          <Text style={styles.photoEmoji}>{profile.avatar_emoji || '🙂'}</Text>
        )}
      </View>
      <View style={styles.cardInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{profile.name}, {profile.age}</Text>
          {profile.age_verified && <Text style={styles.verifiedBadge}>✓ Verified</Text>}
        </View>
        {profile.distance_label && <Text style={styles.distance}>📍 {profile.distance_label}</Text>}
        <Text style={styles.bio}>{profile.bio}</Text>
        <View style={styles.interestsWrap}>
          {(profile.interests || []).map((i) => (
            <View key={i} style={styles.chip}>
              <Text style={styles.chipText}>{i}</Text>
            </View>
          ))}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 16 },
  header: { fontFamily: FONTS.logo, fontSize: 26, color: COLORS.coral, textAlign: 'center' },
  headerSpacer: { width: 80, alignItems: 'flex-end' },
  accountMenuText: { fontFamily: FONTS.medium, fontSize: 12, color: COLORS.textSecondary, textAlign: 'right' },
  verifiedText: { fontFamily: FONTS.bold, fontSize: 11, color: COLORS.success, marginTop: 4 },
  verifyLinkText: { fontFamily: FONTS.bold, fontSize: 11, color: COLORS.coral, marginTop: 4 },
  cardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  card: {
    position: 'absolute', width: SCREEN_WIDTH - 40, height: '90%',
    backgroundColor: COLORS.card, borderRadius: 24, overflow: 'hidden',
    shadowColor: COLORS.textPrimary, shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  cardBehind: { transform: [{ scale: 0.96 }], top: 8 },
  photoPlaceholder: { flex: 1.2, backgroundColor: COLORS.coralLight, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoEmoji: { fontSize: 96 },
  photoImage: { width: '100%', height: '100%' },
  cardInfo: { padding: 18 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontFamily: FONTS.bold, fontSize: 22, color: COLORS.textPrimary },
  verifiedBadge: {
    fontFamily: FONTS.bold, fontSize: 11, color: COLORS.success, backgroundColor: COLORS.successLight,
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
  },
  distance: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.teal, marginTop: 4 },
  bio: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textSecondary, marginTop: 6, marginBottom: 10 },
  interestsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: COLORS.tealLight, borderRadius: 16, paddingVertical: 5, paddingHorizontal: 10, borderWidth: 1, borderColor: COLORS.tealBorder },
  chipText: { fontFamily: FONTS.medium, fontSize: 12, color: COLORS.teal },
  badge: {
    position: 'absolute', top: 30, zIndex: 10, borderWidth: 4, borderRadius: 8,
    paddingVertical: 4, paddingHorizontal: 12,
  },
  likeBadge: { left: 20, borderColor: COLORS.success, transform: [{ rotate: '-20deg' }] },
  nopeBadge: { right: 20, borderColor: COLORS.coral, transform: [{ rotate: '20deg' }] },
  safetyBtn: {
    position: 'absolute', top: 16, right: 16, zIndex: 20,
    width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  safetyBtnText: { color: COLORS.white, fontSize: 18, fontFamily: FONTS.bold, marginTop: -8 },
  badgeText: { fontFamily: FONTS.bold, fontSize: 26, color: COLORS.textPrimary },
  emptyState: { alignItems: 'center', padding: 32 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyText: { fontFamily: FONTS.bold, fontSize: 18, color: COLORS.textPrimary, marginBottom: 6 },
  emptySubtext: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textSecondary },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: 28, paddingVertical: 24 },
  actionBtnNope: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.coralBorder,
    shadowColor: COLORS.textPrimary, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
  },
  actionBtnLike: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.coral,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.coral, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3,
  },
  actionIconNope: { fontSize: 26, color: COLORS.coral, fontFamily: FONTS.bold },
  actionIconLike: { fontSize: 26, color: COLORS.white },
});
