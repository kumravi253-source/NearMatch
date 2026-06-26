import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, PanResponder,
  Dimensions, TouchableOpacity, Image,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.28;

const PROFILES = [
  { id: '1', photo: 'https://i.pravatar.cc/600?img=47', avatar: '🌻', name: 'Mia', age: 26, bio: 'Sunflower enthusiast & weekend hiker.', interests: ['Hiking', 'Coffee', 'Art'], distance: '2 miles away' },
  { id: '2', photo: 'https://i.pravatar.cc/600?img=12', avatar: '😎', name: 'Jordan', age: 29, bio: 'Foodie chasing the best tacos in town.', interests: ['Foodie', 'Travel'], distance: '5 miles away' },
  { id: '3', photo: 'https://i.pravatar.cc/600?img=44', avatar: '🦋', name: 'Ava', age: 24, bio: 'Bookworm with a soft spot for live music.', interests: ['Reading', 'Music'], distance: '1 mile away' },
  { id: '4', photo: 'https://i.pravatar.cc/600?img=14', avatar: '🥳', name: 'Leo', age: 31, bio: 'Gym in the morning, gaming at night.', interests: ['Fitness', 'Gaming'], distance: '8 miles away' },
  { id: '5', photo: 'https://i.pravatar.cc/600?img=45', avatar: '🌸', name: 'Sofia', age: 27, bio: 'Dog mom, dance lover, dessert addict.', interests: ['Pets', 'Dancing'], distance: '3 miles away' },
];

export default function SwipeScreen({ onMatch }) {
  const [index, setIndex] = useState(0);
  const position = useRef(new Animated.ValueXY()).current;

  const resetPosition = () => {
    Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
  };

  const swipeOff = (direction) => {
    const profile = PROFILES[index];
    Animated.timing(position, {
      toValue: { x: direction * SCREEN_WIDTH * 1.5, y: 0 },
      duration: 250,
      useNativeDriver: false,
    }).start(() => {
      if (direction > 0 && profile) onMatch(profile);
      position.setValue({ x: 0, y: 0 });
      setIndex((i) => i + 1);
    });
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

  const profile = PROFILES[index];
  const nextProfile = PROFILES[index + 1];

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Discover 🌸</Text>

      <View style={styles.cardArea}>
        {!profile && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🌅</Text>
            <Text style={styles.emptyText}>You've seen everyone nearby!</Text>
            <Text style={styles.emptySubtext}>Check back later for new profiles.</Text>
          </View>
        )}

        {nextProfile && (
          <View style={[styles.card, styles.cardBehind]}>
            <ProfileCard profile={nextProfile} />
          </View>
        )}

        {profile && (
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
            <ProfileCard profile={profile} />
          </Animated.View>
        )}
      </View>

      {profile && (
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
        {profile.photo ? (
          <Image source={{ uri: profile.photo }} style={styles.photoImage} />
        ) : (
          <Text style={styles.photoEmoji}>{profile.avatar}</Text>
        )}
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.name}>{profile.name}, {profile.age}</Text>
        <Text style={styles.distance}>{profile.distance}</Text>
        <Text style={styles.bio}>{profile.bio}</Text>
        <View style={styles.interestsWrap}>
          {profile.interests.map((i) => (
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
  container: { flex: 1, backgroundColor: '#FFF5F0', paddingTop: 60 },
  header: { fontSize: 22, fontWeight: '700', color: '#E8603A', textAlign: 'center', marginBottom: 16 },
  cardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  card: {
    position: 'absolute', width: SCREEN_WIDTH - 40, height: '90%',
    backgroundColor: '#FFFFFF', borderRadius: 24, overflow: 'hidden',
    shadowColor: '#3D1A0E', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  cardBehind: { transform: [{ scale: 0.96 }], top: 8 },
  photoPlaceholder: { flex: 1.2, backgroundColor: '#FDDDD4', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoEmoji: { fontSize: 96 },
  photoImage: { width: '100%', height: '100%' },
  cardInfo: { padding: 18 },
  name: { fontSize: 22, fontWeight: '700', color: '#3D1A0E' },
  distance: { fontSize: 13, color: '#B87A68', marginBottom: 8 },
  bio: { fontSize: 14, color: '#8C4A35', marginBottom: 10 },
  interestsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: '#FEF0EA', borderRadius: 16, paddingVertical: 5, paddingHorizontal: 10, borderWidth: 1, borderColor: '#F5C4B0' },
  chipText: { fontSize: 12, color: '#8C4A35' },
  badge: {
    position: 'absolute', top: 30, zIndex: 10, borderWidth: 4, borderRadius: 8,
    paddingVertical: 4, paddingHorizontal: 12,
  },
  likeBadge: { left: 20, borderColor: '#3DBE6B', transform: [{ rotate: '-20deg' }] },
  nopeBadge: { right: 20, borderColor: '#E8603A', transform: [{ rotate: '20deg' }] },
  badgeText: { fontSize: 28, fontWeight: '800', color: '#3D1A0E' },
  emptyState: { alignItems: 'center', padding: 32 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#3D1A0E', marginBottom: 6 },
  emptySubtext: { fontSize: 14, color: '#B87A68' },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: 28, paddingVertical: 24 },
  actionBtnNope: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#F5C4B0',
    shadowColor: '#3D1A0E', shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
  },
  actionBtnLike: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: '#E8603A',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#E8603A', shadowOpacity: 0.3, shadowRadius: 6, elevation: 3,
  },
  actionIconNope: { fontSize: 26, color: '#E8603A', fontWeight: '700' },
  actionIconLike: { fontSize: 26, color: '#fff' },
});
