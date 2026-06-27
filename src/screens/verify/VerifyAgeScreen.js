import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image, Alert, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { COLORS, FONTS } from '../../theme/theme';

export default function VerifyAgeScreen({ onDone }) {
  const [photo, setPhoto] = useState(null);
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
    if (!photo?.base64) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-age', {
        body: { selfieImageBase64: photo.base64 },
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
    <View style={styles.container}>
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

      <TouchableOpacity style={styles.secondaryBtn} onPress={handleTakeSelfie} disabled={submitting}>
        <Text style={styles.secondaryBtnText}>{photo ? 'Retake Selfie' : 'Take Selfie'}</Text>
      </TouchableOpacity>

      {photo && (
        <TouchableOpacity style={styles.primaryBtn} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryBtnText}>Verify</Text>}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingTop: 60, paddingHorizontal: 24 },
  backBtn: { marginBottom: 20 },
  backText: { fontFamily: FONTS.bold, fontSize: 16, color: COLORS.coral },
  title: { fontFamily: FONTS.bold, fontSize: 24, color: COLORS.textPrimary, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 32, lineHeight: 20 },
  photoArea: { alignItems: 'center', marginBottom: 32 },
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
  primaryBtnText: { fontFamily: FONTS.bold, color: COLORS.white, fontSize: 16 },
});
