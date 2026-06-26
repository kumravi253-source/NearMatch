import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const INTEREST_OPTIONS = [
  'Travel', 'Music', 'Movies', 'Foodie', 'Fitness', 'Art',
  'Gaming', 'Reading', 'Hiking', 'Coffee', 'Dancing', 'Pets',
];

const AVATAR_OPTIONS = ['🙂', '😎', '🥳', '🌸', '🌻', '🦋'];

export default function ProfileSetupScreen({ onComplete }) {
  const [avatar, setAvatar] = useState(AVATAR_OPTIONS[0]);
  const [photoUri, setPhotoUri] = useState(null);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState([]);

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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleContinue = () => {
    if (!name || !age || !bio) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    if (interests.length === 0) {
      Alert.alert('Error', 'Pick at least one interest');
      return;
    }
    onComplete({ avatar, photoUri, name, age, bio, interests });
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Set up your profile 🌸</Text>
        <Text style={styles.subtitle}>Let others know who you are</Text>

        <View style={styles.photoSection}>
          <TouchableOpacity style={styles.photoPreview} onPress={handlePickPhoto}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photoImage} />
            ) : (
              <Text style={styles.photoPreviewEmoji}>{avatar}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoBtn} onPress={handlePickPhoto}>
            <Text style={styles.photoBtnText}>{photoUri ? 'Change Photo' : 'Add Photo'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Or pick an avatar</Text>
        <View style={styles.avatarRow}>
          {AVATAR_OPTIONS.map((a) => (
            <TouchableOpacity
              key={a}
              style={[styles.avatarBtn, !photoUri && avatar === a && styles.avatarBtnActive]}
              onPress={() => { setAvatar(a); setPhotoUri(null); }}
            >
              <Text style={styles.avatarEmoji}>{a}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          style={styles.input} placeholder="Your Name"
          placeholderTextColor="#B87A68" value={name} onChangeText={setName}
        />
        <TextInput
          style={styles.input} placeholder="Age"
          placeholderTextColor="#B87A68" value={age} onChangeText={setAge}
          keyboardType="number-pad" maxLength={2}
        />
        <TextInput
          style={[styles.input, styles.bioInput]} placeholder="A little about you..."
          placeholderTextColor="#B87A68" value={bio} onChangeText={setBio}
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

        <TouchableOpacity style={styles.btn} onPress={handleContinue}>
          <Text style={styles.btnText}>Continue</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5F0' },
  scroll: { flexGrow: 1, padding: 24, paddingTop: 60, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700', color: '#3D1A0E', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#B87A68', textAlign: 'center', marginBottom: 24, fontStyle: 'italic' },
  label: { fontSize: 14, fontWeight: '600', color: '#8C4A35', marginBottom: 10, marginTop: 4 },
  photoSection: { alignItems: 'center', marginBottom: 20 },
  photoPreview: {
    width: 110, height: 110, borderRadius: 55, backgroundColor: '#FEF0EA',
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#F5C4B0',
    overflow: 'hidden', marginBottom: 10,
  },
  photoImage: { width: 110, height: 110 },
  photoPreviewEmoji: { fontSize: 52 },
  photoBtn: {
    borderWidth: 1.5, borderColor: '#E8603A', borderRadius: 20,
    paddingVertical: 8, paddingHorizontal: 18,
  },
  photoBtnText: { color: '#E8603A', fontSize: 13, fontWeight: '700' },
  avatarRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' },
  avatarBtn: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#FEF0EA',
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#F5C4B0',
  },
  avatarBtnActive: { borderColor: '#E8603A', backgroundColor: '#FDDDD4' },
  avatarEmoji: { fontSize: 26 },
  input: {
    backgroundColor: '#FEF0EA', borderWidth: 1.5, borderColor: '#F5C4B0',
    borderRadius: 12, padding: 14, fontSize: 14, color: '#3D1A0E', marginBottom: 12,
  },
  bioInput: { height: 90, textAlignVertical: 'top' },
  interestsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 28 },
  chip: {
    borderWidth: 1.5, borderColor: '#F5C4B0', borderRadius: 20,
    paddingVertical: 8, paddingHorizontal: 14, backgroundColor: '#FFFFFF',
  },
  chipActive: { backgroundColor: '#E8603A', borderColor: '#E8603A' },
  chipText: { fontSize: 13, color: '#8C4A35' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  btn: { backgroundColor: '#E8603A', borderRadius: 14, padding: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
