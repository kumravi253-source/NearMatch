-- Manual sales tracker for pre-launch customers contacted directly over
-- WhatsApp (before they have a NearMatch account, so they can't appear
-- in public.subscriptions yet). Founder-only CRM data: no anon or
-- authenticated policy exists at all, so it is invisible to the app and
-- to every app user — only reachable via the service role key, i.e.
-- from the Supabase dashboard Table Editor/SQL editor while logged in
-- as the project owner. Do not grant anon/authenticated access to this
-- table; it exists specifically to keep customer PII out of git.

create table public.manual_leads (
  id bigint generated always as identity primary key,
  name text,
  whatsapp_number text not null,
  location text,
  plan text check (plan in ('monthly', 'quarterly')),
  status text not null default 'wishlist' check (status in ('wishlist', 'payment_link_sent', 'paid')),
  amount_paise int check (amount_paise >= 0),
  razorpay_payment_id text,
  contacted_at timestamptz not null default now()
);

alter table public.manual_leads enable row level security;

create index manual_leads_status_idx on public.manual_leads (status);
