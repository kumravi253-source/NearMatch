-- Pin search_path on the six functions flagged by the Supabase database
-- linter as 0011_function_search_path_mutable.
--
-- A function without a fixed search_path resolves unqualified names using
-- whatever search_path the caller happens to have. For a SECURITY DEFINER
-- function that is a privilege-escalation vector: a caller can put a schema
-- ahead of public, shadow a function or table the body references, and have
-- their version run as the definer. Pinning removes the caller's influence.
--
-- pg_temp is listed last on purpose. If it is not named explicitly Postgres
-- searches the temp schema first, which reintroduces the same shadowing
-- problem via temporary objects.
--
-- Each body was checked before pinning. All six reference only pg_catalog
-- builtins (which resolve regardless of search_path) or fully schema-
-- qualified names -- public.profiles, public.generate_referral_code(),
-- realtime.broadcast_changes() -- so none depends on an unqualified lookup
-- into extensions or any other schema. Behaviour is unchanged.
--
-- messages_realtime_broadcast_trigger is the one that actually mattered: it
-- was the only SECURITY DEFINER function in this set with no search_path.
-- The other five are non-definer, so pinning them is defence in depth.

alter function public.fuzzy_distance_label(km double precision)
  set search_path = public, pg_temp;

alter function public.generate_referral_code()
  set search_path = public, pg_temp;

alter function public.haversine_km(
  lat1 double precision, lon1 double precision,
  lat2 double precision, lon2 double precision
) set search_path = public, pg_temp;

alter function public.messages_realtime_broadcast_trigger()
  set search_path = public, pg_temp;

alter function public.set_referral_code()
  set search_path = public, pg_temp;

alter function public.set_updated_at()
  set search_path = public, pg_temp;
