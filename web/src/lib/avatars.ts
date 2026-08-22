import { supabase } from './supabase';

// Port of src/lib/avatars.js. Avatars live in a private bucket, so rendering
// one means minting a signed URL first. An hour comfortably outlives a
// session's use of a given list without leaving long-lived links around.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

const PUBLIC_URL_MARKER = '/storage/v1/object/public/avatars/';

/** profiles.photo_url holds an object path ("<uid>/profile.jpg"). Rows written
 *  before the bucket went private held a full public URL; accept both shapes.
 *  Returns null when there is nothing renderable. */
export function toStoragePath(photoUrl: string | null | undefined): string | null {
  if (!photoUrl) return null;

  const markerIndex = photoUrl.indexOf(PUBLIC_URL_MARKER);
  if (markerIndex !== -1) {
    return photoUrl.slice(markerIndex + PUBLIC_URL_MARKER.length).split('?')[0];
  }

  // Some other absolute URL — not ours to sign.
  if (/^https?:\/\//.test(photoUrl)) return null;

  return photoUrl.split('?')[0];
}

/** Replaces photo_url on each row with a short-lived signed URL, in one round
 *  trip for the whole list. Signing failures degrade to no photo rather than
 *  propagating: a broken avatar must never take down the deck or match list.
 *  Callers get a new array; the input is not mutated. */
export async function withSignedPhotoUrls<T extends { photo_url: string | null }>(
  profiles: T[] | null | undefined
): Promise<T[]> {
  if (!Array.isArray(profiles) || profiles.length === 0) return profiles ?? [];

  const paths: string[] = [];
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

  const signedByPath = new Map<string, string>();
  for (const row of data ?? []) {
    // Per-object errors arrive inline (a missing file, say) with a null
    // signedUrl — skipping them leaves that profile photoless.
    if (row?.signedUrl && row?.path) signedByPath.set(row.path, row.signedUrl);
  }

  return profiles.map((profile) => {
    const path = toStoragePath(profile?.photo_url);
    return { ...profile, photo_url: path ? signedByPath.get(path) ?? null : null };
  });
}

export async function withSignedPhotoUrl<T extends { photo_url: string | null }>(
  profile: T | null
): Promise<T | null> {
  if (!profile) return profile;
  const [signed] = await withSignedPhotoUrls([profile]);
  return signed;
}
