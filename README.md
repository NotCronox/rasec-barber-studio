# Rasec Dev - Proyecto #02: Barberia

Primera etapa del proyecto: base publica profesional y reutilizable para una barberia.

## Fase 1 - Concepto, identidad y estructura

- Identidad inicial para una barberia de muestra: nombre, promesa, tono visual y datos del negocio.
- Estructura escalable con contenido separado en `src/data.js`.
- Base de pagina publica en `index.html`.
- Estilos globales y responsive en `src/styles.css`.
- Comportamiento liviano en `src/app.js`.
- Imagenes profesionales libres desde Pexels, centralizadas en `src/data.js`.

## Fase 2 - Pagina publica

Se construyo la pagina publica con:

- Inicio con hero visual y CTA.
- Datos destacados de la barberia.
- Seccion de servicios con precio, duracion, tags, imagen y disponibilidad.
- Seccion de barberos con foto, especialidad, bio, disponibilidad y galeria de trabajos realizados.
- Informacion de contacto junto a un mapa de ubicacion embebido.
- Horarios.
- CTA final hacia la agenda de citas (en la Fase 2 original iba a WhatsApp).

### Ubicacion

La barberia esta ubicada en el Centro Historico de Cartagena. La direccion se define en `business.address`, `business.neighborhood`, `business.city` y `business.mapQuery` dentro de `src/data.js`. Desde ahi se genera automaticamente:

- El mapa embebido de Google Maps (no requiere API key).
- El boton "Abrir en Google Maps" con la ubicacion exacta.

### Galeria por barbero

Cada barbero en `src/data.js` tiene un arreglo `gallery` con fotos de trabajos realizados. En la tarjeta del barbero aparece un boton "Ver galeria" que abre un modal con esas fotos.

## Fase 3 - Panel administrativo y reservas (demo local)

Se agrego un back office completo y un sistema de citas, pensado como demo local que luego
se puede conectar a un backend real sin rehacer la interfaz.

### Para el cliente

- **`reserva.html`** - asistente de reserva: servicio, barbero, dia (calendario) y hora.
  - Solo aparecen los barberos que hacen el servicio elegido.
  - El calendario bloquea dias pasados, dias cerrados, dias de descanso o ausencia del barbero,
    dias sin horarios libres y fechas mas alla de la ventana de reserva (30 dias por defecto).
  - Los horarios ya ocupados se bloquean, teniendo en cuenta la duracion de cada servicio, y se
    actualizan en vivo si alguien reserva desde otra pestana.
  - Si el horario se ocupa justo mientras el cliente confirma, se le avisa y puede elegir otro.
  - Al confirmar recibe un **codigo de reserva** (por ejemplo `K7Q2MX`). WhatsApp queda solo como
    aviso opcional despues de reservar, o para preguntas generales.
- **`mi-cita.html`** - con el codigo y el telefono, el cliente consulta el estado de su cita y
  puede cancelarla (si todavia no ha pasado). El horario queda libre al instante.
- Los botones "Reservar" del sitio publico llevan a `reserva.html` con el servicio o barbero
  preseleccionado. Los servicios o barberos pausados no muestran boton de reserva.

### Para la barberia (`admin.html`)

- **Resumen**: citas de hoy, proximos 7 dias, pendientes por confirmar y proximas citas.
- **Agenda**: vista del dia con una columna por barbero, franja semanal con el numero de citas
  por dia y linea de la hora actual. Clic en un espacio libre para crear una cita a mano (clientes
  sin cita o que llaman por telefono), o en una cita para ver su detalle.
- **Detalle de cita**: cambiar el estado (pendiente / confirmada / cancelada), escribirle al cliente
  por WhatsApp con un mensaje ya redactado segun el estado, o eliminarla.
- **Reservas**: tabla con filtros por barbero, estado, fecha y buscador por nombre, telefono o codigo.
- **Servicios** y **Barberos**: crear, editar, pausar y eliminar. Cada barbero define que
  servicios realiza, sus dias de descanso semanales y sus ausencias o vacaciones por fechas.
- **Horarios**: horario semanal y hasta cuantos dias adelante se puede reservar.
- **Sitio y negocio**: todo el contenido publico (datos, foto de portada, textos, datos destacados).
- **Cuenta**: cambio de contrasena.
- **Fotos**: en servicios, barberos, galerias y portada se puede pegar una URL o subir una foto
  desde el equipo. La foto se reduce a 1000 px y se comprime antes de guardarse.
- **Protecciones**: antes de eliminar un servicio o barbero con citas futuras, cerrar un dia con
  citas o marcar un descanso que choca con citas existentes, el panel avisa cuantas citas quedan
  afectadas. Tambien valida que la apertura sea antes del cierre y que las ausencias tengan fechas
  validas.

### Arquitectura: por que localStorage y como migrar a un backend real

