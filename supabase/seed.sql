-- Demo / App Store review fixtures.
--
-- config.toml has [db.seed] enabled with sql_paths = ["./seed.sql"], but this
-- file did not exist until now, so `supabase db reset` produced a completely
-- empty database and every demo account had to be rebuilt by hand afterwards.
-- The App Review account was in fact lost that way once: the 2026-08-06/08-07
-- reports describe it with id 70da959c-... and a seeded Priya match, and by
-- 2026-08-08 it had been recreated as a033b7b5-... with no profile row, no
-- match and no conversation.
--
-- Everything below is idempotent, so it is safe to run repeatedly and safe to
-- run against a database that already has some of these rows.
--
-- NOTE ON PASSWORDS: encrypted_password is deliberately left NULL. No
-- credentials are stored in this repo. After a reset, set the demo passwords
-- yourself (Supabase dashboard -> Authentication -> Users, or the Admin API)
-- before handing the account to Apple.

-- ---------------------------------------------------------------------------
-- Auth users
-- ---------------------------------------------------------------------------
insert into auth.users (
  id, instance_id, aud, role, email,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
)
values
  ('a033b7b5-a3a7-4e79-bfd3-2d5fd096f4e7', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'appreview@nearmatch.in',
   now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  ('7b5a5303-9ba8-4468-91a0-acf2124536a3', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'priya.demo@nearmatch.in',
   now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  ('76d0883f-ffb5-42f6-ac6d-bc3cd47839dc', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'arjun.demo@nearmatch.in',
   now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Profiles
-- referral_code is intentionally omitted: the profiles_set_referral_code
-- BEFORE INSERT trigger generates it.
-- ---------------------------------------------------------------------------
insert into public.profiles (id, name, age, gender, bio, avatar_emoji, photo_url, interests, age_verified)
values
  ('a033b7b5-a3a7-4e79-bfd3-2d5fd096f4e7', 'App Review', 30, 'Man',
   'Demo account for App Store review.',
   '🙂', null,
   array['Music','Travel','Food'], true),
  ('7b5a5303-9ba8-4468-91a0-acf2124536a3', 'Priya', 25, 'Woman',
   'Yoga instructor and chai addict. Looking for someone who enjoys sunsets and deep conversations.',
   null,
   'https://images.pexels.com/photos/7275701/pexels-photo-7275701.jpeg?auto=compress&cs=tinysrgb&h=1200&w=1200',
   array['Yoga','Cooking','Reading','Travel'], true),
  ('76d0883f-ffb5-42f6-ac6d-bc3cd47839dc', 'Arjun', 30, 'Man',
   'Startup founder building the next big thing. Gym, books, and Bollywood nights with friends.',
   null,
   'https://randomuser.me/api/portraits/men/52.jpg',
   array['Gym','Startups','Movies','Photography'], true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Swipes
-- Mutual likes back the Priya match, so she is correctly excluded from the
-- App Review account's Discover deck. Arjun's one-way like gives the premium
-- "who liked you" screen something to show.
-- ---------------------------------------------------------------------------
insert into public.swipes (swiper_id, swiped_id, direction, created_at)
values
  ('a033b7b5-a3a7-4e79-bfd3-2d5fd096f4e7', '7b5a5303-9ba8-4468-91a0-acf2124536a3', 'like', now() - interval '15 minutes'),
  ('7b5a5303-9ba8-4468-91a0-acf2124536a3', 'a033b7b5-a3a7-4e79-bfd3-2d5fd096f4e7', 'like', now() - interval '14 minutes'),
  ('76d0883f-ffb5-42f6-ac6d-bc3cd47839dc', 'a033b7b5-a3a7-4e79-bfd3-2d5fd096f4e7', 'like', now() - interval '5 minutes')
on conflict (swiper_id, swiped_id) do nothing;

-- ---------------------------------------------------------------------------
-- Match
-- matches has CHECK (user_a < user_b), and 7b5a5303... sorts before a033b7b5...
-- so Priya must be user_a.
-- ---------------------------------------------------------------------------
insert into public.matches (user_a, user_b, created_at)
values ('7b5a5303-9ba8-4468-91a0-acf2124536a3', 'a033b7b5-a3a7-4e79-bfd3-2d5fd096f4e7', now() - interval '13 minutes')
on conflict (user_a, user_b) do nothing;

-- ---------------------------------------------------------------------------
-- Seeded conversation
-- matches.id is an identity column, so the id is looked up rather than
-- hardcoded (it was 8 before the account was lost, 9 after). messages has no
-- natural unique key, so the NOT EXISTS guard provides idempotency.
-- ---------------------------------------------------------------------------
insert into public.messages (match_id, sender_id, body, created_at)
select m.id, v.sender, v.body, now() - v.ago
from public.matches m
cross join (values
  ('7b5a5303-9ba8-4468-91a0-acf2124536a3'::uuid, 'Hey! Loved your profile 😊',            interval '10 minutes'),
  ('a033b7b5-a3a7-4e79-bfd3-2d5fd096f4e7'::uuid, 'Thanks Priya! How is your week going?', interval '8 minutes'),
  ('7b5a5303-9ba8-4468-91a0-acf2124536a3'::uuid, 'Pretty good! Any plans this weekend?',  interval '6 minutes')
) as v(sender, body, ago)
where m.user_a = '7b5a5303-9ba8-4468-91a0-acf2124536a3'
  and m.user_b = 'a033b7b5-a3a7-4e79-bfd3-2d5fd096f4e7'
  and not exists (select 1 from public.messages g where g.match_id = m.id);

-- ---------------------------------------------------------------------------
-- Premium entitlement for the review account
-- is_premium() requires a subscriptions row with status 'active' and
-- expires_at in the future; without it get_pending_likes() raises
-- premium_required, which Apple's reviewer would hit as an error.
--
-- This is a comp, not a sale: amount_paise is 0 and the Razorpay identifiers
-- are deliberately non-real so this row can never be mistaken for revenue.
-- ---------------------------------------------------------------------------
insert into public.subscriptions (
  user_id, plan, status,
  razorpay_order_id, razorpay_payment_id,
  amount_paise, expires_at
)
values (
  'a033b7b5-a3a7-4e79-bfd3-2d5fd096f4e7', 'launch_promo', 'active',
  'order_COMP_APPREVIEW_NOT_A_REAL_PAYMENT',
  'pay_COMP_APPREVIEW_NOT_A_REAL_PAYMENT',
  0, now() + interval '1 year'
)
on conflict (razorpay_payment_id) do nothing;
