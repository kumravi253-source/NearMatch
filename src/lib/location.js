import * as Location from 'expo-location';
import { supabase } from './supabase';

// Requests the when-in-use permission (no-op if already granted or
// denied) and, if granted, saves an approximate position to
// profile_locations. Silent no-op on denial or failure — proximity
// matching just falls back to the newest-first ordering in that case,
// so this must never throw or block the caller.
export async function requestAndSaveLocation(userId) {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return false;

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const { error } = await supabase.from('profile_locations').upsert({
      user_id: userId,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });

    if (error) {
      console.error('Failed to save location', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Failed to get location', error);
    return false;
  }
}
