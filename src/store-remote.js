/**
 * Proveedor Supabase: datos reales compartidos entre todos los dispositivos.
 *
 * - El contenido del sitio (servicios, barberos, horarios, textos) se lee de tablas publicas.
 * - Los clientes nunca leen la tabla de citas: solo reciben los horarios ocupados
 *   (get_busy_slots) y crean/consultan/cancelan citas con funciones del servidor
 *   que validan todo otra vez (create_booking, find_booking, cancel_booking).
 * - El admin autenticado lee y edita todo, protegido por las politicas RLS.
 * - Los cambios llegan en vivo con Supabase Realtime.
 */
(function () {
  const supa = window.RasecSupabase;
  window.RasecStoreProviders = window.RasecStoreProviders || {};
  if (!supa || !supa.configured) return;

  const rules = window.RasecRules;
  const utils = window.RasecUtils;
  const { clone } = rules;

  const CONTENT_SECTIONS = ["business", "identity", "media", "hero", "notes", "cta", "settings"];
  const ADMIN_HISTORY_DAYS = 180;

  let client = null;
  let state = null;
  let scope = "public";
  let includeBookings = true;
  let externalListener = () => {};
  let channel = null;
  let refreshTimer = null;
  const pendingTables = new Set();

  // ---------- Errores ----------

  function toError(error, fallback) {
    const message = (error && error.message) || "";
    if (/Failed to fetch|NetworkError|Load failed/i.test(message)) {
      return new Error("No hay conexion con el servidor. Revisa tu internet e intenta de nuevo.");
    }
    if (error && (error.code === "42501" || /row-level security|permission denied/i.test(message))) {
      return new Error("Tu sesion no tiene permisos para este cambio. Vuelve a iniciar sesion.");
    }
    if (error && error.code === "23P01") return new Error("Ese horario se cruza con otra cita del mismo barbero.");
    if (error && error.code === "23514") return new Error("Algun dato no es valido. Revisa el formulario.");
    return new Error(message || fallback || "Algo salio mal. Intenta de nuevo.");
  }

  async function run(request, fallback) {
    const { data, error } = await request;
    if (error) throw toError(error, fallback);
    return data;
  }

  // ---------- Conversion base de datos <-> app ----------

  const shortTime = (value) => (value ? String(value).slice(0, 5) : null);

  function fromService(row) {
    return {
      id: row.id,
      position: row.position,
      name: row.name,
      description: row.description,
      price: row.price,
      currency: row.currency,
      durationMinutes: row.duration_minutes,
      image: row.image,
      tags: row.tags || [],
      available: row.available,
    };
  }

  function toService(service, position) {
    return {
      id: service.id,
      position,
      name: service.name,
      description: service.description || "",
      price: service.price,
      currency: service.currency || "COP",
      duration_minutes: service.durationMinutes,
      image: service.image || "",
      tags: service.tags || [],
      available: Boolean(service.available),
    };
  }

  function fromBarber(row) {
    return {
      id: row.id,
      position: row.position,
      name: row.name,
      specialty: row.specialty,
      bio: row.bio,
      image: row.image,
      available: row.available,
      serviceIds: row.service_ids || [],
      daysOff: row.days_off || [],
      timeOff: row.time_off || [],
      gallery: row.gallery || [],
    };
  }

  function toBarber(barber, position) {
    return {
      id: barber.id,
      position,
      name: barber.name,
      specialty: barber.specialty || "",
      bio: barber.bio || "",
      image: barber.image || "",
      available: Boolean(barber.available),
      service_ids: barber.serviceIds || [],
      days_off: barber.daysOff || [],
      time_off: barber.timeOff || [],
      gallery: barber.gallery || [],
    };
  }

  function fromHours(row) {
    return { day: row.day, open: row.open, start: shortTime(row.start_time), end: shortTime(row.end_time) };
  }

  function fromBooking(row) {
    return {
      id: row.id,
      code: row.code,
      status: row.status,
      source: row.source,
      createdAt: row.created_at,
      serviceId: row.service_id,
      serviceName: row.service_name,
      price: row.price,
      barberId: row.barber_id,
      barberName: row.barber_name,
      date: row.date,
      time: shortTime(row.time),
      durationMinutes: row.duration_minutes,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      notes: row.notes,
      cancelledAt: row.cancelled_at,
      cancelledBy: row.cancelled_by,
    };
  }

  // Lo que devuelven create_booking / find_booking / cancel_booking (ya viene en camelCase).
  function fromPublicBooking(json) {
    return json ? { ...json, time: shortTime(json.time) } : null;
  }

  // ---------- Lecturas ----------

  async function fetchContent() {
    const row = await run(client.from("site_content").select("*").eq("id", 1).single(), "No se pudo cargar el sitio.");
    const content = {};
    CONTENT_SECTIONS.forEach((key) => {
      content[key] = row[key] || {};
    });
    content.settings = { bookingWindowDays: 30, ...content.settings };
    return content;
  }

  async function fetchServices() {
    return (await run(client.from("services").select("*").order("position"))).map(fromService);
  }

  async function fetchBarbers() {
    return (await run(client.from("barbers").select("*").order("position"))).map(fromBarber);
  }

  async function fetchHours() {
    return (await run(client.from("hours").select("*").order("position"))).map(fromHours);
  }

  async function fetchBookings() {
    if (!includeBookings) return [];
    const today = utils.todayISO();

    if (scope === "admin") {
      const rows = await run(
        client
          .from("bookings")
          .select("*")
          .gte("date", utils.addDays(today, -ADMIN_HISTORY_DAYS))
          .order("date")
          .order("time"),
        "No se pudieron cargar las reservas."
      );
      return rows.map(fromBooking);
    }

    // Visitantes: solo los horarios ocupados, sin nombres ni telefonos.
    const windowDays = Number(state && state.settings && state.settings.bookingWindowDays) || 30;
    const rows = await run(
      client.rpc("get_busy_slots", { p_from: today, p_to: utils.addDays(today, windowDays + 1) }),
      "No se pudo consultar la disponibilidad."
    );
    return rows.map((row, index) => ({
      id: `busy-${index}`,
      barberId: row.barber_id,
      date: row.slot_date,
      time: shortTime(row.slot_time),
      durationMinutes: row.duration_minutes,
      status: "pendiente",
    }));
  }

  async function refreshTables(tables) {
    const next = { ...state };
    const jobs = [];
    if (tables.includes("site_content")) jobs.push(fetchContent().then((content) => Object.assign(next, content)));
    if (tables.includes("services")) jobs.push(fetchServices().then((rows) => (next.services = rows)));
    if (tables.includes("barbers")) jobs.push(fetchBarbers().then((rows) => (next.barbers = rows)));
    if (tables.includes("hours")) jobs.push(fetchHours().then((rows) => (next.hours = rows)));
    await Promise.all(jobs);
    state = next;
    if (tables.includes("bookings") || tables.includes("site_content")) state.bookings = await fetchBookings();
    return clone(state);
  }

  // ---------- Tiempo real ----------

  function scheduleRefresh(table) {
    pendingTables.add(table);
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async () => {
      const tables = [...pendingTables];
      pendingTables.clear();
      try {
        externalListener(await refreshTables(tables));
      } catch (error) {
        console.warn("No se pudo actualizar en vivo.", error);
      }
    }, 250);
  }

  function subscribeRealtime() {
    if (channel) return;
    const tables = ["site_content", "services", "barbers", "hours"];
    if (scope === "admin" && includeBookings) tables.push("bookings");
    channel = client.channel(`rasec-${scope}-${Date.now()}`);
    tables.forEach((table) => {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => scheduleRefresh(table));
    });
    channel.subscribe();
  }

  function nextPosition(list) {
    return list.reduce((max, item) => Math.max(max, item.position || 0), 0) + 1;
  }

  // ---------- Interfaz del proveedor ----------

  const provider = {
    mode: "remote",

    async load(options = {}) {
      scope = options.scope || "public";
      includeBookings = options.bookings !== false;
      client = await supa.getClient();

      const [content, services, barbers, hours] = await Promise.all([fetchContent(), fetchServices(), fetchBarbers(), fetchHours()]);
      state = { ...content, services, barbers, hours, bookings: [] };
      state.bookings = await fetchBookings();
      subscribeRealtime();
      return clone(state);
    },

    async refreshAvailability() {
      state.bookings = await fetchBookings();
      return clone(state);
    },

    onExternalChange(listener) {
      externalListener = listener;
    },

    async updateSiteContent(sections) {
      if (sections.settings) rules.validateSettings({ ...state.settings, ...sections.settings });
      const patch = {};
      Object.entries(sections).forEach(([key, value]) => {
        patch[key] = { ...state[key], ...value };
      });
      await run(client.from("site_content").update(patch).eq("id", 1), "No se pudieron guardar los cambios.");
      return refreshTables(["site_content"]);
    },

    async saveService(service) {
      const record = { ...service, name: (service.name || "").trim(), price: Number(service.price), durationMinutes: Number(service.durationMinutes) };
      rules.validateService(record);
      const existing = record.id && state.services.find((item) => item.id === record.id);
      record.id = record.id || rules.generateId("srv");
      const position = existing ? existing.position : nextPosition(state.services);
      await run(client.from("services").upsert(toService(record, position)), "No se pudo guardar el servicio.");
      return { state: await refreshTables(["services", "barbers"]), id: record.id };
    },

    async deleteService(id) {
      await run(client.from("services").delete().eq("id", id), "No se pudo eliminar el servicio.");
      return refreshTables(["services", "barbers"]);
    },

    async saveBarber(barber) {
      const record = { ...barber, name: (barber.name || "").trim() };
      rules.validateBarber(record);
      const existing = record.id && state.barbers.find((item) => item.id === record.id);
      record.id = record.id || rules.generateId("brb");
      const position = existing ? existing.position : nextPosition(state.barbers);
      await run(client.from("barbers").upsert(toBarber(record, position)), "No se pudo guardar el barbero.");
      return { state: await refreshTables(["barbers"]), id: record.id };
    },

    async deleteBarber(id) {
      await run(client.from("barbers").delete().eq("id", id), "No se pudo eliminar el barbero.");
      return refreshTables(["barbers"]);
    },

    async saveHours(hours) {
      rules.validateHours(hours);
      const rows = hours.map((day) => ({
        day: day.day,
        position: utils.WEEK_ORDER.indexOf(day.day) + 1,
        open: day.open,
        start_time: day.open ? day.start : null,
        end_time: day.open ? day.end : null,
      }));
      await run(client.from("hours").upsert(rows), "No se pudieron guardar los horarios.");
      return refreshTables(["hours"]);
    },

    async createBooking(input, options = {}) {
      const source = options.source || "web";
      const data = await run(
        client.rpc("create_booking", {
          p_service_id: input.serviceId,
          p_barber_id: input.barberId,
          p_date: input.date,
          p_time: input.time,
          p_customer_name: input.customerName || "",
          p_customer_phone: input.customerPhone || "",
          p_notes: input.notes || "",
          p_source: source,
          p_status: source === "admin" && options.status === "confirmada" ? "confirmada" : "pendiente",
        }),
        "No se pudo crear la cita."
      );
      state.bookings = await fetchBookings();
      return { state: clone(state), booking: fromPublicBooking(data) };
    },

    async updateBookingStatus(id, status) {
      if (!rules.BOOKING_STATUSES.includes(status)) throw new Error("Estado de reserva invalido.");
      await run(client.from("bookings").update({ status }).eq("id", id), "No se pudo cambiar el estado.");
      return refreshTables(["bookings"]);
    },

    async deleteBooking(id) {
      await run(client.from("bookings").delete().eq("id", id), "No se pudo eliminar la cita.");
      return refreshTables(["bookings"]);
    },

    async findBookingByCode(code, phone) {
      if (!client) client = await supa.getClient();
      const data = await run(client.rpc("find_booking", { p_code: code || "", p_phone: phone || "" }), "No se pudo consultar la cita.");
      return fromPublicBooking(data);
    },

    async cancelBookingByCustomer(code, phone) {
      if (!client) client = await supa.getClient();
      const data = await run(client.rpc("cancel_booking", { p_code: code || "", p_phone: phone || "" }), "No se pudo cancelar la cita.");
      return { state: clone(state), booking: fromPublicBooking(data) };
    },

    async uploadImage(blob) {
      const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      await run(client.storage.from("media").upload(path, blob, { contentType: "image/jpeg", upsert: false }), "No se pudo subir la foto.");
      return client.storage.from("media").getPublicUrl(path).data.publicUrl;
    },

    async resetToDefaults() {
      throw new Error("Con la base de datos real no se pueden restaurar los datos de ejemplo desde el panel.");
    },

    getStorageUsage() {
      return null;
    },
  };

  window.RasecStoreProviders.remote = provider;
})();
