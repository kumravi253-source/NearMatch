import { supabase } from './supabase';

// Avatars live in a private bucket, so rendering one means minting a signed
// URL first. An hour comfortably outlives a session's use of a given list
// without leaving long-lived links lying around in memory or logs.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

const PUBLIC_URL_MARKER = '/storage/v1/object/public/avatars/';

// profiles.photo_url holds an object path ("<user_id>/profile.jpg"). Rows
// written before the bucket went private held a full public URL with a
// cache-busting query string; the migration rewrites those, but a client
// running against a not-yet-migrated database would still see them, so accept
// both shapes. Returns null when there's nothing renderable.
export function toStoragePath(photoUrl) {
  if (!photoUrl) return null;

  const markerIndex = photoUrl.indexOf(PUBLIC_URL_MARKER);
  if (markerIndex !== -1) {
    return photoUrl.slice(markerIndex + PUBLIC_URL_MARKER.length).split('?')[0];
  }

  // Some other absolute URL — not ours to sign, and passing it to the storage
  // API would just error.
  if (/^https?:\/\//.test(photoUrl)) return null;

  return photoUrl.split('?')[0];
}

// Replaces photo_url on each profile with a short-lived signed URL, in a
// single round trip for the whole list.
//
// Signing failures degrade to no photo rather than propagating: a broken
// avatar should never take down the discovery deck or a match list. Callers
// get a new array; the input is not mutated.
export async function withSignedPhotoUrls(profiles) {
  if (!Array.isArray(profiles) || profiles.length === 0) return profiles ?? [];

  const paths = [];
  for (const profile of profiles) {
    const path = toStoragePath(profile?.photo_url);
    if (path && !paths.includes(path)) paths.push(path);
  }
  if (paths.length === 0) return profiles;

  const { data, error } = await supabase.storage
    .from('avatars')
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

  if (error) {
    console.error('Failed to sign avatar URLs', error);
    return profiles.map((profile) => ({ ...profile, photo_url: null }));
  }

  const signedByPath = new Map();
  for (const row of data ?? []) {
    // Per-object errors arrive inline (missing file, for instance) with a null
    // signedUrl — skipping them leaves that profile photoless.
    if (row?.signedUrl && row?.path) signedByPath.set(row.path, row.signedUrl);
  }

  return profiles.map((profile) => {
    const path = toStoragePath(profile?.photo_url);
    return { ...profile, photo_url: path ? signedByPath.get(path) ?? null : null };
  });
}

// Single-profile convenience wrapper for the places that hold one profile
// rather than a list.
export async function withSignedPhotoUrl(profile) {
  if (!profile) return profile;
  const [signed] = await withSignedPhotoUrls([profile]);
  return signed;
}
