-- The existing "users can update their own profile" policy checks row
-- ownership (id = auth.uid()) but not which columns change — meaning a
-- client could otherwise UPDATE their own row to set age_verified =
-- true directly, faking the badge with no verification ever happening.
-- This trigger forces age_verified back to its previous value on any
-- update that isn't coming from the service role (the Edge Function).

create or replace function public.protect_age_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and new.age_verified is distinct from old.age_verified then
    new.age_verified := old.age_verified;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_age_verified
  before update on public.profiles
  for each row
  execute function public.protect_age_verified();
