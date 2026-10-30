# Cuentas de Notelisa (Supabase)

Notelisa guarda las cuentas (administrador, profesores y alumnos) en un proyecto de
[Supabase](https://supabase.com). Mientras la app no tenga los datos de conexión,
funciona como siempre, sin cuentas.

## Puesta en marcha (una sola vez)

1. Crea una cuenta en supabase.com y un proyecto `notelisa` en Europa.
2. **Authentication → Sign In / Providers → Email**: desactiva *Confirm email*. La
   escuela ya revisa cada solicitud, así nadie tiene que esperar a un correo.
3. **SQL Editor**: pega el contenido de `01-cuentas.sql` y pulsa *Run*. Después haz lo
   mismo con `02-alumnos-de-cada-profesor.sql`, `03-tareas.sql`,
   `04-cuadernos.sql` y `05-progreso.sql`.
4. Copia *Project URL* y la clave *anon public* (*Project Settings → API*) en el
   archivo `.env.production` de la raíz del repositorio:

   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

   Son públicas: las reglas de la base de datos deciden qué ve cada cuenta. La clave
   *service_role* no va nunca en la app.
5. Abre Notelisa, pulsa **Pedir acceso** y regístrate con el email del administrador.
6. En el SQL Editor, convierte esa cuenta en administrador (cambia el email):

   ```sql
   update public.profiles set role = 'admin', status = 'approved' where email = 'admin@ejemplo.es';
   ```

Desde entonces, el botón **Administración** de la biblioteca abre el panel del admin. En
**Solicitudes** están las peticiones de acceso para aceptarlas (como alumno o profesor) o rechazarlas, y **Crear cuenta** para dar
de alta directamente a un alumno o profesor (entra al momento si *Confirm email* está
desactivado). En **Alumnos** y **Profesores** se asigna a cada alumno su profesor (o
varios) y se puede quitar el acceso a una cuenta.

Para probar en local, pon las mismas dos líneas en `.env.local`.

Los profesores tienen el botón **Mis alumnos** (el admin, **Tareas**) para asignar a cada
alumno canciones sueltas, cuadernos enteros o niveles enteros, de deberes o por gusto.

Los cuadernos de profesores y admin se guardan en el servidor. Los del admin son «de la
escuela»: todos los profesores los ven y los pueden asignar, pero solo el admin los cambia.
Los cuadernos que hubiera en el dispositivo se suben solos la primera vez que se entra.
