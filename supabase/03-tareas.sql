-- Notelisa: canciones que cada profesor asigna a sus alumnos (de deberes o por gusto).
-- Pegar entero en Supabase → SQL Editor → Run (después de 01 y 02).

create table if not exists public.assignments (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles on delete cascade,
  teacher_id uuid references public.profiles on delete set null,
  -- La pieza de la biblioteca (su id) y su título, para mostrarlo aunque cambie la biblioteca.
  piece_id text not null,
  piece_title text not null default '',
  -- De dónde vino: «Cuaderno Navidad», «Nivel 2»… o vacío si se eligió suelta.
  source text not null default '',
  homework boolean not null default false,
  created_at timestamptz not null default now(),
  unique (student_id, piece_id)
);

alter table public.assignments enable row level security;

-- El alumno ve las suyas; sus profesores y el admin ven y cambian las de ese alumno.
drop policy if exists "ver tareas" on public.assignments;
create policy "ver tareas" on public.assignments for select
  using (student_id = auth.uid() or public.is_my_student(student_id) or public.is_admin());
drop policy if exists "asignar tareas" on public.assignments;
create policy "asignar tareas" on public.assignments for insert
  with check (public.is_my_student(student_id) or public.is_admin());
drop policy if exists "cambiar tareas" on public.assignments;
create policy "cambiar tareas" on public.assignments for update
  using (public.is_my_student(student_id) or public.is_admin())
  with check (public.is_my_student(student_id) or public.is_admin());
drop policy if exists "quitar tareas" on public.assignments;
create policy "quitar tareas" on public.assignments for delete
  using (public.is_my_student(student_id) or public.is_admin());

grant select, insert, update, delete on public.assignments to authenticated;
