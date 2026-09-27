/**
 * Punto unico de acceso a los datos para todas las paginas (`window.RasecStore`).
 *
 * - Si src/supabase-config.js tiene credenciales usa Supabase (store-remote.js):
 *   datos reales compartidos entre dispositivos.
 * - Si no, usa localStorage (store-local.js) para desarrollo sin conexion.
 *
 * Las lecturas (getState, getSlots, etc.) son inmediatas sobre una copia en
 * memoria; las escrituras son asincronas y devuelven promesas.
 */
(function () {
  const rules = window.RasecRules;
  const providers = window.RasecStoreProviders || {};
  const provider = providers.remote || providers.local;

  const listeners = new Set();
  let state = null;
  let initPromise = null;

  function notify(source) {
    const snapshot = rules.clone(state);
    listeners.forEach((listener) => listener(snapshot, { source }));
  }

  function apply(result, source = "local") {
    state = result && result.state !== undefined ? result.state : result;
    notify(source);
    return result;
  }

  function requireState() {
    if (!state) throw new Error("Los datos aun no han cargado.");
    return state;
  }

  provider.onExternalChange((nextState) => {
    state = nextState;
    notify("external");
  });

  const Store = {
    mode: provider.mode,
    SLOT_STEP_MINUTES: rules.SLOT_STEP_MINUTES,
    BOOKING_STATUSES: rules.BOOKING_STATUSES,
    timeToMinutes: rules.timeToMinutes,
    minutesToTime: rules.minutesToTime,

    /** Carga los datos. options.scope: "public" | "admin"; options.bookings: false si la pagina no necesita citas. */
    init(options = {}) {
      if (!initPromise) {
        initPromise = provider.load(options).then((loaded) => {
          state = loaded;
          return rules.clone(state);
        });
        initPromise.catch(() => {
          initPromise = null;
        });
      }
      return initPromise;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getState() {
      return rules.clone(requireState());
    },

    getStorageUsage() {
      return provider.getStorageUsage();
    },

    // ---------- Consultas (inmediatas) ----------

    getMaxBookingDate() {
      return rules.maxBookingDate(requireState());
    },

    getBarberDayStatus(barberId, date) {
      return rules.barberDayStatus(requireState(), barberId, date);
    },

    getDateStatus(barberId, date, options) {
      return rules.dateStatus(requireState(), barberId, date, options);
    },

    getSlots(params) {
      return rules.slotsFor(requireState(), params);
    },

    findConflict(barberId, date, startMinutes, durationMinutes, excludeId) {
      return rules.conflictIn(requireState(), barberId, date, startMinutes, durationMinutes, excludeId);
    },

    isUpcoming(booking) {
      return rules.isUpcoming(booking);
    },

    getUpcomingBookings(filter) {
      return rules.clone(rules.upcomingBookings(requireState(), filter));
    },

    getBookingsOutsideHours(hours) {
      return rules.clone(rules.bookingsOutsideHours(requireState(), hours));
    },

    getBookingsBlockedForBarber(barber) {
      return rules.clone(rules.bookingsBlockedForBarber(requireState(), barber));
    },

    validateHours(hours) {
      rules.validateHours(hours);
    },

    validateBarber(barber) {
      rules.validateBarber(barber);
    },

    // ---------- Escrituras (asincronas) ----------

    async refreshAvailability() {
      apply(await provider.refreshAvailability());
    },

    /** sections: { business?, identity?, media?, hero?, notes?, cta?, settings? } con los campos a cambiar. */
    async updateSiteContent(sections) {
      apply(await provider.updateSiteContent(sections));
    },

    async saveService(service) {
      return apply(await provider.saveService(service)).id;
    },

    async deleteService(id) {
      apply(await provider.deleteService(id));
    },

    async saveBarber(barber) {
      return apply(await provider.saveBarber(barber)).id;
    },

    async deleteBarber(id) {
      apply(await provider.deleteBarber(id));
    },

    async saveHours(hours) {
      apply(await provider.saveHours(hours));
    },

    /** options.source: "web" (cliente) | "admin" (panel); options.status: "confirmada" | "pendiente" (solo admin). */
    async createBooking(input, options) {
      return apply(await provider.createBooking(input, options)).booking;
    },

    async updateBookingStatus(id, status) {
      apply(await provider.updateBookingStatus(id, status));
    },

    async deleteBooking(id) {
      apply(await provider.deleteBooking(id));
    },

    async findBookingByCode(code, phone) {
      return provider.findBookingByCode(code, phone);
    },

    async cancelBookingByCustomer(code, phone) {
      const result = await provider.cancelBookingByCustomer(code, phone);
      if (result.state) apply(result);
      return result.booking;
    },

    async uploadImage(blob) {
      return provider.uploadImage(blob);
    },

    async resetToDefaults() {
      apply(await provider.resetToDefaults());
    },
  };

  window.RasecStore = Store;
})();