Por ahora todo (contenido del sitio + reservas) se guarda en el navegador con `localStorage`,
sin servidor. Esto fue una decision explicita para poder construir y probar el flujo completo
(panel + agenda + bloqueo de horarios) sin depender de infraestructura externa todavia.

Para que el dia de manana cambiar a un backend real (por ejemplo Supabase) sea barato, toda la
persistencia pasa por una sola capa:

- **`src/store.js`** - unico punto que lee/escribe datos. Expone funciones como
  `getState()`, `saveService()`, `saveBarber()`, `saveHours()`, `getSlots()`,
  `createBooking()`, `cancelBookingByCustomer()`, etc. Ninguna pagina toca `localStorage`
  directamente, solo llaman a `window.RasecStore`.
- Las **reglas de negocio** tambien viven en `store.js`: disponibilidad por barbero, ventana de
  reserva, choques de horario, validaciones y codigos de reserva. Son las mismas reglas que
  tendria que aplicar un backend, asi que al migrar se trasladan tal cual.
- **Varias pestanas a la vez**: cada cambio parte de lo guardado en ese instante (no de una copia
  vieja en memoria), asi una pestana abierta hace rato nunca borra cambios hechos en otra. Las
  paginas abiertas se actualizan solas cuando otra pestana guarda algo.
- **`src/auth.js`** - puerta de acceso del admin (`window.RasecAuth`). Hoy compara la
  contrasena contra un valor guardado en el navegador; no es seguridad real.

El dia que se conecte un backend, solo hay que reescribir `store.js` (para que sus funciones
hagan `fetch()` a una API en vez de leer `localStorage`) y `auth.js` (para usar autenticacion
real, por ejemplo Supabase Auth, como ya se hizo en Brasa Marina). El resto del codigo no deberia
necesitar cambios.

### Acceso al panel

```text
admin.html
Contrasena por defecto: rasec2025
```

La contrasena se cambia desde la pestana **Cuenta** del panel. Como es una demo local, cada
navegador o dispositivo tiene sus propios datos: lo que se edita en el admin de una computadora
no se ve en el sitio publico abierto en otra, hasta que haya un backend compartido.

### Limite de espacio

`localStorage` guarda unos 5 MB por sitio. Las fotos subidas desde el equipo ocupan espacio ahi
(unos 50 a 150 KB cada una despues de comprimirlas); las que se ponen como URL casi no ocupan.
El panel muestra el espacio usado en la pestana Resumen y avisa con un mensaje claro si ya no hay
espacio, sin guardar cambios a medias.

### Datos de ejemplo

Si algo se daña probando el panel, el boton "Restaurar datos de ejemplo" (pestana Resumen del
admin) borra las reservas y cambios, y vuelve a los datos originales de `src/data.js`.

## Como cambiar el contenido

Hay dos formas de editar el contenido:

- **Desde el navegador**: entrando a `admin.html` con la contrasena y usando los formularios
  (recomendado para probar el flujo real).
- **Editando el codigo**: los valores por defecto (los que se usan la primera vez que alguien
  abre el sitio, antes de que el admin cambie algo) viven en `src/data.js`:

```text
src/data.js
```

Desde ahi se pueden cambiar sin tocar la logica:

- Servicios y precios
- Barberos: galeria, servicios que realizan (`serviceIds`), descansos (`daysOff`) y ausencias (`timeOff`)
- Horarios y ventana de reserva (`settings.bookingWindowDays`)
- Fotos
- Datos de contacto y ubicacion
- Mensajes de CTA
- Informacion del negocio

Si alguien ya tenia datos guardados de una version anterior de la demo, `store.js` completa
automaticamente los campos nuevos al cargar.

## Paginas

| Pagina | Para quien | Que hace |
| --- | --- | --- |
| `index.html` | Clientes | Sitio publico |
| `reserva.html` | Clientes | Agendar una cita |
| `mi-cita.html` | Clientes | Consultar o cancelar una cita con su codigo |
| `admin.html` | Barberia | Panel administrativo |

## Lo que todavia no se construyo

- Backend real / base de datos compartida entre dispositivos (hoy es localStorage por
  navegador, ver seccion de arquitectura arriba).
- Autenticacion real del admin (hoy es una contrasena de demo, no segura).
- Notificaciones automaticas al cliente o al negocio (email/SMS/WhatsApp) cuando cambia el
  estado de una reserva. Hoy el admin le escribe al cliente con un clic desde el detalle de la cita.
- Pagos o senas para confirmar una cita.
- Descansos parciales dentro del dia (por ejemplo, almuerzo de un barbero): hoy los descansos
  y ausencias son de dias completos; un bloqueo corto se puede simular creando una cita manual.

Eso queda para cuando este proyecto se conecte a un backend real.

## Imagenes

Las imagenes usadas en esta etapa vienen de Pexels y estan referenciadas desde `src/data.js`. La licencia de Pexels permite usarlas gratis en proyectos personales y comerciales, sin atribucion obligatoria.

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
