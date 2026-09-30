-- ==========================================================================
-- Védőkör — adatbázis-séma (Supabase / PostgreSQL)
-- Futtatás: Supabase Dashboard → SQL Editor → illeszd be és futtasd (Run).
-- Többször is lefuttatható (idempotens).
--
-- Biztonsági modell (Row Level Security):
--   • tag   → csak a SAJÁT vállalatának tartalmát és dokumentumait látja
--   • admin → mindent lát és szerkeszt
--   • bárki → a publikált híreket olvashatja, és űrlapot küldhet be
-- Tagot létrehozni csak a szerveroldali /api/admin függvény tud (service role).
-- ==========================================================================

-- ---------- Táblák ----------

create table if not exists public.companies (
  id          text primary key check (id ~ '^[a-z0-9-]{2,60}$'),
  name        text not null,
  -- A tagi felület teljes tartalma (bérek, hírek, események, bizalmik, dokumentumok).
  -- Szerkezete megegyezik a data/companies/*.json fájlokéval.
  content     jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create table if not exists public.members (
  user_id               uuid primary key references auth.users (id) on delete cascade,
  code                  text not null unique check (code ~ '^[A-Z0-9-]{3,20}$'),
  name                  text not null,
  company_id            text references public.companies (id) on delete restrict,
  role                  text not null default 'member' check (role in ('member', 'admin')),
  must_change_password  boolean not null default true,
  created_at            timestamptz not null default now()
);
create index if not exists members_company_idx on public.members (company_id);

create table if not exists public.news (
  id          uuid primary key default gen_random_uuid(),
  date        date not null default current_date,
  category    text not null default 'kozosseg' check (category in ('berek', 'jog', 'kozosseg', 'munkavedelem')),
  title       jsonb not null,             -- { "hu": "...", "en": "..." }
  excerpt     jsonb not null default '{}'::jsonb,
  body        jsonb not null default '{}'::jsonb,
  art         smallint,
  published   boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists news_date_idx on public.news (date desc);

create table if not exists public.submissions (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('join', 'contact')),
  name        text not null check (char_length(name) between 1 and 200),
  email       text not null check (char_length(email) between 3 and 200),
  phone       text check (char_length(phone) <= 50),
  company     text check (char_length(company) <= 200),
  position    text check (char_length(position) <= 200),
  message     text check (char_length(message) <= 5000),
  handled     boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------- Segédfüggvények ----------

-- Az aktuális felhasználó admin-e? (security definer: az RLS-t megkerülve olvas, rekurzió nélkül)
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and role = 'admin');
$$;

-- Az aktuális tag vállalata
create or replace function public.my_company()
returns text language sql stable security definer set search_path = public as $$
  select company_id from public.members where user_id = auth.uid();
$$;

-- A tag csak a jelszócsere-jelzőjét állíthatja át (a saját sorában), semmi mást
create or replace function public.password_changed()
returns void language sql volatile security definer set search_path = public as $$
  update public.members set must_change_password = false where user_id = auth.uid();
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists companies_touch on public.companies;
create trigger companies_touch before update on public.companies
  for each row execute function public.touch_updated_at();

revoke all on function public.password_changed() from public, anon;
grant execute on function public.password_changed() to authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.my_company() to authenticated;

-- ---------- Row Level Security ----------

alter table public.companies   enable row level security;
alter table public.members     enable row level security;
alter table public.news        enable row level security;
alter table public.submissions enable row level security;

-- companies
drop policy if exists companies_read on public.companies;
create policy companies_read on public.companies for select to authenticated
  using (id = public.my_company() or public.is_admin());
drop policy if exists companies_admin_write on public.companies;
create policy companies_admin_write on public.companies for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- members (írni csak admin / service role tud)
drop policy if exists members_read on public.members;
create policy members_read on public.members for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists members_admin_write on public.members;
create policy members_admin_write on public.members for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- news
drop policy if exists news_public_read on public.news;
create policy news_public_read on public.news for select to anon, authenticated
  using (published or public.is_admin());
drop policy if exists news_admin_write on public.news;
create policy news_admin_write on public.news for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- submissions: bárki beküldhet (csak kezeletlen állapotban), olvasni/törölni csak admin
drop policy if exists submissions_insert on public.submissions;
create policy submissions_insert on public.submissions for insert to anon, authenticated
  with check (handled = false);
drop policy if exists submissions_admin on public.submissions;
create policy submissions_admin on public.submissions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Jogosultságok (az RLS mellett a táblaszintű GRANT is kell)
grant usage on schema public to anon, authenticated;
grant select on public.news to anon;
grant insert on public.submissions to anon;
grant select, insert, update, delete on public.companies, public.members, public.news, public.submissions to authenticated;

-- ---------- Dokumentumtár (Storage) ----------
-- Privát „documents” bucket; a fájlok útvonala: <vállalat-azonosító>/<fájlnév>
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 26214400)
on conflict (id) do update set public = false;

drop policy if exists documents_member_read on storage.objects;
create policy documents_member_read on storage.objects for select to authenticated
  using (bucket_id = 'documents' and ((storage.foldername(name))[1] = public.my_company() or public.is_admin()));
drop policy if exists documents_admin_insert on storage.objects;
create policy documents_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.is_admin());
drop policy if exists documents_admin_update on storage.objects;
create policy documents_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'documents' and public.is_admin());
drop policy if exists documents_admin_delete on storage.objects;
create policy documents_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.is_admin());
