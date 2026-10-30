-- Notelisa: cuentas de administrador, profesores y alumnos.
-- Pegar entero en Supabase → SQL Editor → Run. Se puede volver a ejecutar sin problema.

-- Una ficha por cuenta. Quien se registra queda «pendiente» hasta que el admin la acepta.
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  nombre text not null default '',
  apellidos text not null default '',
  telefono text not null default '',
  role text not null default 'student' check (role in ('admin', 'teacher', 'student')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

-- Al crear una cuenta (registro o admin), se crea su ficha con los datos del formulario.
-- Nadie puede pedir ser admin desde el registro.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, nombre, apellidos, telefono, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'nombre', ''),
    coalesce(new.raw_user_meta_data ->> 'apellidos', ''),
    coalesce(new.raw_user_meta_data ->> 'telefono', ''),
    case when new.raw_user_meta_data ->> 'role' = 'teacher' then 'teacher' else 'student' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ¿La cuenta que hace la consulta es un admin aceptado?
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and status = 'approved')
$$;

alter table public.profiles enable row level security;

-- Cada uno ve su ficha; el admin ve y cambia todas.
drop policy if exists "ver la propia ficha" on public.profiles;
create policy "ver la propia ficha" on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists "el admin cambia fichas" on public.profiles;
create policy "el admin cambia fichas" on public.profiles for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "el admin borra fichas" on public.profiles;
create policy "el admin borra fichas" on public.profiles for delete using (public.is_admin());
