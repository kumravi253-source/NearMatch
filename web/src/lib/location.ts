import { supabase } from './supabase';

// Web counterpart of src/lib/location.js, which uses expo-location. The
// browser equivalent is navigator.geolocation, which is promise-less and
// permission-prompts on first call.
//
// Silent no-op on denial or failure, exactly as on mobile: proximity matching
// falls back to newest-first ordering, so this must never throw or block.

const GEO_TIMEOUT_MS = 10_000;

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: GEO_TIMEOUT_MS,
      maximumAge: 5 * 60 * 1000,
    });
  });
}

export async function requestAndSaveLocation(userId: string): Promise<boolean> {
  try {
    const position = await getPosition();

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
    // Includes the user declining the permission prompt, which is not an
    // error worth surfacing.
    console.warn('Location unavailable', error);
    return false;
  }
}
