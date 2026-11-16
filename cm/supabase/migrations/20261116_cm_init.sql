-- Country Manager (cm_*) — dunia bersama. Semua akses lewat Edge Function `cm-api` (service role).
-- RLS aktif tanpa policy = klien (anon/authenticated) tidak bisa membaca/menulis langsung.
create table if not exists public.cm_world (
  id int primary key default 1 check (id = 1),
  year int not null default 1980, paused boolean not null default false,
  advancing_until timestamptz, last_advance_at timestamptz, last_pop_check timestamptz,
  announcement text not null default '', mapbox_token text not null default '', ver int not null default 0
);
insert into public.cm_world (id) values (1) on conflict do nothing;
create table if not exists public.cm_countries (
  code text primary key, data jsonb not null, ver int not null default 0,
  president_uid uuid, president_session text, president_seen timestamptz, locked boolean not null default false
);
create table if not exists public.cm_profiles (
  uid uuid primary key, name text not null default 'Warga', avatar text, citizenship text, last_seen timestamptz not null default now(), banned boolean not null default false
);
create table if not exists public.cm_admins (email text primary key);
create table if not exists public.cm_offers (
  id bigserial primary key, kind text not null, from_c text not null, to_c text not null, sector text, value numeric,
  tariff_from numeric, tariff_to numeric, status text not null default 'pending', payload jsonb not null default '{}', year int not null,
  created_by uuid, ts timestamptz not null default now()
);
create table if not exists public.cm_transfers (
  id bigserial primary key, from_c text not null, to_c text not null, usd numeric not null, currency text not null, local_amt numeric not null,
  note text, uid uuid, kind text not null default 'transfer', ts timestamptz not null default now()
);
create table if not exists public.cm_news (
  id bigserial primary key, ts timestamptz not null default now(), year int not null, country text, source text not null, kind text not null, title text not null, body text not null default ''
);
create table if not exists public.cm_posts (
  id bigserial primary key, country text not null, uid uuid, author text not null, role text not null, body text not null check (char_length(body) <= 500),
  likes int not null default 0, ts timestamptz not null default now(), hidden boolean not null default false
);
create table if not exists public.cm_post_likes (post_id bigint not null references public.cm_posts(id) on delete cascade, uid uuid not null, primary key (post_id, uid));
create table if not exists public.cm_petitions (
  id bigserial primary key, country text not null, uid uuid not null, author text not null, title text not null, body text not null,
  supports int not null default 0, status text not null default 'open', answer text, year int not null, ts timestamptz not null default now(), hidden boolean not null default false
);
create table if not exists public.cm_petition_supports (petition_id bigint not null references public.cm_petitions(id) on delete cascade, uid uuid not null, primary key (petition_id, uid));
create table if not exists public.cm_civic (uid uuid not null, kind text not null, year int not null, country text not null, primary key (uid, kind, year));
create table if not exists public.cm_votes (uid uuid not null, year int not null, choice text not null, country text not null, primary key (uid, year));
create table if not exists public.cm_elections (year int not null, country text not null, result jsonb not null, primary key (year, country));
create index if not exists cm_news_ts on public.cm_news (ts desc);
create index if not exists cm_news_country on public.cm_news (country, ts desc);
create index if not exists cm_posts_country on public.cm_posts (country, ts desc);
create index if not exists cm_offers_to on public.cm_offers (to_c, status);
create index if not exists cm_offers_from on public.cm_offers (from_c, status);
create index if not exists cm_transfers_ts on public.cm_transfers (ts desc);
create index if not exists cm_profiles_seen on public.cm_profiles (last_seen);
do $$ declare t text; begin
  foreach t in array array['cm_world','cm_countries','cm_profiles','cm_admins','cm_offers','cm_transfers','cm_news','cm_posts','cm_post_likes','cm_petitions','cm_petition_supports','cm_civic','cm_votes','cm_elections']
  loop execute format('alter table public.%I enable row level security', t); end loop;
end $$;

-- (migrasi lanjutan yang sudah diterapkan ke proyek)
alter table public.cm_countries add column if not exists slim jsonb, add column if not exists updated_at timestamptz not null default now();
create index if not exists cm_countries_upd on public.cm_countries (updated_at);
-- Real-time: trigger menyiarkan perubahan ke topik privat 'cm-world'
create or replace function public.cm_notify() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform realtime.send(jsonb_build_object('t', TG_TABLE_NAME), 'change', 'cm-world', false);
  return null;
exception when others then
  return null;
end $$;
revoke all on function public.cm_notify() from public, anon, authenticated;
do $$ declare t text; begin
  foreach t in array array['cm_countries','cm_world','cm_news','cm_posts','cm_offers','cm_petitions','cm_transfers','cm_elections']
  loop
    execute format('drop trigger if exists cm_notify_%1$s on public.%1$I', t);
    execute format('create trigger cm_notify_%1$s after insert or update or delete on public.%1$I for each statement execute function public.cm_notify()', t);
  end loop;
end $$;
create policy "cm_world_broadcast_read" on realtime.messages for select to authenticated using (realtime.topic() = 'cm-world' and extension = 'broadcast');
