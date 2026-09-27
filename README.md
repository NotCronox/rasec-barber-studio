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
- CTA final hacia WhatsApp.

### Ubicacion

La barberia esta ubicada en el Centro Historico de Cartagena. La direccion se define en `business.address`, `business.neighborhood`, `business.city` y `business.mapQuery` dentro de `src/data.js`. Desde ahi se genera automaticamente:

- El mapa embebido de Google Maps (no requiere API key).
- El boton "Abrir en Google Maps" con la ubicacion exacta.

### Galeria por barbero

Cada barbero en `src/data.js` tiene un arreglo `gallery` con fotos de trabajos realizados. En la tarjeta del barbero aparece un boton "Ver galeria" que abre un modal con esas fotos.

## Fase 3 - Panel administrativo y reservas (demo local)

Se agrego un back office completo y un sistema de citas, pensado como demo local que luego
se puede conectar a un backend real sin rehacer la interfaz:

- **`admin.html`** - panel administrativo protegido con contrasena: permite editar todo el
  contenido publico (datos del negocio, portada, servicios, barberos con su galeria, horarios)
  y gestionar las reservas (ver, confirmar, cancelar, eliminar), con un resumen de estadisticas.
- **`reserva.html`** - asistente de reserva para clientes: elige servicio, barbero, dia (calendario)
  y hora, con los horarios ya ocupados bloqueados automaticamente para ese barbero. Al confirmar,
  la cita queda guardada; ya no se agenda por WhatsApp directo (ese canal queda solo como aviso
  opcional despues de confirmar, o para preguntas generales).
- Los botones "Reservar" del sitio publico llevan a `reserva.html` (con el servicio o barbero
  preseleccionado segun desde donde se haga clic) en vez de abrir WhatsApp.

### Arquitectura: por que localStorage y como migrar a un backend real

Por ahora todo (contenido del sitio + reservas) se guarda en el navegador con `localStorage`,
sin servidor. Esto fue una decision explicita para poder construir y probar el flujo completo
(panel + agenda + bloqueo de horarios) sin depender de infraestructura externa todavia.

Para que el dia de manana cambiar a un backend real (por ejemplo Supabase) sea barato, toda la
persistencia pasa por una sola capa:

- **`src/store.js`** - unico punto que lee/escribe datos. Expone funciones como
  `getState()`, `saveService()`, `saveBarber()`, `saveHours()`, `createBooking()`,
  `findConflict()`, etc. Ni `app.js`, ni `booking.js`, ni `admin.js` tocan `localStorage`
  directamente, solo llaman a `window.RasecStore`.
- **`src/auth.js`** - puerta de acceso del admin (`window.RasecAuth`). Hoy compara la
  contrasena contra un valor guardado en el navegador; no es seguridad real.

El dia que se conecte un backend, solo hay que reescribir `store.js` (para que sus funciones
hagan `fetch()` a una API en vez de leer `localStorage`) y `auth.js` (para usar autenticacion
real, por ejemplo Supabase Auth). El resto del codigo no deberia necesitar cambios porque nunca
habla con `localStorage` ni con contrasenas en texto plano directamente.

### Acceso al panel

```text
admin.html
Contrasena por defecto: rasec2025
```

La contrasena se puede cambiar llamando a `RasecAuth.changePassword(actual, nueva)` desde la
consola del navegador (todavia no hay una pantalla dedicada para esto). Como es una demo local,
cada navegador/dispositivo tiene sus propios datos: lo que se edita en el admin de una
computadora no se ve en el sitio publico abierto en otra, hasta que haya un backend compartido.

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
- Barberos y su galeria de trabajos
- Horarios
- Fotos
- Datos de contacto y ubicacion
- Mensajes de CTA
- Informacion del negocio

## Lo que todavia no se construyo

- Backend real / base de datos compartida entre dispositivos (hoy es localStorage por
  navegador, ver seccion de arquitectura arriba).
- Autenticacion real del admin (hoy es una contrasena de demo, no segura).
- Notificaciones automaticas al cliente o al negocio (email/SMS/WhatsApp) cuando cambia el
  estado de una reserva.
- Pagos o senas para confirmar una cita.

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
