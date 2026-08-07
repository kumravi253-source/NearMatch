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
