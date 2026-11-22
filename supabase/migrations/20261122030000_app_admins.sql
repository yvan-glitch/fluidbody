-- Liste unique des comptes admin (22.11.2026). Avant : une liste dans
-- App.js et un secret ADMIN_EMAILS côté edge function, à tenir identiques.
-- Pour ajouter un admin : insert into public.app_admins (email) values ('...');

create table if not exists public.app_admins (
  email text primary key,
  added_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;
-- Aucune policy : seuls le service role et la fonction ci-dessous lisent.

insert into public.app_admins (email) values
  ('admin@fluidbody.ch'),
  ('yvan@espace-pilates.ch'),
  ('sabrina@espace-pilates.ch'),
  ('sabrina.tissot@icloud.com'),
  ('yvan.tissot@icloud.com'),
  ('qcrm6vkbnx@privaterelay.appleid.com'),
  ('maelle.raemy@gmail.com')
on conflict (email) do nothing;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_admins
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
