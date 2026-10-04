# Rasec Barber Studio

Plataforma web para barberia con agenda de citas en linea y panel administrativo, desarrollada
para el portafolio de Rasec Dev.

**Sitio en vivo:** https://rasecbarberstudio-rasecdev.pages.dev

**Demo con panel libre:** https://rasecbarberstudio-demo.pages.dev (el panel esta en `/admin` y la
contrasena ya viene escrita). Es el mismo repositorio: cuando la direccion termina en
`-demo.pages.dev`, `src/supabase-config.js` deja a Supabase de lado y cada visitante prueba con
datos de ejemplo guardados en su navegador.

Rasec Barber Studio es una barberia ficticia ubicada en el Centro Historico de Cartagena. El
proyecto demuestra un producto completo: sitio publico, reservas en linea con disponibilidad en
tiempo real, gestion de la cita por parte del cliente y un back office para operar el negocio.

## Tecnologias

- HTML, CSS y JavaScript, sin frameworks ni paso de build.
- **Supabase**: base de datos Postgres, autenticacion del admin, almacenamiento de fotos y
  actualizaciones en vivo (Realtime).
- **Cloudflare Pages**: hosting del sitio.
- Modo local con `localStorage` para desarrollar sin conexion.

## Paginas

| Pagina | Para quien | Que hace |
| --- | --- | --- |
| `index.html` | Clientes | Sitio publico: servicios, barberos con galeria, ubicacion y horarios |
| `reserva.html` | Clientes | Agendar una cita |
| `mi-cita.html` | Clientes | Consultar o cancelar una cita con su codigo |
| `admin.html` | Barberia | Panel administrativo |

## Funcionalidades

### Cliente

- Asistente de reserva en 5 pasos: servicio, barbero, dia (calendario), hora y datos.
  - Solo aparecen los barberos que hacen el servicio elegido.
  - El calendario bloquea dias pasados, dias cerrados, dias de descanso o ausencia del barbero,
    dias sin horarios libres y fechas mas alla de la ventana de reserva (30 dias por defecto).
  - Los horarios ocupados se bloquean teniendo en cuenta la duracion de cada servicio, y se
    actualizan mientras el cliente tiene el calendario abierto.
  - Si el horario se ocupa justo mientras el cliente confirma, se le avisa y puede elegir otro.
- Al reservar recibe un **codigo de reserva** (por ejemplo `K7Q2MX`). Con el codigo y su telefono
  puede consultar el estado de la cita o cancelarla en `mi-cita.html`.
- Los botones "Reservar" del sitio llevan a la agenda con el servicio o barbero ya elegido.
  WhatsApp queda como aviso opcional despues de reservar o para preguntas generales.

### Barberia (`admin.html`)

- **Resumen**: citas de hoy, proximos 7 dias, pendientes por confirmar y proximas citas.
- **Agenda**: vista del dia con una columna por barbero, franja semanal con el numero de citas y
  linea de la hora actual. Las reservas nuevas de los clientes aparecen solas. Clic en un espacio
  libre para crear una cita a mano (clientes sin cita o que llaman), o en una cita para ver su detalle.
- **Detalle de cita**: cambiar el estado (pendiente / confirmada / cancelada), escribirle al cliente
  por WhatsApp con un mensaje ya redactado segun el estado, o eliminarla.
- **Reservas**: tabla con filtros por barbero, estado y fecha, y buscador por nombre, telefono o codigo.
- **Servicios** y **Barberos**: crear, editar, pausar y eliminar. Cada barbero define que servicios
  realiza, sus dias de descanso semanales y sus ausencias o vacaciones por fechas.
- **Horarios**: horario semanal y hasta cuantos dias adelante se puede reservar.
- **Sitio y negocio**: todo el contenido publico (datos, foto de portada, textos, datos destacados).
- **Cuenta**: cambio de contrasena.
- **Fotos**: se puede pegar una URL o subir una foto desde el equipo; se reduce a 1000 px, se
  comprime y se guarda en Supabase Storage.
- **Protecciones**: antes de eliminar un servicio o barbero con citas futuras, cerrar un dia con
  citas o marcar un descanso que choca con citas existentes, el panel avisa cuantas citas quedan
  afectadas.

## Arquitectura

```text
index.html / reserva.html / mi-cita.html / admin.html
        |
   src/store.js  (window.RasecStore: unico punto de acceso a los datos)
        |
   +----+-------------------------+
   |                              |
src/store-remote.js          src/store-local.js
Supabase (produccion)        localStorage (desarrollo sin conexion)
```

- `src/store.js` elige el proveedor: Supabase si `src/supabase-config.js` tiene credenciales,
  localStorage si no. Las paginas no saben cual se esta usando.
- `src/rules.js` contiene las reglas de negocio (disponibilidad, choques, validaciones). El
  navegador las usa para pintar el calendario al instante, y **el servidor las vuelve a validar**
  en `database/schema.sql`, asi que no se pueden saltar desde el navegador.
