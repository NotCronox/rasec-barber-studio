-- ============================================================================
-- Rasec Barber Studio - datos iniciales (generado desde src/data.js)
-- Ejecutar despues de schema.sql. No sobrescribe datos existentes: si una fila
-- ya existe (por ejemplo, porque el admin la edito), se deja como esta.
-- ============================================================================

insert into public.site_content (id, business, identity, media, hero, notes, cta, settings)
values (
  1,
  $seed${"name":"Rasec Barber Studio","shortName":"Rasec","initials":"RB","subtitle":"Barberia premium","description":"Una barberia urbana para cortes precisos, barba cuidada y una experiencia sin afan.","address":"Calle del Arsenal #8-13","neighborhood":"Centro Historico","city":"Cartagena","mapQuery":"Centro Historico, Cartagena, Colombia","phone":"+57 300 123 4567","whatsapp":"573001234567","email":"hola@rasecbarber.com","instagram":"@rasecbarber"}$seed$::jsonb,
  $seed${"concept":"Un espacio para llegar, bajar el ritmo y salir con un corte que se sienta natural en tu dia a dia.","promise":["Cortes limpios","Barba detallada","Atencion puntual","Estilo personalizado"],"highlights":[{"value":"4.9","label":"Calificacion"},{"value":"35 min","label":"Promedio por cita"},{"value":"6 dias","label":"Atencion semanal"}]}$seed$::jsonb,
  $seed${"hero":"https://images.pexels.com/photos/30547746/pexels-photo-30547746.jpeg?auto=compress&cs=tinysrgb&w=1800"}$seed$::jsonb,
  $seed${"eyebrow":"Barberia profesional","title":"Tu estilo. Tu momento.","text":"Cortes, barba y estilo personalizado en un espacio pensado para verte impecable.","primaryCta":"Reservar cita","secondaryCta":"Ver servicios"}$seed$::jsonb,
  $seed${"title":"Recomendacion","body":"Llega cinco minutos antes. Si quieres un cambio grande de estilo, escribe primero para separar mas tiempo."}$seed$::jsonb,
  $seed${"title":"Agenda tu cita con Rasec Barber Studio.","text":"Elige tu barbero, el dia y la hora en menos de un minuto.","whatsappMessage":"Hola, tengo una pregunta sobre Rasec Barber Studio."}$seed$::jsonb,
  $seed${"bookingWindowDays":30}$seed$::jsonb
)
on conflict (id) do nothing;

insert into public.services (id, position, name, description, price, currency, duration_minutes, image, tags, available)
values
  ('corte-clasico', 1, 'Corte clasico', 'Corte limpio, equilibrado y facil de mantener.', 25000, 'COP', 30, 'https://images.pexels.com/photos/35157693/pexels-photo-35157693.jpeg?auto=compress&cs=tinysrgb&w=900', array['Tijera', 'Peine', 'Perfilado']::text[], true),
  ('fade', 2, 'Fade profesional', 'Degradado preciso con acabado natural o marcado.', 32000, 'COP', 40, 'https://images.pexels.com/photos/35157692/pexels-photo-35157692.jpeg?auto=compress&cs=tinysrgb&w=900', array['Maquina', 'Detalle', 'Estilo']::text[], true),
  ('barba', 3, 'Barba y contorno', 'Diseno de barba, navaja y producto hidratante.', 22000, 'COP', 25, 'https://images.pexels.com/photos/3998413/pexels-photo-3998413.jpeg?auto=compress&cs=tinysrgb&w=900', array['Navaja', 'Toalla', 'Aceite']::text[], true),
  ('corte-barba', 4, 'Corte + barba', 'Experiencia completa para salir listo de una vez.', 45000, 'COP', 60, 'https://images.pexels.com/photos/15194776/pexels-photo-15194776.jpeg?auto=compress&cs=tinysrgb&w=900', array['Completo', 'Premium', 'Relax']::text[], true)
on conflict (id) do nothing;

