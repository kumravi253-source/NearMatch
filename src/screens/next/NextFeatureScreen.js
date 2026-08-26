import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function NextFeatureScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Next Feature (WIP)</Text>
      <Text style={styles.desc}>This is a scaffolded placeholder screen for the forthcoming feature.</Text>
      <TouchableOpacity style={styles.btn} onPress={() => navigation?.goBack?.()}>
        <Text style={styles.btnText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  desc: { fontSize: 14, color: '#444', textAlign: 'center', marginBottom: 16 },
  btn: { backgroundColor: '#ff6b6b', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  btnText: { color: '#fff', fontWeight: '700' },
});
