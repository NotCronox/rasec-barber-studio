-- ============================================================================
-- Rasec Barber Studio - esquema de Supabase
-- Ejecutar completo en el SQL Editor de Supabase. Es idempotente: se puede
-- volver a correr sobre una base existente sin perder datos.
-- ============================================================================

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------
-- Administradores
-- ---------------------------------------------------------------------------

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_profiles where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Utilidades de fecha (la barberia opera en hora de Colombia)
-- ---------------------------------------------------------------------------

create or replace function public.bogota_now()
returns timestamp
language sql
stable
as $$
  select (now() at time zone 'America/Bogota');
$$;

create or replace function public.weekday_label(p_date date)
returns text
language sql
immutable
as $$
  select (array['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'])[extract(dow from p_date)::int + 1];
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Contenido del sitio (una sola fila con los textos y la configuracion)
-- ---------------------------------------------------------------------------

create table if not exists public.site_content (
  id integer primary key default 1 check (id = 1),
  business jsonb not null default '{}'::jsonb,
  identity jsonb not null default '{}'::jsonb,
  media jsonb not null default '{}'::jsonb,
  hero jsonb not null default '{}'::jsonb,
  notes jsonb not null default '{}'::jsonb,
  cta jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{"bookingWindowDays": 30}'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists site_content_touch_updated_at on public.site_content;
create trigger site_content_touch_updated_at
before update on public.site_content
for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Servicios, barberos y horarios
-- ---------------------------------------------------------------------------

create table if not exists public.services (
  id text primary key,
  position integer not null default 0,
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  price integer not null check (price >= 0),
  currency text not null default 'COP',
  duration_minutes integer not null check (duration_minutes >= 5),
  image text not null default '',
  tags text[] not null default '{}',
  available boolean not null default true,
  updated_at timestamptz not null default now()
);

drop trigger if exists services_touch_updated_at on public.services;
create trigger services_touch_updated_at
before update on public.services
for each row execute function public.touch_updated_at();

create table if not exists public.barbers (
  id text primary key,
  position integer not null default 0,
  name text not null check (length(trim(name)) > 0),
  specialty text not null default '',
  bio text not null default '',
  image text not null default '',
  available boolean not null default true,
  service_ids text[] not null default '{}',
  days_off text[] not null default '{}',
  time_off jsonb not null default '[]'::jsonb,
  gallery jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists barbers_touch_updated_at on public.barbers;
create trigger barbers_touch_updated_at
before update on public.barbers
for each row execute function public.touch_updated_at();

create table if not exists public.hours (
  day text primary key check (day in ('Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo')),
  position integer not null,
  open boolean not null default false,
  start_time time,
  end_time time,
  constraint hours_valid_range check (not open or (start_time is not null and end_time is not null and start_time < end_time))
);

-- Un servicio nuevo queda asignado a todos los barberos; uno eliminado se quita de todos.
create or replace function public.services_sync_barbers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.barbers set service_ids = array_append(service_ids, new.id) where not (new.id = any (service_ids));
    return new;
  end if;
  update public.barbers set service_ids = array_remove(service_ids, old.id) where old.id = any (service_ids);
  return old;
end;
$$;

drop trigger if exists services_sync_barbers_insert on public.services;
create trigger services_sync_barbers_insert
after insert on public.services
for each row execute function public.services_sync_barbers();

drop trigger if exists services_sync_barbers_delete on public.services;
create trigger services_sync_barbers_delete
after delete on public.services
for each row execute function public.services_sync_barbers();

-- ---------------------------------------------------------------------------
-- Citas
-- ---------------------------------------------------------------------------

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status text not null default 'pendiente' check (status in ('pendiente', 'confirmada', 'cancelada')),
  source text not null default 'web' check (source in ('web', 'admin')),
  created_at timestamptz not null default now(),
  -- Copia del servicio y el barbero al momento de reservar: si luego cambian o se
  -- eliminan, la cita conserva lo que se reservo.
  service_id text,
  service_name text not null,
  price integer not null default 0,
  barber_id text not null,
  barber_name text not null,
  date date not null,
  time time not null,
  duration_minutes integer not null check (duration_minutes >= 5),
  customer_name text not null check (length(trim(customer_name)) >= 2),
  customer_phone text not null default '',
  notes text not null default '',
  cancelled_at timestamptz,
  cancelled_by text check (cancelled_by in ('admin', 'cliente')),
  slot tsrange generated always as (tsrange(date + time, date + time + make_interval(mins => duration_minutes))) stored
);

create index if not exists bookings_date_idx on public.bookings (date);
create index if not exists bookings_barber_date_idx on public.bookings (barber_id, date);

-- La base de datos misma impide que un barbero tenga dos citas activas que se crucen,
-- aunque dos personas confirmen al mismo tiempo.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_no_overlap') then
    alter table public.bookings
      add constraint bookings_no_overlap
      exclude using gist (barber_id with =, slot with &&)
      where (status <> 'cancelada');
  end if;
end;
$$;

create or replace function public.generate_booking_code()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate text;
begin
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.bookings where code = candidate);
  end loop;
  return candidate;