insert into public.barbers (id, position, name, specialty, bio, image, available, service_ids, days_off, time_off, gallery)
values
  ('andres', 1, 'Andres Moreno', 'Especialista en fades', 'Trabaja cortes modernos con transiciones limpias y acabados definidos.', 'https://images.pexels.com/photos/8552627/pexels-photo-8552627.jpeg?auto=compress&cs=tinysrgb&w=900', true, array['corte-clasico', 'fade', 'corte-barba']::text[], array['Lunes']::text[], $seed$[]$seed$::jsonb, $seed$[{"src":"https://images.pexels.com/photos/18503633/pexels-photo-18503633.jpeg?auto=compress&cs=tinysrgb&w=800","alt":"Fade en proceso con maquina de precision"},{"src":"https://images.pexels.com/photos/6487911/pexels-photo-6487911.jpeg?auto=compress&cs=tinysrgb&w=800","alt":"Fade terminado visto desde atras"},{"src":"https://images.pexels.com/photos/39559261/pexels-photo-39559261.jpeg?auto=compress&cs=tinysrgb&w=800","alt":"Corte con maquina en barberia moderna"},{"src":"https://images.pexels.com/photos/39559325/pexels-photo-39559325.jpeg?auto=compress&cs=tinysrgb&w=800","alt":"Fade con barba definida en primer plano"}]$seed$::jsonb),
  ('mateo', 2, 'Mateo Rios', 'Barba y navaja', 'Cuida contornos, simetria y ritual de barba con atencion al detalle.', 'https://images.pexels.com/photos/12946033/pexels-photo-12946033.jpeg?auto=compress&cs=tinysrgb&w=900', true, array['barba', 'corte-barba']::text[], array['Miercoles']::text[], $seed$[]$seed$::jsonb, $seed$[{"src":"https://images.pexels.com/photos/9153970/pexels-photo-9153970.jpeg?auto=compress&cs=tinysrgb&w=800","alt":"Perfilado de bigote con navaja"},{"src":"https://images.pexels.com/photos/3998427/pexels-photo-3998427.jpeg?auto=compress&cs=tinysrgb&w=800","alt":"Preparacion para afeitado de barba"},{"src":"https://images.pexels.com/photos/9341770/pexels-photo-9341770.jpeg?auto=compress&cs=tinysrgb&w=800","alt":"Afeitado de barba en blanco y negro"},{"src":"https://images.pexels.com/photos/5853394/pexels-photo-5853394.jpeg?auto=compress&cs=tinysrgb&w=800","alt":"Contorno de barba con tijera y peine"}]$seed$::jsonb),
  ('simon', 3, 'Simon Vega', 'Corte clasico', 'Combina tecnica tradicional con estilos faciles de llevar a diario.', 'https://images.pexels.com/photos/18483772/pexels-photo-18483772.jpeg?auto=compress&cs=tinysrgb&w=900', true, array['corte-clasico', 'barba', 'corte-barba']::text[], '{}'::text[], $seed$[]$seed$::jsonb, $seed$[{"src":"https://images.pexels.com/photos/32329615/pexels-photo-32329615.jpeg?auto=compress&cs=tinysrgb&w=800","alt":"Corte clasico en barberia contemporanea"},{"src":"https://images.pexels.com/photos/4422102/pexels-photo-4422102.jpeg?auto=compress&cs=tinysrgb&w=800","alt":"Corte de perfil con iluminacion de estudio"},{"src":"https://images.pexels.com/photos/11262382/pexels-photo-11262382.jpeg?auto=compress&cs=tinysrgb&w=800","alt":"Detalle de peinado con peine y navaja"},{"src":"https://images.pexels.com/photos/32351040/pexels-photo-32351040.jpeg?auto=compress&cs=tinysrgb&w=800","alt":"Corte clasico en blanco y negro"}]$seed$::jsonb)
on conflict (id) do nothing;

insert into public.hours (day, position, open, start_time, end_time)
values
  ('Lunes', 1, true, '10:00', '19:00'),
  ('Martes', 2, true, '10:00', '19:00'),
  ('Miercoles', 3, true, '10:00', '19:00'),
  ('Jueves', 4, true, '10:00', '20:00'),
  ('Viernes', 5, true, '10:00', '20:00'),
  ('Sabado', 6, true, '09:00', '17:00'),
  ('Domingo', 7, false, null, null)
on conflict (day) do nothing;
