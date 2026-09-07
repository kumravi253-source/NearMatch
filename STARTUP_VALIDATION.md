# Startup recovery — validation and release gate

This change addresses confirmed unhandled startup paths, not a proven cause of
TestFlight build 19's failure. No production build environment or device logs
were available to establish that cause.

Run dependency-free tests: `node --test tests/startup.test.cjs`.
Tests cover task success/rejection/throw/timeout/cancellation, optional analytics,
root loading isolation, fallback/retry state, and splash dismissal with mocks.
These are not native device tests or a complete Metro bundle/build validation.

Before resubmission:
- Verify both EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set
  in the actual EAS production build environment. Do not commit their values.
- Run Expo's dependency checks and export an iOS/Android production bundle.
- Test a release build on real iPhone and Android devices: fresh install,
  returning session, offline startup, expired session, unavailable backend,
  failed font loading, retry, and sign-out while a profile request is pending.
- Confirm a profile fetch error shows recovery, never new-account onboarding.
- Confirm the fallback can be read and operated with VoiceOver/TalkBack.
- A missing build-time setting requires a corrected new build; Retry cannot
  change values already embedded in the installed app.
- A JavaScript boundary cannot catch native process crashes or bundle loading
  failures before JavaScript executes. Collect device logs if orange persists.

The root deliberately leaves Supabase's fail-closed configuration validation
intact. It catches the module initialization failure above App and displays a
generic error without exposing credentials or raw backend responses. No mock
backend, guest bypass, session deletion, billing, policy, or store settings change
is included. Native analytics crashes remain a device-validation concern.
