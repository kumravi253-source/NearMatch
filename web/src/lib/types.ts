// Shapes returned by the Supabase tables and RPCs this client touches.
// Hand-written rather than generated: the app reads a small, stable slice of
// the schema, and a generated file would need regenerating on every unrelated
// migration.

export type Profile = {
  id: string;
  name: string;
  age: number;
  gender: string;
  bio: string | null;
  avatar_emoji: string | null;
  /** Storage object path ("<uid>/profile.jpg"), or a signed URL once passed
   *  through withSignedPhotoUrls. Null when the user has no photo. */
  photo_url: string | null;
  interests: string[] | null;
  age_verified: boolean;
  referral_code: string | null;
};

/** get_candidate_profiles and get_pending_likes return profile rows plus, on
 *  the candidate path, a distance the proximity ordering computed. */
export type Candidate = Profile & {
  distance_km?: number | null;
};

export type MatchRow = {
  id: string;
  user_a: string;
  user_b: string;
  created_at: string;
};

/** A match joined to the other person's profile, as the UI needs it. */
export type MatchWithProfile = Profile & {
  matchId: string;
  lastMessage: string | null;
};

export type Message = {
  id: string;
  match_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export type SwipeDirection = 'like' | 'pass';

export type ReportReason =
  | 'inappropriate_photos'
  | 'harassment'
  | 'fake_profile'
  | 'spam'
  | 'other';
