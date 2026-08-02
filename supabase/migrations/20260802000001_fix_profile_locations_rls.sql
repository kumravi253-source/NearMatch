-- Fixes the remaining CRITICAL finding from the 2026-07-30 security audit
-- (open for 3+ days as of security-reports/2026-08-01-evening.md).
--
-- profile_locations exposed every user's exact GPS lat/long to any
-- logged-in user. Two permissive `authenticated`-role SELECT policies
-- (qual: true) exist outside migration history — added via the Studio
-- UI, never cleaned up — and RLS policies are OR'd together, so they
-- fully overrode the correct owner-only policy ("users can manage
-- their own location", user_id = auth.uid()) defined in
-- 20260724000000_proximity_matching.sql. Dropping them leaves only
-- that owner-only policy in effect.
-- get_candidate_profiles() already returns a fuzzed distance label
-- instead of raw coordinates, so no legitimate caller needs direct
-- SELECT access to this table.
drop policy if exists "authenticated_select_profile_locations" on public.profile_locations;
drop policy if exists "replace_with_policy_name" on public.profile_locations;
