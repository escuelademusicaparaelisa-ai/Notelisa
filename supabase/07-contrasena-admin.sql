-- Notelisa: el admin pone una contraseña nueva a un alumno o profesor.
-- Pegar entero en Supabase → SQL Editor → Run. Se puede volver a ejecutar sin problema.
--
-- Supabase guarda las contraseñas cifradas sin vuelta atrás (bcrypt): nadie, ni el
-- admin, puede ver la que hay. Lo que sí puede hacer el admin es poner una nueva.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.admin_set_password(target uuid, new_password text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede cambiar contraseñas' using errcode = '42501';
  end if;
  if coalesce(length(new_password), 0) < 6 then
    raise exception 'La contraseña necesita al menos 6 caracteres' using errcode = '22023';
  end if;
  update auth.users
    set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')), updated_at = now()
    where id = target;
  if not found then
    raise exception 'No existe esa cuenta' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_set_password(uuid, text) from public, anon;
grant execute on function public.admin_set_password(uuid, text) to authenticated;