end;
$$;

alter table public.bookings alter column code set default public.generate_booking_code();

-- Registra cuando y quien cancela una cita.
create or replace function public.bookings_track_cancel()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'cancelada' then
    if tg_op = 'INSERT' or old.status is distinct from 'cancelada' then
      new.cancelled_at := coalesce(new.cancelled_at, now());
      new.cancelled_by := coalesce(new.cancelled_by, 'admin');
    end if;
  else
    new.cancelled_at := null;
    new.cancelled_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_track_cancel on public.bookings;
create trigger bookings_track_cancel
before insert or update of status on public.bookings
for each row execute function public.bookings_track_cancel();

-- Datos de una cita que se pueden mostrar a quien tiene el codigo y el telefono.
create or replace function public.booking_public_json(b public.bookings)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', b.id,
    'code', b.code,
    'status', b.status,
    'source', b.source,
    'createdAt', b.created_at,
    'serviceId', b.service_id,
    'serviceName', b.service_name,
    'price', b.price,
    'barberId', b.barber_id,
    'barberName', b.barber_name,
    'date', b.date,
    'time', to_char(b.time, 'HH24:MI'),
    'durationMinutes', b.duration_minutes,
    'customerName', b.customer_name,
    'customerPhone', b.customer_phone,
    'notes', b.notes,
    'cancelledBy', b.cancelled_by,
    'canCancel', (b.status <> 'cancelada' and (b.date + b.time) > public.bogota_now())
  );
$$;

-- ---------------------------------------------------------------------------
-- Funciones publicas (lo unico que los clientes pueden hacer con las citas)
-- ---------------------------------------------------------------------------

-- Horarios ocupados, sin datos personales, para pintar el calendario.
create or replace function public.get_busy_slots(p_from date, p_to date)
returns table (barber_id text, slot_date date, slot_time time, duration_minutes integer)
language sql
stable
security definer
set search_path = public
as $$
  select b.barber_id, b.date, b.time, b.duration_minutes
  from public.bookings b
  where b.status <> 'cancelada'
    and b.date between p_from and least(p_to, p_from + 400)
  order by b.date, b.time;
$$;

