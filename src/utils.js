/**
 * Helpers compartidos entre el sitio publico, la agenda y el admin.
 */
(function () {
  const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];
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
    const date = parseISODate(iso);
    return date.toLocaleDateString("es-CO", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function formatMoneyCOP(value) {
    return MONEY_FORMATTER.format(value);
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
    toISODate,
    parseISODate,
    weekdayLabelFor,
    formatTime12h,
    formatHourRange,
    formatDateLong,
    formatMoneyCOP,
    escapeHtml,
  };
})();
