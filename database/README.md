# Base de datos (Supabase)

Esta carpeta convierte Rasec Barber Studio en un sistema real: los datos del sitio y las
citas viven en una base de datos compartida, asi que lo que el admin cambia y lo que los
clientes reservan se ve igual desde cualquier dispositivo.

## Archivos

- `schema.sql`: tablas, reglas de seguridad (RLS), funciones del servidor, fotos (Storage)
  y actualizaciones en vivo (Realtime).
- `seed.sql`: servicios, barberos, horarios y textos iniciales (generado desde `src/data.js`).

Ambos se pueden volver a ejecutar sin duplicar ni borrar datos.

## Puesta en marcha

1. Crea un proyecto en [supabase.com](https://supabase.com) (region recomendada: *South America (Sao Paulo)*).
2. En **SQL Editor**, pega todo `schema.sql` y ejecutalo. Despues haz lo mismo con `seed.sql`.
3. En **Authentication > Users > Add user > Create new user**, crea el usuario administrador
   con tu correo y una contrasena, y marca **Auto Confirm User**.
4. En **SQL Editor**, dale permisos de administrador (cambia el correo por el tuyo):

   ```sql
   insert into public.admin_profiles (user_id, email)
   select id, email from auth.users where email = 'tu-correo@ejemplo.com'
   on conflict (user_id) do nothing;
   ```

5. Recomendado: en **Authentication > Sign In / Providers > Email**, desactiva
   *Allow new users to sign up*. Aunque alguien se registrara, no tendria acceso a nada
   (solo las cuentas en `admin_profiles` son administradoras), pero asi evitas cuentas basura.
6. En **Project Settings > API** copia la *Project URL* y la *anon public key* en
   `src/supabase-config.js`.

Desde ese momento el sitio usa la base de datos. Mientras `supabase-config.js` este vacio,
funciona en modo local (localStorage) para desarrollo.

## Seguridad

- La *anon key* es publica por diseno (va en el navegador). Lo que protege los datos son las
  politicas RLS y las funciones de este esquema.
- Los visitantes pueden **leer** el contenido del sitio (servicios, barberos, horarios, textos),
  pero no editarlo.
- Los visitantes **no pueden leer la tabla de citas**. Para reservar y consultar usan funciones
  del servidor:
  - `get_busy_slots(desde, hasta)`: solo horarios ocupados, sin nombres ni telefonos.
  - `create_booking(...)`: valida en el servidor que el servicio y el barbero esten activos, que
    el barbero haga ese servicio, el horario del dia, los descansos y ausencias, la ventana de
    reserva y que la hora no haya pasado. El precio y la duracion se toman de la base de datos,
    nunca de lo que envia el navegador.
  - `find_booking(codigo, telefono)` y `cancel_booking(codigo, telefono)`: el cliente solo ve o
    cancela su cita si conoce el codigo **y** el telefono con el que reservo.
- **Nunca hay dos citas cruzadas**: la restriccion `bookings_no_overlap` (exclusion con
  `btree_gist`) impide a nivel de base de datos que un barbero tenga dos citas activas que se
  solapen, incluso si dos personas confirman en el mismo segundo.
- Las contrasenas las maneja Supabase Auth; el proyecto no guarda contrasenas en sus tablas.
- Solo los administradores pueden subir o borrar fotos del bucket `media`.

## Modelo

| Tabla | Contenido |
| --- | --- |
| `site_content` | Una fila con los textos del sitio (negocio, portada, identidad, nota, CTA) y la configuracion (`bookingWindowDays`). |
| `services` | Servicios con precio, duracion, foto, tags y disponibilidad. |
| `barbers` | Barberos con foto, galeria, servicios que realizan (`service_ids`), descansos semanales (`days_off`) y ausencias por fechas (`time_off`). |
| `hours` | Horario de cada dia de la semana. |
| `bookings` | Citas. Guardan una copia del nombre del servicio, el barbero y el precio al momento de reservar. |
| `admin_profiles` | Usuarios de Supabase Auth con permisos de administrador. |

Las horas y fechas se interpretan en hora de Colombia (`America/Bogota`).

## Plan gratuito de Supabase

Los proyectos gratuitos se pausan despues de una semana sin actividad. Si el sitio muestra
"No pudimos cargar...", entra al panel de Supabase y reactiva el proyecto (**Restore project**).
