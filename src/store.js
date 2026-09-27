/**
 * Capa de persistencia y reglas de negocio del sitio.
 *
 * Hoy guarda todo en localStorage (demo local, sin backend). El resto del
 * codigo (app.js, booking.js, mi-cita.js, admin.js) solo habla con
 * `window.RasecStore`, nunca con localStorage directamente. Las reglas de
 * disponibilidad (horarios, descansos, ventana de reserva, choques de citas)
 * tambien viven aqui, igual que las validaria un backend. Cuando el proyecto
 * pase a un backend real (por ejemplo Supabase), se reescribe este archivo
 * para que estas mismas funciones llamen a la API.
 */
(function () {
  const STORAGE_KEY = "rasec_barberia_state_v1";
  const SLOT_STEP_MINUTES = 30;
  const APPROX_QUOTA_BYTES = 5 * 1024 * 1024;
  const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const BOOKING_STATUSES = ["pendiente", "confirmada", "cancelada"];

  const utils = window.RasecUtils;
  const listeners = new Set();

  let state = null;
  let lastSerialized = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function timeToMinutes(time) {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  }

  function minutesToTime(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60)
      .toString()
      .padStart(2, "0");
    const minutes = (totalMinutes % 60).toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  function randomToken(length, alphabet) {
    let token = "";
    for (let i = 0; i < length; i++) {
      token += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return token;
  }

  function generateId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function generateCode(bookings) {
    let code;
    do {
      code = randomToken(6, CODE_ALPHABET);
    } while (bookings.some((booking) => booking.code === code));
    return code;
  }

  function isQuotaError(error) {
    return (
      error &&
      (error.name === "QuotaExceededError" ||
        error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
        error.code === 22 ||
        error.code === 1014)
    );
  }

  // ---------- Carga, migracion y guardado ----------

  function seedState() {
    const defaults = window.RASEC_BARBERIA_DATA;
    const seeded = normalize({
      business: clone(defaults.business),
      identity: clone(defaults.identity),
      media: clone(defaults.media),
      hero: clone(defaults.hero),
      services: clone(defaults.services),
      barbers: clone(defaults.barbers),
      hours: clone(defaults.hours),
      settings: clone(defaults.settings || {}),
      notes: clone(defaults.notes),
      cta: clone(defaults.cta),
      bookings: [],
    });
    lastSerialized = JSON.stringify(seeded);
    localStorage.setItem(STORAGE_KEY, lastSerialized);
    return seeded;
  }

  // Completa campos que no existian en versiones anteriores del demo.
  function normalize(target) {
    const defaults = window.RASEC_BARBERIA_DATA;
    target.settings = { bookingWindowDays: 30, ...(defaults.settings || {}), ...(target.settings || {}) };
    if (!Array.isArray(target.services)) target.services = [];
    if (!Array.isArray(target.barbers)) target.barbers = [];
    if (!Array.isArray(target.bookings)) target.bookings = [];

    const allServiceIds = target.services.map((service) => service.id);
    target.barbers.forEach((barber) => {
      if (!Array.isArray(barber.serviceIds)) barber.serviceIds = [...allServiceIds];
      if (!Array.isArray(barber.daysOff)) barber.daysOff = [];
      if (!Array.isArray(barber.timeOff)) barber.timeOff = [];
      if (!Array.isArray(barber.gallery)) barber.gallery = [];
    });

    target.bookings.forEach((booking) => {
      const service = target.services.find((item) => item.id === booking.serviceId);
      const barber = target.barbers.find((item) => item.id === booking.barberId);
      if (!booking.code) booking.code = generateCode(target.bookings);
      if (!booking.source) booking.source = "web";
      if (!booking.serviceName) booking.serviceName = service ? service.name : "Servicio";
      if (!booking.barberName) booking.barberName = barber ? barber.name : "Barbero";
      if (booking.price == null) booking.price = service ? service.price : 0;
    });

    return target;
  }

  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.business || !Array.isArray(parsed.services)) {
        throw new Error("Forma de estado invalida");
      }
      const normalized = normalize(parsed);
      const serialized = JSON.stringify(normalized);
      if (serialized !== raw) {
        try {
          localStorage.setItem(STORAGE_KEY, serialized);
        } catch (error) {
          console.warn("No se pudo guardar la migracion de datos.", error);
        }
      }
      lastSerialized = serialized;
      return normalized;
    } catch (error) {
      console.warn("Estado invalido en localStorage, se reinicia con los datos de ejemplo.", error);
      return seedState();
    }
  }

  function reload() {
    state = loadState();
    return state;
  }

  // Toda edicion parte de lo guardado en este instante, no de la copia en memoria:
  // asi una pestana que lleva rato abierta nunca pisa cambios hechos en otra.
  function freshCopy() {
    return clone(reload());
  }

  function notify(source) {
    const snapshot = clone(state);
    listeners.forEach((listener) => listener(snapshot, { source }));
  }

  function persist(next) {
    const serialized = JSON.stringify(next);
    try {
      localStorage.setItem(STORAGE_KEY, serialized);
    } catch (error) {
      if (isQuotaError(error)) {
        throw new Error(
          "No hay espacio suficiente en este navegador para guardar el cambio. Usa fotos mas livianas o enlaces (URL) en lugar de subir archivos."
        );
      }
      throw error;
    }
    lastSerialized = serialized;
    state = next;
    notify("local");
  }

  function refreshIfChanged() {
    if (localStorage.getItem(STORAGE_KEY) === lastSerialized) return;
    reload();
    notify("external");
  }

  // ---------- Reglas de disponibilidad (funciones puras sobre un estado) ----------

  function findService(source, id) {
    return source.services.find((service) => service.id === id);
  }

  function findBarber(source, id) {
    return source.barbers.find((barber) => barber.id === id);
  }

  function weekdayOf(iso) {
    return utils.weekdayLabelFor(utils.parseISODate(iso));
  }

  function dayHoursFor(source, iso) {
    return source.hours.find((day) => day.day === weekdayOf(iso)) || null;
  }

  function maxBookingDate(source) {
    return utils.addDays(utils.todayISO(), Number(source.settings.bookingWindowDays) || 30);
  }

  function timeOffFor(barber, iso) {
    return (barber.timeOff || []).find((range) => range.start <= iso && iso <= range.end) || null;
  }

  function barberDayStatus(source, barberId, iso) {
    const barber = findBarber(source, barberId);
    if (!barber) return { working: false, reason: "unknown" };
    const day = dayHoursFor(source, iso);
    if (!day || !day.open) return { working: false, reason: "closed" };
    if ((barber.daysOff || []).includes(weekdayOf(iso))) return { working: false, reason: "day-off" };
    const off = timeOffFor(barber, iso);
    if (off) return { working: false, reason: "time-off", note: off.reason || "" };
    return { working: true, reason: null };
  }

  function dateStatus(source, barberId, iso, options = {}) {
    if (!options.allowPast && iso < utils.todayISO()) return { ok: false, reason: "past" };
    if (!options.ignoreWindow && iso > maxBookingDate(source)) return { ok: false, reason: "beyond-window" };
    const day = barberDayStatus(source, barberId, iso);
    return day.working ? { ok: true, reason: null } : { ok: false, reason: day.reason, note: day.note };
  }

  function conflictIn(source, barberId, iso, startMinutes, durationMinutes, excludeId) {
    return source.bookings.some((booking) => {
      if (booking.barberId !== barberId || booking.date !== iso) return false;
      if (booking.status === "cancelada") return false;
      if (excludeId && booking.id === excludeId) return false;
      const existingStart = timeToMinutes(booking.time);
      const existingEnd = existingStart + booking.durationMinutes;
      return startMinutes < existingEnd && existingStart < startMinutes + durationMinutes;
    });
  }

  function slotsFor(source, { barberId, serviceId, date, allowPast = false, ignoreWindow = false }) {
    const service = findService(source, serviceId);
    if (!service || !barberId || !date) return [];
    if (!dateStatus(source, barberId, date, { allowPast, ignoreWindow }).ok) return [];

    const day = dayHoursFor(source, date);
    const open = timeToMinutes(day.start);
    const close = timeToMinutes(day.end);
    const today = utils.todayISO();
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const slots = [];
    for (let cursor = open; cursor + service.durationMinutes <= close; cursor += SLOT_STEP_MINUTES) {
      const past = date < today || (date === today && cursor <= nowMinutes);
      let status = "free";
      if (conflictIn(source, barberId, date, cursor, service.durationMinutes)) status = "taken";
      else if (past && !allowPast) status = "past";
      slots.push({ time: minutesToTime(cursor), minutes: cursor, status, past });
    }
    return slots;
  }

  function bookingStart(booking) {
    const date = utils.parseISODate(booking.date);
    const minutes = timeToMinutes(booking.time);
    date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    return date;
  }

  function isUpcoming(booking) {
    return booking.status !== "cancelada" && bookingStart(booking) > new Date();
  }

  // ---------- Validaciones ----------

  function validateService(service) {
    if (!service.name || !service.name.trim()) throw new Error("El servicio necesita un nombre.");
    if (!Number.isFinite(service.price) || service.price < 0) throw new Error("El precio debe ser un numero mayor o igual a 0.");
    if (!Number.isInteger(service.durationMinutes) || service.durationMinutes < 5) {
      throw new Error("La duracion debe ser de al menos 5 minutos.");
    }
  }

  function validateBarber(barber) {
    if (!barber.name || !barber.name.trim()) throw new Error("El barbero necesita un nombre.");
    (barber.daysOff || []).forEach((day) => {
      if (!utils.WEEK_ORDER.includes(day)) throw new Error(`Dia de descanso invalido: ${day}.`);
    });
    (barber.timeOff || []).forEach((range) => {
      if (!range.start || !range.end) throw new Error("Cada ausencia necesita fecha de inicio y de fin.");
      if (range.start > range.end) throw new Error("En las ausencias, la fecha de inicio debe ser antes que la de fin.");
    });
  }

  function validateHours(hours) {
    hours.forEach((day) => {
      if (!day.open) return;
      if (!day.start || !day.end) throw new Error(`Falta la hora de apertura o cierre del ${day.day}.`);
      if (day.start >= day.end) throw new Error(`El ${day.day} la apertura debe ser antes del cierre.`);
    });
  }

  // ---------- API publica ----------

  const Store = {
    STORAGE_KEY,
    SLOT_STEP_MINUTES,
    BOOKING_STATUSES,
    timeToMinutes,
    minutesToTime,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getState() {
      return clone(state);
    },

    getStorageUsage() {
      const raw = localStorage.getItem(STORAGE_KEY) || "";
      return { usedBytes: raw.length, approxLimitBytes: APPROX_QUOTA_BYTES };
    },

    resetToDefaults() {
      localStorage.removeItem(STORAGE_KEY);
      state = seedState();
      notify("local");
      return clone(state);
    },

    // --- Contenido del negocio ---

    updateBusiness(partial) {
      const next = freshCopy();
      Object.assign(next.business, partial);
      persist(next);
    },

    updateHero(partial) {
      const next = freshCopy();
      Object.assign(next.hero, partial);
      persist(next);
    },

    updateNotes(partial) {
      const next = freshCopy();
      Object.assign(next.notes, partial);
      persist(next);
    },

    updateCta(partial) {
      const next = freshCopy();
      Object.assign(next.cta, partial);
      persist(next);
    },

    updateMedia(partial) {
      const next = freshCopy();
      Object.assign(next.media, partial);
      persist(next);
    },

    updateIdentity(partial) {
      const next = freshCopy();
      Object.assign(next.identity, partial);
      persist(next);
    },

    validateHours(hours) {
      validateHours(hours);
    },

    validateBarber(barber) {
      validateBarber(barber);
    },

    updateSettings(partial) {
      const days = Number(partial.bookingWindowDays);
      if (!Number.isInteger(days) || days < 1 || days > 365) {
        throw new Error("Los dias de anticipacion deben ser un numero entero entre 1 y 365.");
      }
      const next = freshCopy();
      next.settings = { ...next.settings, bookingWindowDays: days };
      persist(next);
    },

    saveService(service) {
      const record = {
        ...service,
        name: (service.name || "").trim(),
        price: Number(service.price),
        durationMinutes: Number(service.durationMinutes),
      };
      validateService(record);

      const next = freshCopy();
      const index = record.id ? next.services.findIndex((item) => item.id === record.id) : -1;
      if (index >= 0) {
        next.services[index] = record;
      } else {
        record.id = record.id || generateId("srv");
        next.services.push(record);
        next.barbers.forEach((barber) => barber.serviceIds.push(record.id));
      }
      persist(next);
      return record.id;
    },

    deleteService(id) {
      const next = freshCopy();
      next.services = next.services.filter((item) => item.id !== id);
      next.barbers.forEach((barber) => {
        barber.serviceIds = barber.serviceIds.filter((serviceId) => serviceId !== id);
      });
      persist(next);
    },

    saveBarber(barber) {
      const record = {
        ...barber,
        name: (barber.name || "").trim(),
        serviceIds: barber.serviceIds || [],
        daysOff: barber.daysOff || [],
        timeOff: barber.timeOff || [],
        gallery: barber.gallery || [],
      };
      validateBarber(record);

      const next = freshCopy();
      const index = record.id ? next.barbers.findIndex((item) => item.id === record.id) : -1;
      if (index >= 0) {
        next.barbers[index] = record;
      } else {
        record.id = record.id || generateId("brb");
        next.barbers.push(record);
      }
      persist(next);
      return record.id;
    },

    deleteBarber(id) {
      const next = freshCopy();
      next.barbers = next.barbers.filter((item) => item.id !== id);
      persist(next);
    },

    saveHours(hours) {
      validateHours(hours);
      const next = freshCopy();
      next.hours = hours;
      persist(next);
    },

    // --- Consultas de disponibilidad ---

    getMaxBookingDate() {
      return maxBookingDate(state);
    },

    getBarberDayStatus(barberId, date) {
      return barberDayStatus(state, barberId, date);
    },

    getDateStatus(barberId, date, options) {
      return dateStatus(state, barberId, date, options);
    },

    getSlots(params) {
      return slotsFor(state, params);
    },

    findConflict(barberId, date, startMinutes, durationMinutes, excludeId) {
      return conflictIn(state, barberId, date, startMinutes, durationMinutes, excludeId);
    },

    isUpcoming(booking) {
      return isUpcoming(booking);
    },

    getUpcomingBookings({ serviceId, barberId } = {}) {
      return clone(
        state.bookings.filter(
          (booking) =>
            isUpcoming(booking) &&
            (!serviceId || booking.serviceId === serviceId) &&
            (!barberId || booking.barberId === barberId)
        )
      );
    },

    // Citas futuras que quedarian fuera de un horario nuevo (dia cerrado u horas recortadas).
    getBookingsOutsideHours(hours) {
      return clone(
        state.bookings.filter((booking) => {
          if (!isUpcoming(booking)) return false;
          const day = hours.find((item) => item.day === weekdayOf(booking.date));
          if (!day || !day.open) return true;
          const start = timeToMinutes(booking.time);
          return start < timeToMinutes(day.start) || start + booking.durationMinutes > timeToMinutes(day.end);
        })
      );
    },

    // Citas futuras de un barbero que chocan con sus nuevos descansos, ausencias o servicios.
    getBookingsBlockedForBarber(barber) {
      if (!barber.id) return [];
      return clone(
        state.bookings.filter((booking) => {
          if (booking.barberId !== barber.id || !isUpcoming(booking)) return false;
          if ((barber.daysOff || []).includes(weekdayOf(booking.date))) return true;
          if (timeOffFor(barber, booking.date)) return true;
          return !(barber.serviceIds || []).includes(booking.serviceId);
        })
      );
    },

    // --- Reservas ---

    createBooking(input, options = {}) {
      const source = options.source || "web";
      const current = reload();
      const service = findService(current, input.serviceId);
      const barber = findBarber(current, input.barberId);

      if (!service || !barber) throw new Error("El servicio o el barbero ya no existen. Recarga la pagina.");
      if (source === "web") {
        if (!service.available || !barber.available) throw new Error("Ese servicio o barbero ya no esta disponible. Elige otro.");
        if (!barber.serviceIds.includes(service.id)) throw new Error(`${barber.name} no realiza ${service.name}.`);
      }

      const customerName = (input.customerName || "").trim();
      const customerPhone = (input.customerPhone || "").trim();
      if (customerName.length < 2) throw new Error("Escribe el nombre del cliente.");
      if (source === "web" && utils.digitsOnly(customerPhone).length < 7) throw new Error("Escribe un telefono valido.");

      const slot = slotsFor(current, {
        barberId: barber.id,
        serviceId: service.id,
        date: input.date,
        allowPast: options.allowPast,
        ignoreWindow: options.ignoreWindow,
      }).find((item) => item.time === input.time);

      if (!slot) throw new Error("Ese horario no esta disponible ese dia. Elige otro.");
      if (slot.status === "taken") throw new Error("Ese horario acaba de ser reservado por otra persona. Elige otro.");
      if (slot.status === "past") throw new Error("Ese horario ya paso. Elige otro.");

      const next = clone(current);
      const record = {
        id: generateId("bk"),
        code: generateCode(next.bookings),
        status: BOOKING_STATUSES.includes(options.status) ? options.status : "pendiente",
        source,
        createdAt: new Date().toISOString(),
        serviceId: service.id,
        serviceName: service.name,
        price: service.price,
        barberId: barber.id,
        barberName: barber.name,
        date: input.date,
        time: input.time,
        durationMinutes: service.durationMinutes,
        customerName,
        customerPhone,
        notes: (input.notes || "").trim(),
      };
      next.bookings.push(record);
      persist(next);
      return clone(record);
    },

    updateBookingStatus(id, status) {
      if (!BOOKING_STATUSES.includes(status)) throw new Error("Estado de reserva invalido.");
      const next = freshCopy();
      const booking = next.bookings.find((item) => item.id === id);
      if (!booking) throw new Error("La reserva ya no existe.");
      booking.status = status;
      if (status === "cancelada") {
        booking.cancelledAt = new Date().toISOString();
        booking.cancelledBy = "admin";
      } else {
        delete booking.cancelledAt;
        delete booking.cancelledBy;
      }
      persist(next);
    },

    deleteBooking(id) {
      const next = freshCopy();
      next.bookings = next.bookings.filter((item) => item.id !== id);
      persist(next);
    },

    findBookingByCode(code, phone) {
      const current = reload();
      const normalizedCode = String(code || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
      const phoneDigits = utils.digitsOnly(phone);
      if (!normalizedCode || phoneDigits.length < 7) return null;

      const booking = current.bookings.find((item) => item.code === normalizedCode);
      if (!booking) return null;
      if (utils.digitsOnly(booking.customerPhone).slice(-7) !== phoneDigits.slice(-7)) return null;
      return { ...clone(booking), canCancel: isUpcoming(booking) };
    },

    cancelBookingByCustomer(code, phone) {
      const found = this.findBookingByCode(code, phone);
      if (!found) throw new Error("No encontramos una cita con ese codigo y telefono.");
      if (found.status === "cancelada") throw new Error("Esta cita ya estaba cancelada.");
      if (!found.canCancel) throw new Error("Esta cita ya paso y no se puede cancelar.");

      const next = freshCopy();
      const booking = next.bookings.find((item) => item.id === found.id);
      booking.status = "cancelada";
      booking.cancelledAt = new Date().toISOString();
      booking.cancelledBy = "cliente";
      persist(next);
      return clone(booking);
    },
  };

  state = loadState();

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY || event.key === null) refreshIfChanged();
  });
  // Pestanas restauradas del historial o que vuelven al frente pueden haberse perdido eventos.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) refreshIfChanged();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshIfChanged();
  });

  window.RasecStore = Store;
})();