-- Crea una cita validando todas las reglas del negocio en el servidor.
-- p_source = 'web' (cliente) o 'admin' (panel; requiere sesion de administrador).
create or replace function public.create_booking(
  p_service_id text,
  p_barber_id text,
  p_date date,
  p_time time,
  p_customer_name text,
  p_customer_phone text,
  p_notes text default '',
  p_source text default 'web',
  p_status text default 'pendiente'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_service public.services;
  v_barber public.barbers;
  v_day public.hours;
  v_booking public.bookings;
  v_now timestamp := public.bogota_now();
  v_name text := trim(coalesce(p_customer_name, ''));
  v_phone text := trim(coalesce(p_customer_phone, ''));
  v_notes text := left(trim(coalesce(p_notes, '')), 500);
  v_window integer;
  v_start integer;
  v_open integer;
  v_close integer;
begin
  if p_source not in ('web', 'admin') then
    raise exception 'Origen de la cita invalido.';
  end if;
  if p_source = 'admin' and not public.is_admin() then
    raise exception 'No tienes permisos para crear citas desde el panel.';
  end if;
  if p_status not in ('pendiente', 'confirmada') or (p_source = 'web' and p_status <> 'pendiente') then
    raise exception 'Estado de la cita invalido.';
  end if;

  select * into v_service from public.services where id = p_service_id;
  select * into v_barber from public.barbers where id = p_barber_id;
  if v_service.id is null or v_barber.id is null then
    raise exception 'El servicio o el barbero ya no existen. Recarga la pagina.';
  end if;

  if length(v_name) < 2 or length(v_name) > 80 then
    raise exception 'Escribe el nombre del cliente.';
  end if;
  if length(v_phone) > 30 then
    raise exception 'Escribe un telefono valido.';
  end if;

  if p_source = 'web' then
    if not v_service.available or not v_barber.available then
      raise exception 'Ese servicio o barbero ya no esta disponible. Elige otro.';
    end if;
    if not (v_service.id = any (v_barber.service_ids)) then
      raise exception '% no realiza %.', v_barber.name, v_service.name;
    end if;
    if length(regexp_replace(v_phone, '\D', '', 'g')) < 7 then
      raise exception 'Escribe un telefono valido.';
    end if;

    select coalesce((settings ->> 'bookingWindowDays')::integer, 30) into v_window from public.site_content where id = 1;
    if p_date < v_now::date then
      raise exception 'Esa fecha ya paso. Elige otra.';
    end if;
    if p_date > v_now::date + coalesce(v_window, 30) then
      raise exception 'Todavia no se abren reservas para esa fecha.';
    end if;
  end if;

  select * into v_day from public.hours where day = public.weekday_label(p_date);
  if v_day.day is null or not v_day.open then
    raise exception 'La barberia esta cerrada ese dia.';
  end if;
  if public.weekday_label(p_date) = any (v_barber.days_off) then
    raise exception '% descansa ese dia.', v_barber.name;
  end if;
  if exists (
    select 1
    from jsonb_array_elements(v_barber.time_off) as range_item
    where p_date between (range_item ->> 'start')::date and (range_item ->> 'end')::date
  ) then
    raise exception '% no esta disponible ese dia.', v_barber.name;
  end if;

  v_start := extract(epoch from p_time)::integer / 60;
  v_open := extract(epoch from v_day.start_time)::integer / 60;
  v_close := extract(epoch from v_day.end_time)::integer / 60;
  if v_start < v_open or v_start + v_service.duration_minutes > v_close or (v_start - v_open) % 30 <> 0 then
    raise exception 'Ese horario no esta disponible ese dia. Elige otro.';
  end if;
  if p_source = 'web' and (p_date + p_time) <= v_now then
    raise exception 'Ese horario ya paso. Elige otro.';
  end if;

  begin
    insert into public.bookings (
      status, source, service_id, service_name, price, barber_id, barber_name,
      date, time, duration_minutes, customer_name, customer_phone, notes
    )
    values (
      p_status, p_source, v_service.id, v_service.name, v_service.price, v_barber.id, v_barber.name,
      p_date, p_time, v_service.duration_minutes, v_name, v_phone, v_notes
    )
    returning * into v_booking;
  exception
    when exclusion_violation then
      raise exception 'Ese horario acaba de ser reservado por otra persona. Elige otro.';
  end;

  return public.booking_public_json(v_booking);
end;
$$;

-- Busca una cita con su codigo y el telefono con el que se reservo.
create or replace function public.find_booking(p_code text, p_phone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_booking public.bookings;
begin
  if v_code = '' or length(v_phone) < 7 then
    return null;
  end if;
  select * into v_booking from public.bookings where code = v_code;
  if v_booking.id is null then
    return null;
  end if;
  if right(regexp_replace(v_booking.customer_phone, '\D', '', 'g'), 7) <> right(v_phone, 7) then
    return null;
  end if;
  return public.booking_public_json(v_booking);
end;
$$;

-- El cliente cancela su propia cita (solo si todavia no ha pasado).
create or replace function public.cancel_booking(p_code text, p_phone text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_found jsonb := public.find_booking(p_code, p_phone);
  v_booking public.bookings;
begin
  if v_found is null then
    raise exception 'No encontramos una cita con ese codigo y telefono.';
  end if;
  if v_found ->> 'status' = 'cancelada' then
    raise exception 'Esta cita ya estaba cancelada.';
  end if;
  if not (v_found ->> 'canCancel')::boolean then
    raise exception 'Esta cita ya paso y no se puede cancelar.';
  end if;

  update public.bookings
  set status = 'cancelada', cancelled_at = now(), cancelled_by = 'cliente'
  where code = v_found ->> 'code'
  returning * into v_booking;

  return public.booking_public_json(v_booking);
end;
$$;

-- ---------------------------------------------------------------------------
-- Seguridad (RLS)
-- ---------------------------------------------------------------------------

alter table public.admin_profiles enable row level security;
alter table public.site_content enable row level security;
alter table public.services enable row level security;
alter table public.barbers enable row level security;
alter table public.hours enable row level security;
alter table public.bookings enable row level security;

drop policy if exists "Admins can read admin profiles" on public.admin_profiles;
create policy "Admins can read admin profiles"
on public.admin_profiles for select to authenticated
using (public.is_admin());

drop policy if exists "Public can read site content" on public.site_content;
create policy "Public can read site content"
on public.site_content for select to anon, authenticated
using (true);

drop policy if exists "Admins can manage site content" on public.site_content;
create policy "Admins can manage site content"
on public.site_content for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Public can read services" on public.services;
create policy "Public can read services"
on public.services for select to anon, authenticated
using (true);

drop policy if exists "Admins can manage services" on public.services;
create policy "Admins can manage services"
on public.services for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Public can read barbers" on public.barbers;
create policy "Public can read barbers"
on public.barbers for select to anon, authenticated
using (true);

drop policy if exists "Admins can manage barbers" on public.barbers;
create policy "Admins can manage barbers"
on public.barbers for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Public can read hours" on public.hours;
create policy "Public can read hours"
on public.hours for select to anon, authenticated
using (true);

drop policy if exists "Admins can manage hours" on public.hours;
create policy "Admins can manage hours"
on public.hours for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Las citas solo las ven y editan los administradores. Los clientes usan las funciones de arriba.
drop policy if exists "Admins can manage bookings" on public.bookings;
create policy "Admins can manage bookings"
on public.bookings for all to authenticated
using (public.is_admin()) with check (public.is_admin());

revoke all on function public.create_booking(text, text, date, time, text, text, text, text, text) from public;
revoke all on function public.find_booking(text, text) from public;
revoke all on function public.cancel_booking(text, text) from public;
revoke all on function public.get_busy_slots(date, date) from public;
revoke all on function public.generate_booking_code() from public;
grant execute on function public.create_booking(text, text, date, time, text, text, text, text, text) to anon, authenticated;
grant execute on function public.find_booking(text, text) to anon, authenticated;
grant execute on function public.cancel_booking(text, text) to anon, authenticated;
grant execute on function public.get_busy_slots(date, date) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.generate_booking_code() to authenticated;

-- ---------------------------------------------------------------------------
-- Fotos (Supabase Storage): lectura publica, solo administradores suben o borran
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can upload media" on storage.objects;
create policy "Admins can upload media"
on storage.objects for insert to authenticated
with check (bucket_id = 'media' and public.is_admin());

drop policy if exists "Admins can update media" on storage.objects;
create policy "Admins can update media"
on storage.objects for update to authenticated
using (bucket_id = 'media' and public.is_admin());

drop policy if exists "Admins can delete media" on storage.objects;
create policy "Admins can delete media"
on storage.objects for delete to authenticated
using (bucket_id = 'media' and public.is_admin());

-- ---------------------------------------------------------------------------
-- Actualizaciones en vivo (Realtime)
-- ---------------------------------------------------------------------------

do $$
declare
  table_name text;
begin
  foreach table_name in array array['site_content', 'services', 'barbers', 'hours', 'bookings'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;
