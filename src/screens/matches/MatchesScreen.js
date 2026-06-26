import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';

export default function MatchesScreen({ matches, onOpenChat }) {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Your Matches 💛</Text>

      {matches.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>💌</Text>
          <Text style={styles.emptyText}>No matches yet</Text>
          <Text style={styles.emptySubtext}>Keep swiping to find your match!</Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => onOpenChat(item)}>
              <View style={styles.avatarCircle}>
                {item.photo ? (
                  <Image source={{ uri: item.photo }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarEmoji}>{item.avatar}</Text>
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
});
