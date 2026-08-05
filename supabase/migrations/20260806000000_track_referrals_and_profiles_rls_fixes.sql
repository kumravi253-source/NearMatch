-- Tracks two RLS fixes found already live in production on 2026-08-06 but
-- never captured in a migration — same out-of-band-drift pattern as the
-- `replace_with_policy_name` placeholder cleaned up in
-- 20260802000001_fix_profile_locations_rls.sql. Without this file, a fresh
-- `supabase db reset` would recreate the vulnerable state from
-- 20260626204436_init_schema.sql and 20260724000200_referrals_and_wallet.sql.
--
-- 1. referrals: a leftover `replace_with_policy_name` SELECT policy
--    (qual: true) granted every authenticated user blanket read access to
--    the whole table, OR'd on top of the correct "users can view referrals
--    they made" policy. Live check on 2026-08-06 confirms it's already gone
--    — dropping it here again is a no-op guard, not a live change.
drop policy if exists "replace_with_policy_name" on public.referrals;

-- 2. profiles: the original SELECT policy (qual: true) let any authenticated
--    user read a blocked/blocking user's full profile via a direct
--    `/rest/v1/profiles?id=eq.<uuid>` REST call, bypassing the block
--    filtering that only existed inside get_candidate_profiles(). Live check
--    on 2026-08-06 shows the policy already carries the block-aware qual
--    below — this re-applies the same definition so it's tracked in git.
drop policy if exists "profiles are viewable by authenticated users" on public.profiles;

create policy "profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (
    id = auth.uid()
    or not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = profiles.id)
         or (b.blocker_id = profiles.id and b.blocked_id = auth.uid())
    )
  );
