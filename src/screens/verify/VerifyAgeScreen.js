import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { BIOMETRIC_CONSENT_TEXT } from '../../lib/legal';
import { COLORS, FONTS } from '../../theme/theme';

export default function VerifyAgeScreen({ onDone }) {
  const [photo, setPhoto] = useState(null);
  const [consented, setConsented] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleTakeSelfie = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow camera access to verify your age.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      cameraType: ImagePicker.CameraType.front,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPhoto(result.assets[0]);
    }
  };

  const handleSubmit = async () => {
    // Consent gates the upload rather than the camera: taking the selfie is
    // local to the device, sending it is the act being consented to.
    if (!photo?.base64 || !consented) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-age', {
        body: { selfieImageBase64: photo.base64, consentText: BIOMETRIC_CONSENT_TEXT },
      });
      if (error) throw error;

      if (data?.passed) {
        Alert.alert('Verified! 🎉', "You're all set — a Verified badge now shows on your profile.");
        onDone();
      } else {
        const reasonText = {
          no_face_detected: "We couldn't find a face in that photo. Try again with better lighting.",
          multiple_faces_detected: 'Make sure only your face is in frame.',
          no_age_estimate: "We couldn't estimate an age from that photo. Try again.",
        }[data?.reason] || "We couldn't verify your age from that photo. Try again.";
        Alert.alert('Not verified', reasonText);
        setPhoto(null);
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Verification is unavailable right now. Please try again later.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    // Scrollable because the consent wording names the provider and the
    // transfer in full, which is several lines on a small screen — it must
    // not push the Verify button out of reach.
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={onDone} style={styles.backBtn}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Verify your age 🌸</Text>
      <Text style={styles.subtitle}>
        Take a quick selfie to get a Verified badge on your profile. This is optional, and the
        photo is never stored — it's only used for this one check.
      </Text>

      <View style={styles.photoArea}>
        {photo ? (
          <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoPlaceholderEmoji}>🤳</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.consentRow}
        onPress={() => setConsented((c) => !c)}
        activeOpacity={0.7}
        disabled={submitting}
      >
        <View style={[styles.checkbox, consented && styles.checkboxChecked]}>
          {consented && <Text style={styles.checkboxMark}>✓</Text>}
        </View>
        <Text style={styles.consentText}>{BIOMETRIC_CONSENT_TEXT}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryBtn} onPress={handleTakeSelfie} disabled={submitting}>
        <Text style={styles.secondaryBtnText}>{photo ? 'Retake Selfie' : 'Take Selfie'}</Text>
      </TouchableOpacity>

      {photo && (
        <TouchableOpacity
          style={[styles.primaryBtn, !consented && styles.primaryBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting || !consented}
        >
          {submitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryBtnText}>Verify</Text>}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 40 },
  backBtn: { marginBottom: 20 },
  backText: { fontFamily: FONTS.bold, fontSize: 16, color: COLORS.coral },
  title: { fontFamily: FONTS.bold, fontSize: 24, color: COLORS.textPrimary, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 32, lineHeight: 20 },
  photoArea: { alignItems: 'center', marginBottom: 24 },
  photoPreview: { width: 220, height: 220, borderRadius: 110, borderWidth: 3, borderColor: COLORS.coral },
  photoPlaceholder: {
    width: 220, height: 220, borderRadius: 110, backgroundColor: COLORS.inputBg,
    borderWidth: 2, borderColor: COLORS.coralBorder, alignItems: 'center', justifyContent: 'center',
  },
  photoPlaceholderEmoji: { fontSize: 72 },
  secondaryBtn: {
    borderWidth: 1.5, borderColor: COLORS.teal, borderRadius: 16, padding: 16,
    alignItems: 'center', marginBottom: 12,
  },
  secondaryBtnText: { fontFamily: FONTS.bold, color: COLORS.teal, fontSize: 16 },
  primaryBtn: {
    backgroundColor: COLORS.coral, borderRadius: 16, padding: 16,
    alignItems: 'center', minHeight: 54, justifyContent: 'center',
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: { fontFamily: FONTS.bold, color: COLORS.white, fontSize: 16 },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20, paddingRight: 4 },
  checkbox: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: COLORS.coralBorder,
    backgroundColor: COLORS.inputBg, alignItems: 'center', justifyContent: 'center',
    marginRight: 10, marginTop: 1,
  },
  checkboxChecked: { backgroundColor: COLORS.coral, borderColor: COLORS.coral },
  checkboxMark: { color: COLORS.white, fontSize: 13, fontFamily: FONTS.bold },
  consentText: { flex: 1, fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textSecondary, lineHeight: 17 },
});
