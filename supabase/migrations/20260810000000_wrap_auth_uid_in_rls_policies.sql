-- Wrap auth.uid() as (select auth.uid()) in every public RLS policy that
-- still calls it bare. Addresses the linter's auth_rls_initplan finding.
--
-- auth.uid() is STABLE, not IMMUTABLE, so inside a policy predicate Postgres
-- re-evaluates it once per row scanned. Wrapping it in a scalar subquery
-- promotes it to an InitPlan: evaluated once per query and reused for every
-- row. The rewrite is safe because auth.uid() takes no per-row input, so
-- hoisting it cannot change the result.
--
-- This is a pure performance change. Each predicate below was generated from
-- the live pg_policies definition with auth.uid() replaced in place and
-- nothing else altered -- same columns, same boolean structure, same
-- subqueries, same roles, same command. Access semantics are identical.
--
-- USING vs WITH CHECK follows each policy's existing command type: INSERT
-- policies carry only WITH CHECK, SELECT and DELETE only USING, UPDATE and
-- ALL both. Policies are left otherwise untouched.
--
-- Not included: the threads, thread_participants, thread_messages and
-- thread_summaries policies already use ( SELECT auth.uid() ) and are
-- already optimal. Storage policies live in the storage schema and are out
-- of scope for this migration.

-- age_verifications ---------------------------------------------------------
alter policy "users can view their own age verification" on public.age_verifications
  using (user_id = (select auth.uid()));

-- blocks --------------------------------------------------------------------
alter policy "users can block others" on public.blocks
  with check (blocker_id = (select auth.uid()));

alter policy "users can unblock people they blocked" on public.blocks
  using (blocker_id = (select auth.uid()));

alter policy "users can view blocks involving them" on public.blocks
  using (blocker_id = (select auth.uid()) or blocked_id = (select auth.uid()));

-- dpdp_consents -------------------------------------------------------------
alter policy "users can record their own consent" on public.dpdp_consents
  with check (user_id = (select auth.uid()));

alter policy "users can view their own consent" on public.dpdp_consents
  using (user_id = (select auth.uid()));

-- legal_attestations --------------------------------------------------------
alter policy "users can record their own attestation" on public.legal_attestations
  with check (user_id = (select auth.uid()));

alter policy "users can view their own attestation" on public.legal_attestations
  using (user_id = (select auth.uid()));

-- matches -------------------------------------------------------------------
alter policy "users can view their own matches" on public.matches
  using ((select auth.uid()) = user_a or (select auth.uid()) = user_b);

-- messages ------------------------------------------------------------------
alter policy "participants can send messages in their matches" on public.messages
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1
      from public.matches m
      where m.id = messages.match_id
        and (m.user_a = (select auth.uid()) or m.user_b = (select auth.uid()))
    )
    and not exists (
      select 1
      from public.matches m
      join public.blocks b
        on ((b.blocker_id = m.user_a and b.blocked_id = m.user_b)
         or (b.blocker_id = m.user_b and b.blocked_id = m.user_a))
      where m.id = messages.match_id
    )
  );

alter policy "participants can view messages in their matches" on public.messages
  using (
    exists (
      select 1
      from public.matches m
      where m.id = messages.match_id
        and (m.user_a = (select auth.uid()) or m.user_b = (select auth.uid()))
    )
  );

-- profile_locations ---------------------------------------------------------
alter policy "users can manage their own location" on public.profile_locations
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- profiles ------------------------------------------------------------------
alter policy "profiles are viewable by authenticated users" on public.profiles
  using (
    id = (select auth.uid())
    or not exists (
      select 1
      from public.blocks b
      where (b.blocker_id = (select auth.uid()) and b.blocked_id = profiles.id)
         or (b.blocker_id = profiles.id and b.blocked_id = (select auth.uid()))
    )
  );

alter policy "users can insert their own profile" on public.profiles
  with check (id = (select auth.uid()));

alter policy "users can update their own profile" on public.profiles
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- referrals -----------------------------------------------------------------
alter policy "users can view referrals they made" on public.referrals
  using (referrer_id = (select auth.uid()));

-- reports -------------------------------------------------------------------
alter policy "users can file reports" on public.reports
  with check (reporter_id = (select auth.uid()));

alter policy "users can view their own reports" on public.reports
  using (reporter_id = (select auth.uid()));

-- subscriptions -------------------------------------------------------------
alter policy "users can insert own subscriptions" on public.subscriptions
  with check (user_id = (select auth.uid()));

alter policy "users can select own subscriptions" on public.subscriptions
  using (user_id = (select auth.uid()));

-- swipes --------------------------------------------------------------------
alter policy "users can view their own swipes" on public.swipes
  using (swiper_id = (select auth.uid()));

-- wallet_transactions -------------------------------------------------------
alter policy "wallet_transactions_select_own" on public.wallet_transactions
  using (user_id = (select auth.uid()));
