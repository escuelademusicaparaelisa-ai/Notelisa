-- Notelisa: cuadernos guardados en la base de datos.
-- Los del admin son «de la escuela» y los ven todos los profesores; cada profesor tiene además los suyos.
-- Pegar entero en Supabase → SQL Editor → Run (después de 01, 02 y 03).

create table if not exists public.notebooks (
  id text primary key,
  owner_id uuid not null default auth.uid() references public.profiles on delete cascade,
  name text not null,
  piece_ids text[] not null default '{}',
  school boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ¿Es un profesor o el admin, ya aceptado?
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'teacher') and status = 'approved')
$$;

alter table public.notebooks enable row level security;

drop policy if exists "ver cuadernos" on public.notebooks;
create policy "ver cuadernos" on public.notebooks for select
  using (owner_id = auth.uid() or (school and public.is_staff()));
-- Solo el admin crea cuadernos de la escuela.
drop policy if exists "crear cuadernos" on public.notebooks;
create policy "crear cuadernos" on public.notebooks for insert
  with check (owner_id = auth.uid() and public.is_staff() and (not school or public.is_admin()));
drop policy if exists "cambiar cuadernos" on public.notebooks;
create policy "cambiar cuadernos" on public.notebooks for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and (not school or public.is_admin()));
drop policy if exists "borrar cuadernos" on public.notebooks;
create policy "borrar cuadernos" on public.notebooks for delete using (owner_id = auth.uid());

grant select, insert, update, delete on public.notebooks to authenticated;
