-- Notelisa: lo que estudia cada alumno (tiempo y acierto).
-- Pegar entero en Supabase → SQL Editor → Run (después de 01 a 04).

create table if not exists public.practice_log (
  id bigint generated always as identity primary key,
  student_id uuid not null default auth.uid() references public.profiles on delete cascade,
  -- La pieza o el ejercicio practicado.
  piece_id text not null,
  piece_title text not null default '',
  kind text not null default 'piece' check (kind in ('piece', 'exercise')),
  seconds integer not null default 0 check (seconds >= 0),
  -- Veces que terminó la pieza y el mejor resultado (0-100), si llegó a terminarla.
  attempts integer not null default 0,
  best_accuracy integer check (best_accuracy between 0 and 100),
  best_rhythm integer check (best_rhythm between 0 and 100),
  created_at timestamptz not null default now()
);
create index if not exists practice_log_student on public.practice_log (student_id, created_at desc);

alter table public.practice_log enable row level security;

-- Cada alumno apunta lo suyo; él, sus profesores y el admin lo ven.
drop policy if exists "apuntar estudio" on public.practice_log;
create policy "apuntar estudio" on public.practice_log for insert with check (student_id = auth.uid());
drop policy if exists "ver estudio" on public.practice_log;
create policy "ver estudio" on public.practice_log for select
  using (student_id = auth.uid() or public.is_my_student(student_id) or public.is_admin());

grant select, insert on public.practice_log to authenticated;
