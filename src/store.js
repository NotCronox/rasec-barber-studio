/**
 * Capa de persistencia del sitio.
 *
 * Hoy guarda todo en localStorage (demo local, sin backend). El resto del
 * codigo (app.js, booking.js, admin.js) solo habla con `window.RasecStore`,
 * nunca con localStorage directamente. Cuando este proyecto pase a un backend
 * real (por ejemplo Supabase), solo hay que reescribir este archivo para que
 * las mismas funciones hagan fetch() a una API en vez de leer/escribir
 * localStorage: el resto de la app no deberia necesitar cambios.
 */
(function () {
  const STORAGE_KEY = "rasec_barberia_state_v1";
  const listeners = new Set();

  let state = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function notify() {
    listeners.forEach((listener) => listener(clone(state)));
  }

  function persist(nextState) {
    state = nextState;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    notify();
  }

  function generateId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
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

  function seedState() {
    const defaults = window.RASEC_BARBERIA_DATA;
    const seeded = {
      business: clone(defaults.business),
      identity: clone(defaults.identity),
      media: clone(defaults.media),
      hero: clone(defaults.hero),
      services: clone(defaults.services),
      barbers: clone(defaults.barbers),
      hours: clone(defaults.hours),
      notes: clone(defaults.notes),
      cta: clone(defaults.cta),
      bookings: [],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.business || !Array.isArray(parsed.services)) {
        throw new Error("Forma de estado invalida");
      }
      if (!Array.isArray(parsed.bookings)) parsed.bookings = [];
      return parsed;
    } catch (error) {
      console.warn("Estado invalido en localStorage, se reinicia con los datos de ejemplo.", error);
      return seedState();
    }
  }

  state = loadState();

  const Store = {
    STORAGE_KEY,
    timeToMinutes,
    minutesToTime,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getState() {
      return clone(state);
    },

    resetToDefaults() {
      localStorage.removeItem(STORAGE_KEY);
      state = seedState();
      notify();
      return clone(state);
    },

    updateBusiness(partial) {
      const next = clone(state);
      Object.assign(next.business, partial);
      persist(next);
    },

    updateHero(partial) {
      const next = clone(state);
      Object.assign(next.hero, partial);
      persist(next);
    },

    updateNotes(partial) {
      const next = clone(state);
      Object.assign(next.notes, partial);
      persist(next);
    },

    updateCta(partial) {
      const next = clone(state);
      Object.assign(next.cta, partial);
      persist(next);
    },

    saveService(service) {
      const next = clone(state);
      const record = { ...service };
      if (record.id) {
        const index = next.services.findIndex((item) => item.id === record.id);
        if (index >= 0) {
          next.services[index] = record;
        } else {
          next.services.push(record);
        }
      } else {
        record.id = generateId("srv");
        next.services.push(record);
      }
      persist(next);
      return record.id;
    },

    deleteService(id) {
      const next = clone(state);
      next.services = next.services.filter((item) => item.id !== id);
      persist(next);
    },

    saveBarber(barber) {
      const next = clone(state);
      const record = { ...barber };
      if (!Array.isArray(record.gallery)) record.gallery = [];
      if (record.id) {
        const index = next.barbers.findIndex((item) => item.id === record.id);
        if (index >= 0) {
          next.barbers[index] = record;
        } else {
          next.barbers.push(record);
        }
      } else {
        record.id = generateId("brb");
        next.barbers.push(record);
      }
      persist(next);
      return record.id;
    },

    deleteBarber(id) {
      const next = clone(state);
      next.barbers = next.barbers.filter((item) => item.id !== id);
      persist(next);
    },

    saveHours(hours) {
      const next = clone(state);
      next.hours = hours;
      persist(next);
    },

    findConflict(barberId, dateISO, startMinutes, durationMinutes, excludeId) {
      return state.bookings.some((booking) => {
        if (booking.barberId !== barberId) return false;
        if (booking.date !== dateISO) return false;
        if (booking.status === "cancelada") return false;
        if (excludeId && booking.id === excludeId) return false;
        const existingStart = timeToMinutes(booking.time);
        const existingEnd = existingStart + booking.durationMinutes;
        const newEnd = startMinutes + durationMinutes;
        return startMinutes < existingEnd && existingStart < newEnd;
      });
    },

    createBooking(booking) {
      const startMinutes = timeToMinutes(booking.time);
      if (this.findConflict(booking.barberId, booking.date, startMinutes, booking.durationMinutes)) {
        throw new Error("Ese horario ya no esta disponible. Elige otro.");
      }
      const next = clone(state);
      const record = {
        id: generateId("bk"),
        status: "pendiente",
        createdAt: new Date().toISOString(),
        ...booking,
      };
      next.bookings.push(record);
      persist(next);
      return record;
    },

    updateBookingStatus(id, status) {
      const next = clone(state);
      const booking = next.bookings.find((item) => item.id === id);
      if (booking) booking.status = status;
      persist(next);
    },

    deleteBooking(id) {
      const next = clone(state);
      next.bookings = next.bookings.filter((item) => item.id !== id);
      persist(next);
    },
  };

  window.RasecStore = Store;
})();
