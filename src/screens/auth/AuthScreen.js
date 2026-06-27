import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { AGE_ATTESTATION_TEXT } from '../../lib/legal';
import { COLORS, FONTS } from '../../theme/theme';

export default function AuthScreen({ initialMode = 'login', onBack, onSuccess }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [attested, setAttested] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    if (mode === 'signup' && !attested) {
      Alert.alert('Error', 'Please confirm you are 18 or older to continue');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
        });
        if (error) throw error;
        if (!data.session) {
          Alert.alert(
            'Check your email',
            'We sent you a confirmation link. Confirm your email, then sign in.'
          );
          setMode('login');
          return;
        }
        onSuccess('signup');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (error) throw error;
        onSuccess('login');
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.logo}>NearMatch</Text>
        <Text style={styles.title}>
          {mode === 'login' ? 'Welcome back 💛' : 'Join NearMatch 🌸'}
        </Text>
        <Text style={styles.subtitle}>
          {mode === 'login' ? 'Sign in to continue' : 'Create your account'}
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email Address"
          placeholderTextColor={COLORS.textSecondary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={COLORS.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {mode === 'signup' && (
          <TouchableOpacity
            style={styles.attestRow}
            onPress={() => setAttested((a) => !a)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, attested && styles.checkboxChecked]}>
              {attested && <Text style={styles.checkboxMark}>✓</Text>}
            </View>
            <Text style={styles.attestText}>{AGE_ATTESTATION_TEXT}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.btn} onPress={handleSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.btnText}>
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.switchRow}>
          <Text style={styles.switchText}>
            {mode === 'login' ? "Don't have an account? " : 'Already have one? '}
          </Text>
          <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}>
            <Text style={styles.switchLink}>
              {mode === 'login' ? 'Sign Up' : 'Sign In'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: { fontFamily: FONTS.logo, fontSize: 38, color: COLORS.coral, textAlign: 'center', marginBottom: 10 },
  title: { fontFamily: FONTS.bold, fontSize: 24, color: COLORS.textPrimary, textAlign: 'center', marginBottom: 4 },
  subtitle: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.teal, textAlign: 'center', marginBottom: 32 },
  input: {
    backgroundColor: COLORS.inputBg, borderWidth: 1.5, borderColor: COLORS.coralBorder,
    borderRadius: 14, padding: 14, fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textPrimary, marginBottom: 12,
  },
  attestRow: {
    flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, paddingRight: 8,
  },
  checkbox: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: COLORS.coralBorder,
    backgroundColor: COLORS.inputBg, alignItems: 'center', justifyContent: 'center',
    marginRight: 10, marginTop: 1,
  },
  checkboxChecked: { backgroundColor: COLORS.coral, borderColor: COLORS.coral },
  checkboxMark: { color: COLORS.white, fontSize: 13, fontFamily: FONTS.bold },
  attestText: { flex: 1, fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textSecondary, lineHeight: 17 },
  btn: {
    backgroundColor: COLORS.coral, borderRadius: 16, padding: 15,
    alignItems: 'center', marginBottom: 16, marginTop: 4, minHeight: 50, justifyContent: 'center',
  },
  btnText: { color: COLORS.white, fontSize: 16, fontFamily: FONTS.bold },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  switchText: { fontFamily: FONTS.regular, fontSize: 13, color: COLORS.textSecondary },
  switchLink: { fontFamily: FONTS.bold, fontSize: 13, color: COLORS.teal },
  backBtn: { marginBottom: 20 },
  backText: { fontFamily: FONTS.bold, fontSize: 16, color: COLORS.coral },
})
