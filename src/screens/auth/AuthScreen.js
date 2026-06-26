import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { AGE_ATTESTATION_TEXT } from '../../lib/legal';

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
        <Text style={styles.logo}>🌸 NearMatch</Text>
        <Text style={styles.title}>
          {mode === 'login' ? 'Welcome back 💛' : 'Join NearMatch 🌸'}
        </Text>
        <Text style={styles.subtitle}>
          {mode === 'login' ? 'Sign in to continue' : 'Create your account'}
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email Address"
          placeholderTextColor="#B87A68"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#B87A68"
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
            <ActivityIndicator color="#fff" />
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
  container: { flex: 1, backgroundColor: '#FFF5F0' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: { fontSize: 36, fontWeight: '800', color: '#E8603A', textAlign: 'center', marginBottom: 6 },
  title: { fontSize: 24, fontWeight: '700', color: '#3D1A0E', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#B87A68', textAlign: 'center', marginBottom: 32, fontStyle: 'italic' },
  input: {
    backgroundColor: '#FEF0EA', borderWidth: 1.5, borderColor: '#F5C4B0',
    borderRadius: 12, padding: 14, fontSize: 14, color: '#3D1A0E', marginBottom: 12,
  },
  attestRow: {
    flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, paddingRight: 8,
  },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: '#F5C4B0',
    backgroundColor: '#FEF0EA', alignItems: 'center', justifyContent: 'center',
    marginRight: 10, marginTop: 1,
  },
  checkboxChecked: { backgroundColor: '#E8603A', borderColor: '#E8603A' },
  checkboxMark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  attestText: { flex: 1, fontSize: 12, color: '#8C4A35', lineHeight: 17 },
  btn: {
    backgroundColor: '#E8603A', borderRadius: 12, padding: 15,
    alignItems: 'center', marginBottom: 16, marginTop: 4, minHeight: 50, justifyContent: 'center',
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  switchText: { fontSize: 13, color: '#B87A68' },
  switchLink: { fontSize: 13, color: '#E8603A', fontWeight: '700' },
  backBtn: { marginBottom: 20 },
  backText: { fontSize: 16, color: '#E8603A', fontWeight: '600' },
})
