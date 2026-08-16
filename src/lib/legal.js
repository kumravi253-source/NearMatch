// Canonical attestation text. This exact string is what gets displayed
// to the user at signup AND what gets written to legal_attestations —
// keep them identical so the logged row always matches what was shown.
export const AGE_ATTESTATION_TEXT =
  'I confirm I am 18 years of age or older and that the information I provide is accurate.';

// Canonical DPDP Act, 2023 consent text. Same pairing rule as above —
// this is what's shown at signup and what gets written to
// dpdp_consents, so keep them identical.
export const DPDP_CONSENT_TEXT =
  "I consent to NearMatch collecting and processing my personal data (including my profile information, photos, and messages) as described in the Privacy Policy, in accordance with India's Digital Personal Data Protection Act, 2023.";

// Canonical consent text for the optional selfie age check. The blanket
// DPDP_CONSENT_TEXT above deliberately does not cover this: the selfie is
// biometric data, it goes to a named third party, and that party is outside
// India — so it needs its own specific, separately-given consent rather than
// riding along on the signup checkbox.
//
// Names the provider explicitly. The provider has already moved twice (Yoti
// -> AWS Rekognition -> Face++), so if it moves again this string must be
// updated in the same change — a stored consent naming the wrong recipient is
// worse than no consent at all.
//
// Shown on VerifyAgeScreen and written verbatim to biometric_consents by the
// verify-age Edge Function before the image is sent anywhere. Same pairing
// rule as above: what's displayed and what's logged are the same string.
export const BIOMETRIC_CONSENT_TEXT =
  'I consent to NearMatch sending this selfie to Face++ (Megvii Technology), an age-estimation provider located outside India, for the single purpose of estimating my age. I understand the photo is used for this one check, is never stored by NearMatch, and that what Face++ does with it after it arrives is governed by their terms. This check is optional and I can keep using NearMatch without it.';
