/**
 * Reglas de negocio puras (sin guardar nada): disponibilidad, choques de citas y
 * validaciones. Las usan el store (para pintar calendario y horarios) y el
 * proveedor local (como "servidor" de la demo). Con Supabase, las mismas reglas
 * se validan otra vez en la base de datos (database/schema.sql).
 */
(function () {
  const utils = window.RasecUtils;

  const SLOT_STEP_MINUTES = 30;
  const BOOKING_STATUSES = ["pendiente", "confirmada", "cancelada"];
  const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

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

  function generateId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function generateCode(bookings) {
    let code;
    do {
      code = "";
      for (let i = 0; i < 6; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    } while (bookings.some((booking) => booking.code === code));
    return code;
  }

  function findService(state, id) {
    return state.services.find((service) => service.id === id);
  }

  function findBarber(state, id) {
    return state.barbers.find((barber) => barber.id === id);
  }

  function weekdayOf(iso) {
    return utils.weekdayLabelFor(utils.parseISODate(iso));
  }

  function dayHoursFor(state, iso) {
    return state.hours.find((day) => day.day === weekdayOf(iso)) || null;
  }

  function maxBookingDate(state) {
    return utils.addDays(utils.todayISO(), Number(state.settings.bookingWindowDays) || 30);
  }

  function timeOffFor(barber, iso) {
    return (barber.timeOff || []).find((range) => range.start <= iso && iso <= range.end) || null;
  }

  function barberDayStatus(state, barberId, iso) {
    const barber = findBarber(state, barberId);
    if (!barber) return { working: false, reason: "unknown" };
    const day = dayHoursFor(state, iso);
    if (!day || !day.open) return { working: false, reason: "closed" };
    if ((barber.daysOff || []).includes(weekdayOf(iso))) return { working: false, reason: "day-off" };
    const off = timeOffFor(barber, iso);
    if (off) return { working: false, reason: "time-off", note: off.reason || "" };
    return { working: true, reason: null };
  }

  function dateStatus(state, barberId, iso, options = {}) {
    if (!options.allowPast && iso < utils.todayISO()) return { ok: false, reason: "past" };
    if (!options.ignoreWindow && iso > maxBookingDate(state)) return { ok: false, reason: "beyond-window" };
    const day = barberDayStatus(state, barberId, iso);
    return day.working ? { ok: true, reason: null } : { ok: false, reason: day.reason, note: day.note };
  }

  function conflictIn(state, barberId, iso, startMinutes, durationMinutes, excludeId) {
    return state.bookings.some((booking) => {
      if (booking.barberId !== barberId || booking.date !== iso) return false;
      if (booking.status === "cancelada") return false;
      if (excludeId && booking.id === excludeId) return false;
      const existingStart = timeToMinutes(booking.time);
      const existingEnd = existingStart + booking.durationMinutes;
      return startMinutes < existingEnd && existingStart < startMinutes + durationMinutes;
    });
  }

  function slotsFor(state, { barberId, serviceId, date, allowPast = false, ignoreWindow = false }) {
    const service = findService(state, serviceId);
    if (!service || !barberId || !date) return [];
    if (!dateStatus(state, barberId, date, { allowPast, ignoreWindow }).ok) return [];

    const day = dayHoursFor(state, date);
    const open = timeToMinutes(day.start);
    const close = timeToMinutes(day.end);
    const today = utils.todayISO();
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const slots = [];
    for (let cursor = open; cursor + service.durationMinutes <= close; cursor += SLOT_STEP_MINUTES) {
      const past = date < today || (date === today && cursor <= nowMinutes);
      let status = "free";
      if (conflictIn(state, barberId, date, cursor, service.durationMinutes)) status = "taken";
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

  function upcomingBookings(state, { serviceId, barberId } = {}) {
    return state.bookings.filter(
      (booking) =>
        isUpcoming(booking) && (!serviceId || booking.serviceId === serviceId) && (!barberId || booking.barberId === barberId)
    );
  }

  // Citas futuras que quedarian fuera de un horario nuevo (dia cerrado u horas recortadas).
  function bookingsOutsideHours(state, hours) {
    return state.bookings.filter((booking) => {
      if (!isUpcoming(booking)) return false;
      const day = hours.find((item) => item.day === weekdayOf(booking.date));
      if (!day || !day.open) return true;
      const start = timeToMinutes(booking.time);
      return start < timeToMinutes(day.start) || start + booking.durationMinutes > timeToMinutes(day.end);
    });
  }

  // Citas futuras de un barbero que chocan con sus nuevos descansos, ausencias o servicios.
  function bookingsBlockedForBarber(state, barber) {
    if (!barber.id) return [];
    return state.bookings.filter((booking) => {
      if (booking.barberId !== barber.id || !isUpcoming(booking)) return false;
      if ((barber.daysOff || []).includes(weekdayOf(booking.date))) return true;
      if (timeOffFor(barber, booking.date)) return true;
      return !(barber.serviceIds || []).includes(booking.serviceId);
    });
  }

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

  function validateSettings(settings) {
    const days = Number(settings.bookingWindowDays);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      throw new Error("Los dias de anticipacion deben ser un numero entero entre 1 y 365.");
    }
  }

  window.RasecRules = {
    SLOT_STEP_MINUTES,
    BOOKING_STATUSES,
    clone,
    timeToMinutes,
    minutesToTime,
    generateId,
    generateCode,
    findService,
    findBarber,
    weekdayOf,
    maxBookingDate,
    timeOffFor,
    barberDayStatus,
    dateStatus,
    conflictIn,
    slotsFor,
    isUpcoming,
    upcomingBookings,
    bookingsOutsideHours,
    bookingsBlockedForBarber,
    validateService,
    validateBarber,
    validateHours,
    validateSettings,
  };
})();
