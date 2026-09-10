// Mirrors src/lib/legal.js. These strings are displayed to the user AND
// written verbatim to legal_attestations / dpdp_consents / biometric_consents,
// so the two copies must stay byte-identical: a stored consent that does not
// match what was shown is worse than no record at all.
//
// If any of these change, change them in src/lib/legal.js in the same commit.

export const AGE_ATTESTATION_TEXT =
  'I confirm I am 18 years of age or older and that the information I provide is accurate.';

export const DPDP_CONSENT_TEXT =
  "I consent to NearMatch collecting and processing my personal data (including my profile information, photos, and messages) as described in the Privacy Policy, in accordance with India's Digital Personal Data Protection Act, 2023.";

// Names Face++ explicitly. The provider has moved twice already
// (Yoti -> AWS Rekognition -> Face++); if it moves again this string must be
// updated in the same change, in both copies.
export const BIOMETRIC_CONSENT_TEXT =
  'I consent to NearMatch sending this selfie to Face++ (Megvii Technology), an age-estimation provider located outside India, for the single purpose of estimating my age. I understand the photo is used for this one check, is never stored by NearMatch, and that what Face++ does with it after it arrives is governed by their terms. This check is optional and I can keep using NearMatch without it.';
