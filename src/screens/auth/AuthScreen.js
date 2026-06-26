import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform
} from 'react-native';

export default function AuthScreen({ initialMode = 'login', onBack, onSuccess }) {
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ name: '', email: '', password: '', gender: '' });

  const handleSubmit = () => {
    if (mode === 'signup') {
      if (!form.name || !form.email || !form.password || !form.gender) {
        Alert.alert('Error', 'Please fill all fields');
        return;
      }
      onSuccess('signup');
    } else {
      if (!form.email || !form.password) {
        Alert.alert('Error', 'Please fill all fields');
        return;
      }
      onSuccess('login');
    }
  };

  const update = (key, val) => setForm(f => ({ ...f, [key]: val }));

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

        {mode === 'signup' && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor="#B87A68"
              value={form.name}
              onChangeText={v => update('name', v)}
            />
            <View style={styles.genderRow}>
              {['Man', 'Woman', 'Non-binary'].map(g => (
                <TouchableOpacity
                  key={g}
                  style={[styles.genderBtn, form.gender === g && styles.genderBtnActive]}
                  onPress={() => update('gender', g)}
                >
                  <Text style={[styles.genderText, form.gender === g && styles.genderTextActive]}>
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <TextInput
          style={styles.input}
          placeholder="Email Address"
          placeholderTextColor="#B87A68"
          value={form.email}
          onChangeText={v => update('email', v)}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#B87A68"
          value={form.password}
          onChangeText={v => update('password', v)}
          secureTextEntry
        />

        <TouchableOpacity style={styles.btn} onPress={handleSubmit}>
          <Text style={styles.btnText}>
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </Text>
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
  genderRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  genderBtn: {
    flex: 1, borderWidth: 1.5, borderColor: '#F5C4B0',
    borderRadius: 12, padding: 10, alignItems: 'center', backgroundColor: '#FFFFFF',
  },
  genderBtnActive: { backgroundColor: '#FDDDD4', borderColor: '#E8603A' },
  genderText: { fontSize: 13, color: '#8C4A35' },
  genderTextActive: { color: '#E8603A', fontWeight: '600' },
  btn: {
    backgroundColor: '#E8603A', borderRadius: 12, padding: 15,
    alignItems: 'center', marginBottom: 16, marginTop: 4,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  switchText: { fontSize: 13, color: '#B87A68' },
  switchLink: { fontSize: 13, color: '#E8603A', fontWeight: '700' },
  backBtn: { marginBottom: 20 },
  backText: { fontSize: 16, color: '#E8603A', fontWeight: '600' },
})
