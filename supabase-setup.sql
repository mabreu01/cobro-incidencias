-- COBRO POR INCIDENCIAS - esquema inicial para Supabase
-- Ejecutar en Supabase > SQL Editor después de crear el proyecto.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'operator' check (role in ('admin','operator')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  ticket text not null,
  entry_time text not null,
  exit_time text not null,
  duration_minutes integer not null check (duration_minutes >= 0),
  amount_dop numeric(12,2) not null check (amount_dop >= 0),
  paid_at timestamptz not null default now(),
  operator_id uuid not null references public.profiles(id),
  closure_id uuid,
  receipt_number text,
  unique (ticket)
);

create table if not exists public.cash_closures (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.profiles(id),
  opened_at timestamptz not null default now(),
  closed_at timestamptz not null default now(),
  payment_count integer not null default 0,
  total_dop numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.payments
  add constraint payments_closure_id_fkey
  foreign key (closure_id) references public.cash_closures(id) on delete set null;

create index if not exists payments_paid_at_idx on public.payments(paid_at);
create index if not exists payments_operator_idx on public.payments(operator_id);
create index if not exists payments_closure_idx on public.payments(closure_id);
create index if not exists closures_closed_at_idx on public.cash_closures(closed_at);
create index if not exists closures_operator_idx on public.cash_closures(operator_id);

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and p.active = true
  );
$$;

alter table public.profiles enable row level security;
alter table public.payments enable row level security;
alter table public.cash_closures enable row level security;

revoke all on public.profiles from anon, authenticated;
revoke all on public.payments from anon, authenticated;
revoke all on public.cash_closures from anon, authenticated;

grant select on public.profiles to authenticated;
grant insert, update on public.profiles to authenticated;
grant select, insert on public.payments to authenticated;
grant update on public.payments to authenticated;
grant select, insert on public.cash_closures to authenticated;

drop policy if exists "profile self or admin read" on public.profiles;
create policy "profile self or admin read" on public.profiles
for select to authenticated
using (id = (select auth.uid()) or public.current_user_is_admin());

drop policy if exists "admin manage profiles" on public.profiles;
create policy "admin manage profiles" on public.profiles
for all to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "operators read own payments admins read all" on public.payments;
create policy "operators read own payments admins read all" on public.payments
for select to authenticated
using (operator_id = (select auth.uid()) or public.current_user_is_admin());

drop policy if exists "active operators insert own payments" on public.payments;
create policy "active operators insert own payments" on public.payments
for insert to authenticated
with check (
  operator_id = (select auth.uid())
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active = true)
);

drop policy if exists "admins update payments" on public.payments;
create policy "admins update payments" on public.payments
for update to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "operators read own closures admins read all" on public.cash_closures;
create policy "operators read own closures admins read all" on public.cash_closures
for select to authenticated
using (operator_id = (select auth.uid()) or public.current_user_is_admin());

drop policy if exists "active operators create own closures" on public.cash_closures;
create policy "active operators create own closures" on public.cash_closures
for insert to authenticated
with check (
  operator_id = (select auth.uid())
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active = true)
);

-- IMPORTANTE: tras crear el primer usuario desde Authentication > Users,
-- asígnele el rol admin usando el SQL de abajo, sustituyendo el correo:
-- insert into public.profiles (id, display_name, role, active)
-- select id, 'Administradora', 'admin', true
-- from auth.users where email = 'TU_CORREO@EJEMPLO.COM'
-- on conflict (id) do update set role = 'admin', active = true;
