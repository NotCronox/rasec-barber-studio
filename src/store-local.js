/**
 * Proveedor local: guarda todo en localStorage de este navegador.
 * Se usa solo mientras src/supabase-config.js no tenga credenciales (desarrollo
 * sin conexion). Expone la misma interfaz asincrona que store-remote.js.
 */
(function () {
  const rules = window.RasecRules;
  const utils = window.RasecUtils;
  const { clone } = rules;

  const STORAGE_KEY = "rasec_barberia_state_v1";
  const APPROX_QUOTA_BYTES = 5 * 1024 * 1024;

  let state = null;
  let lastSerialized = null;
  let externalListener = () => {};
  let listenersAttached = false;

  function isQuotaError(error) {
    return (
      error &&
      (error.name === "QuotaExceededError" ||
        error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
        error.code === 22 ||
        error.code === 1014)
    );
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
      if (!booking.code) booking.code = rules.generateCode(target.bookings);
      if (!booking.source) booking.source = "web";
      if (!booking.serviceName) booking.serviceName = service ? service.name : "Servicio";
      if (!booking.barberName) booking.barberName = barber ? barber.name : "Barbero";
      if (booking.price == null) booking.price = service ? service.price : 0;
    });

    return target;
  }

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

  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.business || !Array.isArray(parsed.services)) throw new Error("Forma de estado invalida");
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
    return clone(state);
  }

  function refreshIfChanged() {
    if (localStorage.getItem(STORAGE_KEY) === lastSerialized) return;
    reload();
    externalListener(clone(state));
  }

  function attachListeners() {
    if (listenersAttached) return;
    listenersAttached = true;
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
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("No se pudo leer la foto."));
      reader.readAsDataURL(blob);
    });
  }

  const provider = {
    mode: "local",

    async load() {
      attachListeners();
      return clone(reload());
    },

    async refreshAvailability() {
      return clone(reload());
    },

    onExternalChange(listener) {
      externalListener = listener;
    },

    async updateSiteContent(sections) {
      if (sections.settings) rules.validateSettings({ ...state.settings, ...sections.settings });
      const next = freshCopy();
      Object.entries(sections).forEach(([key, value]) => {
        next[key] = Array.isArray(value) ? value : { ...next[key], ...value };
      });
      return persist(next);
    },

    async saveService(service) {
      const record = {
        ...service,
        name: (service.name || "").trim(),
        price: Number(service.price),
        durationMinutes: Number(service.durationMinutes),
      };
      rules.validateService(record);

      const next = freshCopy();
      const index = record.id ? next.services.findIndex((item) => item.id === record.id) : -1;
      if (index >= 0) {
        next.services[index] = record;
      } else {
        record.id = record.id || rules.generateId("srv");
        next.services.push(record);
        next.barbers.forEach((barber) => barber.serviceIds.push(record.id));
      }
      return { state: persist(next), id: record.id };
    },

    async deleteService(id) {
      const next = freshCopy();
      next.services = next.services.filter((item) => item.id !== id);
      next.barbers.forEach((barber) => {
        barber.serviceIds = barber.serviceIds.filter((serviceId) => serviceId !== id);
      });
      return persist(next);
    },

    async saveBarber(barber) {
      const record = {
        ...barber,
        name: (barber.name || "").trim(),
        serviceIds: barber.serviceIds || [],
        daysOff: barber.daysOff || [],
        timeOff: barber.timeOff || [],
        gallery: barber.gallery || [],
      };
      rules.validateBarber(record);

      const next = freshCopy();
      const index = record.id ? next.barbers.findIndex((item) => item.id === record.id) : -1;
      if (index >= 0) {
        next.barbers[index] = record;
      } else {
        record.id = record.id || rules.generateId("brb");
        next.barbers.push(record);
      }
      return { state: persist(next), id: record.id };
    },

    async deleteBarber(id) {
      const next = freshCopy();
      next.barbers = next.barbers.filter((item) => item.id !== id);
      return persist(next);
    },

    async saveHours(hours) {
      rules.validateHours(hours);
      const next = freshCopy();
      next.hours = hours;
      return persist(next);
    },

    async createBooking(input, options = {}) {
      const source = options.source || "web";
      const current = reload();
      const service = rules.findService(current, input.serviceId);
      const barber = rules.findBarber(current, input.barberId);

      if (!service || !barber) throw new Error("El servicio o el barbero ya no existen. Recarga la pagina.");
      if (source === "web") {
        if (!service.available || !barber.available) throw new Error("Ese servicio o barbero ya no esta disponible. Elige otro.");
        if (!barber.serviceIds.includes(service.id)) throw new Error(`${barber.name} no realiza ${service.name}.`);
      }

      const customerName = (input.customerName || "").trim();
      const customerPhone = (input.customerPhone || "").trim();
      if (customerName.length < 2) throw new Error("Escribe el nombre del cliente.");
      if (source === "web" && utils.digitsOnly(customerPhone).length < 7) throw new Error("Escribe un telefono valido.");

      const slot = rules
        .slotsFor(current, {
          barberId: barber.id,
          serviceId: service.id,
          date: input.date,
          allowPast: source === "admin",
          ignoreWindow: source === "admin",
        })
        .find((item) => item.time === input.time);

      if (!slot) throw new Error("Ese horario no esta disponible ese dia. Elige otro.");
      if (slot.status === "taken") throw new Error("Ese horario acaba de ser reservado por otra persona. Elige otro.");
      if (slot.status === "past") throw new Error("Ese horario ya paso. Elige otro.");

      const next = clone(current);
      const record = {
        id: rules.generateId("bk"),
        code: rules.generateCode(next.bookings),
        status: source === "admin" && options.status === "confirmada" ? "confirmada" : "pendiente",
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
      return { state: persist(next), booking: clone(record) };
    },

    async updateBookingStatus(id, status) {
      if (!rules.BOOKING_STATUSES.includes(status)) throw new Error("Estado de reserva invalido.");
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
      return persist(next);
    },

    async deleteBooking(id) {
      const next = freshCopy();
      next.bookings = next.bookings.filter((item) => item.id !== id);
      return persist(next);
    },

    async findBookingByCode(code, phone) {
      const current = reload();
      const normalizedCode = String(code || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
      const phoneDigits = utils.digitsOnly(phone);
      if (!normalizedCode || phoneDigits.length < 7) return null;

      const booking = current.bookings.find((item) => item.code === normalizedCode);
      if (!booking) return null;
      if (utils.digitsOnly(booking.customerPhone).slice(-7) !== phoneDigits.slice(-7)) return null;
      return { ...clone(booking), canCancel: rules.isUpcoming(booking) };
    },

    async cancelBookingByCustomer(code, phone) {
      const found = await provider.findBookingByCode(code, phone);
      if (!found) throw new Error("No encontramos una cita con ese codigo y telefono.");
      if (found.status === "cancelada") throw new Error("Esta cita ya estaba cancelada.");
      if (!found.canCancel) throw new Error("Esta cita ya paso y no se puede cancelar.");

      const next = freshCopy();
      const booking = next.bookings.find((item) => item.id === found.id);
      booking.status = "cancelada";
      booking.cancelledAt = new Date().toISOString();
      booking.cancelledBy = "cliente";
      return { state: persist(next), booking: { ...clone(booking), canCancel: false } };
    },

    async uploadImage(blob) {
      return blobToDataUrl(blob);
    },

    async resetToDefaults() {
      localStorage.removeItem(STORAGE_KEY);
      state = seedState();
      return clone(state);
    },

    getStorageUsage() {
      const raw = localStorage.getItem(STORAGE_KEY) || "";
      return { usedBytes: raw.length, approxLimitBytes: APPROX_QUOTA_BYTES };
    },
  };

  window.RasecStoreProviders = window.RasecStoreProviders || {};
  window.RasecStoreProviders.local = provider;
})();
