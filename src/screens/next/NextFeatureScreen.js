import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../../theme/theme';

export default function NextFeatureScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Next Feature (Placeholder)</Text>
      <Text style={styles.description}>This is a scaffolded placeholder screen for the next feature.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: COLORS.bg },
  title: { fontFamily: FONTS.bold, fontSize: 20, color: COLORS.coral, marginBottom: 8 },
  description: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
});
