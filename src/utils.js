/**
 * Helpers compartidos entre el sitio publico, la agenda y el admin.
 */
(function () {
  const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];
  const WEEK_ORDER = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];
  const MONEY_FORMATTER = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function toISODate(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function parseISODate(iso) {
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function todayISO() {
    return toISODate(new Date());
  }

  function addDays(iso, days) {
    const date = parseISODate(iso);
    date.setDate(date.getDate() + days);
    return toISODate(date);
  }

  function startOfWeekISO(iso) {
    const date = parseISODate(iso);
    const offset = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - offset);
    return toISODate(date);
  }

  function weekdayLabelFor(date) {
    return WEEKDAYS[date.getDay()];
  }

  function formatTime12h(time) {
    if (!time) return "";
    const [hours, minutes] = time.split(":").map(Number);
    const period = hours >= 12 ? "p. m." : "a. m.";
    const hour12 = ((hours + 11) % 12) + 1;
    return `${hour12}:${pad2(minutes)} ${period}`;
  }

  function formatHourRange(day) {
    if (!day || !day.open || !day.start || !day.end) return "Cerrado";
    return `${formatTime12h(day.start)} - ${formatTime12h(day.end)}`;
  }

  function formatDateLong(iso) {
    return parseISODate(iso).toLocaleDateString("es-CO", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function formatDateShort(iso) {
    return parseISODate(iso).toLocaleDateString("es-CO", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }

  function formatMoneyCOP(value) {
    return MONEY_FORMATTER.format(value);
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function digitsOnly(value) {
    return String(value || "").replace(/\D/g, "");
  }

  // Numeros colombianos de 10 digitos (celulares) necesitan el indicativo 57 para wa.me.
  function toWhatsAppNumber(phone) {
    const digits = digitsOnly(phone);
    return digits.length === 10 ? `57${digits}` : digits;
  }

  function whatsAppLink(phone, message) {
    return `https://wa.me/${toWhatsAppNumber(phone)}?text=${encodeURIComponent(message)}`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => {
      switch (char) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case '"':
          return "&quot;";
        default:
          return "&#39;";
      }
    });
  }

  window.RasecUtils = {
    WEEKDAYS,
    WEEK_ORDER,
    toISODate,
    parseISODate,
    todayISO,
    addDays,
    startOfWeekISO,
    weekdayLabelFor,
    formatTime12h,
    formatHourRange,
    formatDateLong,
    formatDateShort,
    formatMoneyCOP,
    formatBytes,
    digitsOnly,
    toWhatsAppNumber,
    whatsAppLink,
    escapeHtml,
  };
})();
