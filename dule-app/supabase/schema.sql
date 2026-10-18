-- Dule.app — cloud database (Supabase)
-- Paste this whole file in Supabase → SQL Editor → New query → Run. Safe to run again.

-- ---------- tables ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  nome text not null,
  nome_chave text not null unique,
  is_admin boolean not null default false,
  criado_em timestamptz not null default now()
);

create table if not exists public.partos (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null,
  criado_em bigint not null,
  fase_manual text,
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  parto_id text not null,
  inicio bigint not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists events_parto_id_idx on public.events (parto_id);

create table if not exists public.settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- contraction running right now (so the admin sees it live)
create table if not exists public.estado (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  running bigint,
  updated_at timestamptz not null default now()
);

-- ---------- helpers ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- every new account gets a profile with its display name
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, nome_chave)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', new.email),
    lower(trim(coalesce(new.raw_user_meta_data->>'nome', new.email)))
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- permissions: each user sees only their own data; the admin reads everything ----------
alter table public.profiles enable row level security;
alter table public.partos   enable row level security;
alter table public.events   enable row level security;
alter table public.settings enable row level security;
alter table public.estado   enable row level security;

drop policy if exists "ver perfil" on public.profiles;
create policy "ver perfil" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

do $$
declare t text;
begin
  foreach t in array array['partos', 'events', 'settings', 'estado'] loop
    execute format('drop policy if exists "dono" on public.%I', t);
    execute format('create policy "dono" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('drop policy if exists "admin le" on public.%I', t);
    execute format('create policy "admin le" on public.%I for select to authenticated using (public.is_admin())', t);
  end loop;
end $$;

-- ---------- audio files (private bucket, one folder per user) ----------
insert into storage.buckets (id, name, public) values ('audio', 'audio', false)
  on conflict (id) do nothing;

drop policy if exists "audio dono escreve" on storage.objects;
create policy "audio dono escreve" on storage.objects for insert to authenticated
  with check (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "audio dono altera" on storage.objects;
create policy "audio dono altera" on storage.objects for update to authenticated
  using (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "audio dono apaga" on storage.objects;
create policy "audio dono apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "audio ler" on storage.objects;
create policy "audio ler" on storage.objects for select to authenticated
  using (bucket_id = 'audio' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ---------- realtime (live updates) ----------
do $$
declare t text;
begin
  foreach t in array array['profiles', 'partos', 'events', 'settings', 'estado'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------- STEP 2 (run separately, after logging in once as AdminDule in the app) ----------
-- update public.profiles set is_admin = true where nome_chave = 'admindule';

-- ---------- more admins (e.g. Amanda): she creates a normal account in the app first, then ----------
-- update public.profiles set is_admin = true where nome_chave = 'amanda';
