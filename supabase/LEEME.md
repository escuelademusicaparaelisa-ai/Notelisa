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
   `04-cuadernos.sql`, `05-progreso.sql` y `06-biblioteca-escuela.sql`.
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

La biblioteca de la escuela ya no pide clave a los alumnos: cualquier cuenta aprobada la
ve. La primera vez que el admin entra después de ejecutar `06-biblioteca-escuela.sql`,
la app le pide **una sola vez** la clave con la que se publicó la biblioteca (si ese
dispositivo ya la tenía abierta, ni eso) y guarda la llave en el servidor. Si se publica
la biblioteca con una clave nueva, la app se lo vuelve a pedir al admin.

## Recuperar la contraseña

En la pantalla de entrada está **¿Has olvidado tu contraseña?**. La persona escribe su
email o su teléfono y le llega un correo con un enlace; al abrirlo, Notelisa le pide la
contraseña nueva y entra. Para que funcione hay que hacer esto una sola vez:

1. **Authentication → URL Configuration**: en *Site URL* pon
   `https://notelisa.paraelisa.es` y añádela también en *Redirect URLs* (y
   `http://localhost:5173/` si se prueba en local). Es la dirección a la que lleva el enlace.
2. **Correo de verdad (SMTP)**. El correo que trae Supabase de serie solo escribe a los
   miembros del equipo del proyecto y muy pocas veces por hora, así que los alumnos no lo
   recibirían. En **Project Settings → Authentication → SMTP Settings** activa *Custom
   SMTP* con un correo de la escuela (por ejemplo el de DonDominio: servidor, puerto 465,
   usuario y contraseña del buzón; remitente `Notelisa <notelisa@paraelisa.es>`).
3. **El correo en español** (opcional, recomendado). En **Authentication → Emails →
   Reset Password**, asunto `Notelisa: elige una contraseña nueva` y como mensaje:

   ```html
   <h2>Notelisa</h2>
   <p>Has pedido cambiar la contraseña de tu cuenta de Notelisa.</p>
   <p><a href="{{ .ConfirmationURL }}">Elegir una contraseña nueva</a></p>
   <p>Si no lo has pedido tú, no hagas nada: tu contraseña sigue igual.</p>
   ```

4. **Recuperar con el teléfono**. Con el email funciona sin más; para el teléfono hace
   falta la función `recuperar-contrasena`, que busca la cuenta con ese teléfono y escribe
   al email de esa cuenta. En **Edge Functions → Deploy a new function → Via Editor**,
   nómbrala `recuperar-contrasena`, pega el contenido de
   `functions/recuperar-contrasena/index.ts` y pulsa *Deploy*. Después, en los ajustes de
   la función, desactiva *Verify JWT* (la usan personas que aún no han entrado). Si varias
   cuentas comparten teléfono (hermanos con el móvil de su madre, por ejemplo), cada una
   recibe el enlace en su email.

La app nunca dice si un email o teléfono tiene cuenta, ni a qué email ha escrito, para que
nadie pueda averiguar datos de otra persona.