- `src/auth.js`: con Supabase, inicio de sesion real (correo + contrasena de Supabase Auth) y
  verificacion de que la cuenta sea administradora.
- Los clientes nunca leen la tabla de citas: solo reciben horarios ocupados sin datos personales.
- La base de datos impide fisicamente que un barbero tenga dos citas que se crucen, incluso si dos
  personas confirman al mismo tiempo.

Detalles de seguridad y del modelo de datos en [`database/README.md`](database/README.md).

## Puesta en marcha

### 1. Base de datos

Sigue [`database/README.md`](database/README.md): crear el proyecto de Supabase, ejecutar
`schema.sql` y `seed.sql`, crear el usuario administrador y poner la URL y la *anon key* en
`src/supabase-config.js`.

### 2. Hosting en Cloudflare Pages

1. En Cloudflare: **Workers & Pages > Create application > Pages > Import an existing Git
   repository** y elige este repositorio.
2. Deja vacios el comando de build y la carpeta de salida: se publica la carpeta tal cual (no hay
   paso de build). Los encabezados de seguridad y de cache estan en `_headers`.
3. Cada push a `master` publica una nueva version automaticamente.

### 3. Desarrollo local

El proyecto se sirve como archivos estaticos. Con cualquier servidor local:

```bash
npx serve .
```

Si `src/supabase-config.js` tiene credenciales, el sitio local usa la base de datos real. Si esta
vacio, usa `localStorage` y el panel entra con la contrasena `rasec2025`.

## Como cambiar el contenido

- **Desde el panel** (`admin.html`): servicios, precios, barberos, horarios, fotos y textos.
- **Datos iniciales**: `src/data.js` define el contenido de ejemplo. Si lo cambias, regenera
  `database/seed.sql` para que la base de datos arranque con los mismos datos.

## Pendiente para una version comercial

- Notificaciones automaticas al cliente (email/SMS/WhatsApp) cuando cambia el estado de una cita.
  Hoy el admin le escribe con un clic desde el detalle de la cita.
- Pagos o senas para confirmar una cita.
- Descansos parciales dentro del dia (por ejemplo, el almuerzo de un barbero). Hoy los descansos y
  ausencias son de dias completos; un bloqueo corto se puede hacer con una cita manual.
- Recordatorios automaticos el dia anterior a la cita.

## Imagenes

Las imagenes vienen de Pexels y estan referenciadas desde `src/data.js`. La licencia de Pexels
permite usarlas gratis en proyectos personales y comerciales, sin atribucion obligatoria.

Creditos:

- MaGicA Production: https://www.pexels.com/photo/vintage-style-barber-chair-in-modern-barbershop-30547746/
- Lewis Staff: https://www.pexels.com/photo/man-sitting-in-barbershop-chair-15194776/
- cottonbro studio: https://www.pexels.com/photo/man-getting-a-beard-cut-3998413/
- mk photos: https://www.pexels.com/photo/young-man-getting-a-haircut-in-barbershop-35157693/
- mk photos: https://www.pexels.com/photo/barbershop-haircut-for-black-male-client-35157692/
- EJ Agumbay: https://www.pexels.com/photo/a-barber-with-tattoos-8552627/
- Jimmy Maffio: https://www.pexels.com/photo/a-barber-wearing-apron-standing-a-mirror-while-looking-at-the-camera-12946033/
- Marcelo Verfe: https://www.pexels.com/photo/portrait-of-a-happy-barber-18483772/
- Hamidoff Studio: https://www.pexels.com/photo/a-person-using-clippers-18503633/
- mths: https://www.pexels.com/photo/mans-close-crop-hairstyle-6487911/
- Brian Silva: https://www.pexels.com/photo/professional-haircut-in-modern-barber-shop-39559261/
- Brian Silva: https://www.pexels.com/photo/close-up-portrait-of-man-with-stylish-haircut-39559325/
- Gromakova: https://www.pexels.com/photo/a-man-getting-a-moustache-grooming-9153970/
- cottonbro studio: https://www.pexels.com/photo/man-in-white-and-gray-stripe-shirt-3998427/
- mk7 Bober: https://www.pexels.com/photo/grayscale-photo-of-woman-shaving-a-full-bearded-man-9341770/
- Alexandre Saraiva Carniato: https://www.pexels.com/photo/hands-of-a-person-trimming-a-man-s-beard-5853394/
- bulat843: https://www.pexels.com/photo/professional-haircut-at-modern-barbershop-32329615/
- Maksgelatin: https://www.pexels.com/photo/a-man-having-a-haircut-4422102/
- S Minh: https://www.pexels.com/photo/hairdresser-doing-a-haircut-11262382/
- Sephina Cornwall: https://www.pexels.com/photo/black-and-white-close-up-barbershop-haircut-32351040/

Licencia: https://www.pexels.com/license/

## Nota de portafolio

Este proyecto no representa un cliente real. Es una pieza conceptual desarrollada para mostrar
capacidades de diseno y desarrollo web de Rasec Dev.
