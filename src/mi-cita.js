(function () {
  const store = window.RasecStore;
  const utils = window.RasecUtils;
  if (!store || !utils) return;

  const { escapeHtml, formatMoneyCOP, formatDateLong, formatTime12h } = utils;
  const $ = (selector) => document.querySelector(selector);

  const STATUS_LABELS = { pendiente: "Pendiente", confirmada: "Confirmada", cancelada: "Cancelada" };
  const STATUS_BADGES = { pendiente: "badge--pending", confirmada: "badge--ok", cancelada: "badge--off" };

  let lookup = null;

  function setBrand() {
    const data = store.getState();
    $("[data-brand-mark]").textContent = data.business.initials;
    $("[data-business-name]").textContent = data.business.name;
  }

  function showError(message) {
    const error = $("[data-lookup-error]");
    error.textContent = message;
    error.hidden = !message;
  }

  function renderResult(booking) {
    const result = $("[data-lookup-result]");
    result.hidden = false;

    const badge = $("[data-result-status]");
    badge.textContent = STATUS_LABELS[booking.status] || booking.status;
    badge.className = `badge ${STATUS_BADGES[booking.status] || ""}`;

    $("[data-result-summary]").innerHTML = `
      <dl>
        <div><dt>Codigo</dt><dd>${escapeHtml(booking.code)}</dd></div>
        <div><dt>Servicio</dt><dd>${escapeHtml(booking.serviceName)} · ${formatMoneyCOP(booking.price)}</dd></div>
        <div><dt>Barbero</dt><dd>${escapeHtml(booking.barberName)}</dd></div>
        <div><dt>Fecha</dt><dd>${escapeHtml(formatDateLong(booking.date))}</dd></div>
        <div><dt>Hora</dt><dd>${escapeHtml(formatTime12h(booking.time))} (${booking.durationMinutes} min)</dd></div>
        <div><dt>Nombre</dt><dd>${escapeHtml(booking.customerName)}</dd></div>
      </dl>
    `;

    const note = $("[data-result-note]");
    let noteText = "";
    if (booking.status === "cancelada") {
      noteText = booking.cancelledBy === "cliente" ? "Cancelaste esta cita." : "La barberia cancelo esta cita. Si tienes dudas, escribenos.";
    } else if (!booking.canCancel) {
      noteText = "Esta cita ya paso.";
    } else if (booking.status === "pendiente") {
      noteText = "Tu cupo esta reservado. La barberia puede confirmarla por WhatsApp.";
    }
    note.textContent = noteText;
    note.hidden = !noteText;

    const canCancel = booking.status !== "cancelada" && booking.canCancel;
    $("[data-cancel-area]").hidden = !canCancel;
    $("[data-cancel-confirm]").hidden = true;
    $("[data-cancel-start]").hidden = false;
    $("[data-rebook]").hidden = canCancel;
  }

  function handleLookup(event) {
    event.preventDefault();
    const code = $("[data-lookup-code]").value;
    const phone = $("[data-lookup-phone]").value;
    const booking = store.findBookingByCode(code, phone);

    if (!booking) {
      lookup = null;
      $("[data-lookup-result]").hidden = true;
      showError("No encontramos una cita con ese codigo y telefono. Revisa que esten bien escritos.");
      return;
    }

    lookup = { code, phone };
    showError("");
    renderResult(booking);
  }

  function handleCancel() {
    if (!lookup) return;
    try {
      store.cancelBookingByCustomer(lookup.code, lookup.phone);
      renderResult(store.findBookingByCode(lookup.code, lookup.phone));
    } catch (error) {
      showError(error.message);
    }
  }

  function init() {
    setBrand();
    const code = new URLSearchParams(location.search).get("code");
    if (code) {
      $("[data-lookup-code]").value = code;
      $("[data-lookup-phone]").focus();
    }

    $("[data-lookup-form]").addEventListener("submit", handleLookup);
    $("[data-cancel-start]").addEventListener("click", () => {
      $("[data-cancel-start]").hidden = true;
      $("[data-cancel-confirm]").hidden = false;
    });
    $("[data-cancel-no]").addEventListener("click", () => {
      $("[data-cancel-start]").hidden = false;
      $("[data-cancel-confirm]").hidden = true;
    });
    $("[data-cancel-yes]").addEventListener("click", handleCancel);

    store.subscribe((nextState, meta) => {
      if (meta.source !== "external" || !lookup) return;
      const booking = store.findBookingByCode(lookup.code, lookup.phone);
      if (booking) renderResult(booking);
    });
  }

  init();
})();
