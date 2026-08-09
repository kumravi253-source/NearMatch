import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert, Image, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { withSignedPhotoUrl } from '../../lib/avatars';
import { COLORS, FONTS } from '../../theme/theme';

const INTEREST_OPTIONS = [
  'Travel', 'Music', 'Movies', 'Foodie', 'Fitness', 'Art',
  'Gaming', 'Reading', 'Hiking', 'Coffee', 'Dancing', 'Pets',
];

const AVATAR_OPTIONS = ['🙂', '😎', '🥳', '🌸', '🌻', '🦋'];
const GENDER_OPTIONS = ['Man', 'Woman', 'Non-binary'];

export default function ProfileSetupScreen({ userId, onComplete, existingProfile, onCancel }) {
  const isEditMode = !!existingProfile;
  const [avatar, setAvatar] = useState(existingProfile?.avatar_emoji || AVATAR_OPTIONS[0]);
  const [photoUri, setPhotoUri] = useState(null);
  // The stored value is an object path in a private bucket. Keep the path for
  // saving, and a separately-minted signed URL for rendering the preview.
  const [existingPhotoPath, setExistingPhotoPath] = useState(existingProfile?.photo_url || null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState(null);
  const [name, setName] = useState(existingProfile?.name || '');
  const [age, setAge] = useState(existingProfile?.age ? String(existingProfile.age) : '');
  const [gender, setGender] = useState(existingProfile?.gender || '');
  const [bio, setBio] = useState(existingProfile?.bio || '');
  const [interests, setInterests] = useState(existingProfile?.interests || []);
  const [saving, setSaving] = useState(false);

  // Mint a signed URL for the existing photo so the preview renders. Cancelled
  // on unmount so a slow round trip can't set state on a gone component.
  useEffect(() => {
    if (!existingPhotoPath) {
      setExistingPhotoUrl(null);
      return;
    }
    let cancelled = false;
    withSignedPhotoUrl({ photo_url: existingPhotoPath }).then((signed) => {
      if (!cancelled) setExistingPhotoUrl(signed?.photo_url ?? null);
    });
    return () => { cancelled = true; };
  }, [existingPhotoPath]);

  const toggleInterest = (interest) => {
    setInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : prev.length < 5 ? [...prev, interest] : prev
    );
  };

  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setPhotoUri(result.assets[0].uri);
      // Clearing the path also clears the signed preview via the effect above.
      setExistingPhotoPath(null);
    }
  };

  const uploadPhoto = async () => {
    const response = await fetch(photoUri);
    const arrayBuffer = await response.arrayBuffer();
    const path = `${userId}/profile.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
    if (uploadError) throw uploadError;
    // The bucket is private, so store the object path — a signed URL is minted
    // at render time instead. No cache-buster needed: signed URLs are unique
    // per mint, so an overwritten photo can't be served from a stale cache.
    return path;
  };

  const handleContinue = async () => {
    if (!name || !age || !gender) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    const ageNum = parseInt(age, 10);
    if (!Number.isInteger(ageNum) || ageNum < 18 || ageNum > 120) {
      Alert.alert('Error', 'Please enter a valid age (18 or older)');
      return;
    }
    if (interests.length === 0) {
      Alert.alert('Error', 'Pick at least one interest');
      return;
    }

    setSaving(true);
    try {
      let photoUrl = existingPhotoPath;
      if (photoUri) {
        photoUrl = await uploadPhoto();
      }

      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          name,
          age: ageNum,
          gender,
          bio,
          avatar_emoji: avatar,
          photo_url: photoUrl,
          interests,
        })
        .select()
        .single();

      if (error) throw error;
      onComplete(data);
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {onCancel && (
          <TouchableOpacity onPress={onCancel} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>{isEditMode ? 'Edit your profile 🌸' : 'Set up your profile 🌸'}</Text>
        <Text style={styles.subtitle}>{isEditMode ? 'Update your info anytime' : 'Let others know who you are'}</Text>

        <View style={styles.photoSection}>
          <TouchableOpacity style={styles.photoPreview} onPress={handlePickPhoto}>
            {photoUri || existingPhotoUrl ? (
              <Image source={{ uri: photoUri || existingPhotoUrl }} style={styles.photoImage} />
            ) : (
              <Text style={styles.photoPreviewEmoji}>{avatar}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoBtn} onPress={handlePickPhoto}>
            <Text style={styles.photoBtnText}>{photoUri || existingPhotoPath ? 'Change Photo' : 'Add Photo'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Or pick an avatar</Text>
        <View style={styles.avatarRow}>
          {AVATAR_OPTIONS.map((a) => (
            <TouchableOpacity
              key={a}
              style={[styles.avatarBtn, !photoUri && !existingPhotoPath && avatar === a && styles.avatarBtnActive]}
              onPress={() => { setAvatar(a); setPhotoUri(null); setExistingPhotoUrl(null); }}
            >
              <Text style={styles.avatarEmoji}>{a}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          style={styles.input} placeholder="Your Name"
          placeholderTextColor={COLORS.textSecondary} value={name} onChangeText={setName}
        />
        <TextInput
          style={styles.input} placeholder="Age"
          placeholderTextColor={COLORS.textSecondary} value={age} onChangeText={setAge}
          keyboardType="number-pad" maxLength={3}
        />

        <Text style={styles.label}>I am a</Text>
        <View style={styles.genderRow}>
          {GENDER_OPTIONS.map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.genderBtn, gender === g && styles.genderBtnActive]}
              onPress={() => setGender(g)}
            >
              <Text style={[styles.genderText, gender === g && styles.genderTextActive]}>{g}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          style={[styles.input, styles.bioInput]} placeholder="A little about you..."
          placeholderTextColor={COLORS.textSecondary} value={bio} onChangeText={setBio}
          multiline numberOfLines={3}
        />

        <Text style={styles.label}>Interests (pick up to 5)</Text>
        <View style={styles.interestsWrap}>
          {INTEREST_OPTIONS.map((i) => (
            <TouchableOpacity
              key={i}
              style={[styles.chip, interests.includes(i) && styles.chipActive]}
              onPress={() => toggleInterest(i)}
            >
              <Text style={[styles.chipText, interests.includes(i) && styles.chipTextActive]}>{i}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.btn} onPress={handleContinue} disabled={saving}>
          {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.btnText}>{isEditMode ? 'Save Changes' : 'Continue'}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, padding: 24, paddingTop: 60, paddingBottom: 40 },
  title: { fontFamily: FONTS.bold, fontSize: 24, color: COLORS.textPrimary, textAlign: 'center', marginBottom: 4 },
  subtitle: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.teal, textAlign: 'center', marginBottom: 24 },
  label: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.teal, marginBottom: 10, marginTop: 4 },
  photoSection: { alignItems: 'center', marginBottom: 20 },
  photoPreview: {
    width: 110, height: 110, borderRadius: 55, backgroundColor: COLORS.inputBg,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.coralBorder,
    overflow: 'hidden', marginBottom: 10,
  },
  photoImage: { width: 110, height: 110 },
  photoPreviewEmoji: { fontSize: 52 },
  photoBtn: {
    borderWidth: 1.5, borderColor: COLORS.teal, borderRadius: 20,
    paddingVertical: 8, paddingHorizontal: 18,
  },
  photoBtnText: { fontFamily: FONTS.bold, color: COLORS.teal, fontSize: 13 },
  avatarRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' },
  avatarBtn: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.inputBg,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.coralBorder,
  },
  avatarBtnActive: { borderColor: COLORS.coral, backgroundColor: COLORS.coralLight },
  avatarEmoji: { fontSize: 26 },
  input: {
    backgroundColor: COLORS.inputBg, borderWidth: 1.5, borderColor: COLORS.coralBorder,
    borderRadius: 14, padding: 14, fontSize: 14, fontFamily: FONTS.medium, color: COLORS.textPrimary, marginBottom: 12,
  },
  genderRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  genderBtn: {
    flex: 1, borderWidth: 1.5, borderColor: COLORS.coralBorder,
    borderRadius: 14, padding: 10, alignItems: 'center', backgroundColor: COLORS.white,
  },
  genderBtnActive: { backgroundColor: COLORS.coralLight, borderColor: COLORS.coral },
  genderText: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.textSecondary },
  genderTextActive: { fontFamily: FONTS.bold, color: COLORS.coral },
  bioInput: { height: 90, textAlignVertical: 'top' },
  interestsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 28 },
  chip: {
    borderWidth: 1.5, borderColor: COLORS.tealBorder, borderRadius: 20,
    paddingVertical: 8, paddingHorizontal: 14, backgroundColor: COLORS.white,
  },
  chipActive: { backgroundColor: COLORS.teal, borderColor: COLORS.teal },
  chipText: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.textSecondary },
  chipTextActive: { fontFamily: FONTS.bold, color: COLORS.white },
  btn: { backgroundColor: COLORS.coral, borderRadius: 16, padding: 16, alignItems: 'center', minHeight: 52, justifyContent: 'center' },
  btnText: { fontFamily: FONTS.bold, color: COLORS.white, fontSize: 16 },
  backBtn: { marginBottom: 16 },
  backText: { fontFamily: FONTS.bold, fontSize: 16, color: COLORS.coral },
});
