-- Notelisa: la llave de la biblioteca de la escuela, para que la vean todas las cuentas
-- aprobadas sin escribir ninguna clave.
-- Pegar entero en Supabase → SQL Editor → Run (después de 01). Se puede volver a ejecutar.
--
-- Las partituras de la escuela se publican cifradas en la web. Aquí se guarda la llave que
-- las abre: solo la pueden leer las cuentas aprobadas, y solo el admin la cambia. El admin
-- la guarda desde la app la primera vez que entra (le pide la clave una sola vez).

create table if not exists public.school_library (
  id smallint primary key default 1 check (id = 1),
  key text not null,
  updated_at timestamptz not null default now()
);

-- ¿La cuenta que hace la consulta está aceptada (alumno, profesor o admin)?
create or replace function public.is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'approved')
$$;

alter table public.school_library enable row level security;

drop policy if exists "ver la llave de la biblioteca" on public.school_library;
create policy "ver la llave de la biblioteca" on public.school_library for select using (public.is_approved());
drop policy if exists "el admin guarda la llave" on public.school_library;
create policy "el admin guarda la llave" on public.school_library for insert with check (public.is_admin());
drop policy if exists "el admin cambia la llave" on public.school_library;
create policy "el admin cambia la llave" on public.school_library for update using (public.is_admin()) with check (public.is_admin());

grant select, insert, update on public.school_library to authenticated;
