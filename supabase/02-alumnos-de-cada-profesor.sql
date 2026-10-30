-- Notelisa: qué alumnos tiene cada profesor. Lo decide el admin.
-- Pegar entero en Supabase → SQL Editor → Run (después de 01-cuentas.sql).

create table if not exists public.teacher_students (
  teacher_id uuid not null references public.profiles on delete cascade,
  student_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (teacher_id, student_id)
);

-- ¿El alumno es de la cuenta que hace la consulta?
create or replace function public.is_my_student(student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.teacher_students where teacher_id = auth.uid() and student_id = student)
$$;

alter table public.teacher_students enable row level security;

-- El admin lo gestiona todo; cada profesor y cada alumno ven sus propias parejas.
drop policy if exists "ver las propias parejas" on public.teacher_students;
create policy "ver las propias parejas" on public.teacher_students for select
  using (teacher_id = auth.uid() or student_id = auth.uid() or public.is_admin());
drop policy if exists "el admin asigna" on public.teacher_students;
create policy "el admin asigna" on public.teacher_students for insert with check (public.is_admin());
drop policy if exists "el admin desasigna" on public.teacher_students;
create policy "el admin desasigna" on public.teacher_students for delete using (public.is_admin());

-- El profesor ve la ficha de sus alumnos.
drop policy if exists "el profesor ve a sus alumnos" on public.profiles;
create policy "el profesor ve a sus alumnos" on public.profiles for select using (public.is_my_student(id));

-- Permisos de la app (las reglas de arriba deciden qué filas ve cada cuenta).
-- Hacen falta si el proyecto se creó sin «Automatically expose new tables».
grant select, update, delete on public.profiles to authenticated;
grant select, insert, delete on public.teacher_students to authenticated;
