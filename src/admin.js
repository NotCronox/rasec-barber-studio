(function () {
  const store = window.RasecStore;
  const auth = window.RasecAuth;
  const utils = window.RasecUtils;
  if (!store || !auth || !utils) return;

  const {
    escapeHtml,
    formatMoneyCOP,
    formatDateLong,
    formatDateShort,
    formatTime12h,
    formatBytes,
    parseISODate,
    todayISO,
    addDays,
    startOfWeekISO,
    weekdayLabelFor,
    whatsAppLink,
    WEEK_ORDER,
  } = utils;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const STATUS_LABELS = { pendiente: "Pendiente", confirmada: "Confirmada", cancelada: "Cancelada" };
  const STATUS_BADGES = { pendiente: "badge--pending", confirmada: "badge--ok", cancelada: "badge--off" };
  const FORM_TABS = ["negocio", "horarios", "cuenta"];
  const AGENDA_ROW_MINUTES = 15;
  const AGENDA_ROW_PX = 20;

  let data = null;
  let activeTab = "resumen";
  let agendaDate = todayISO();
  let confirmResolver = null;
  let bookingFiltersInitialized = false;

  // ==================================================================
  // Utilidades de interfaz
  // ==================================================================

  function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function pluralize(count, singular, plural) {
    return `${count} ${count === 1 ? singular : plural}`;
  }

  function formatDayMonth(iso) {
    return parseISODate(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
  }

  function byDateTime(a, b) {
    return (a.date + a.time).localeCompare(b.date + b.time);
  }

  function statusBadge(status) {
    return `<span class="badge ${STATUS_BADGES[status] || ""}">${STATUS_LABELS[status] || escapeHtml(status)}</span>`;
  }

  function serviceLabel(booking) {
    const service = data.services.find((item) => item.id === booking.serviceId);
    return service ? service.name : booking.serviceName;
  }

  function barberLabel(booking) {
    const barber = data.barbers.find((item) => item.id === booking.barberId);
    return barber ? barber.name : booking.barberName;
  }

  function dayStatusText(status, barberName) {
    switch (status.reason) {
      case "closed":
        return "La barberia esta cerrada ese dia";
      case "day-off":
        return `${barberName} descansa ese dia`;
      case "time-off":
        return `${barberName} esta ausente ese dia${status.note ? ` (${status.note})` : ""}`;
      default:
        return "No disponible ese dia";
    }
  }

  function toast(message, type = "success") {
    const el = $("[data-toast]");
    el.textContent = message;
    el.className = `toast toast--${type}`;
    el.hidden = false;
    clearTimeout(el._hideTimeout);
    el._hideTimeout = setTimeout(() => {
      el.hidden = true;
    }, type === "error" ? 4500 : 2500);
  }

  async function attempt(action, successMessage) {
    try {
      const result = await action();
      data = store.getState();
      if (successMessage) toast(successMessage);
      return { ok: true, result };
    } catch (error) {
      toast(error.message, "error");
      return { ok: false };
    }
  }

  // Deshabilita un boton mientras corre una operacion (evita dobles envios).
  async function withBusy(button, busyLabel, action) {
    if (!button) return action();
    const label = button.textContent;
    button.disabled = true;
    button.textContent = busyLabel;
    try {
      return await action();
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  }

  function confirmDialog({ title, message, confirmLabel = "Confirmar", danger = true }) {
    const dialog = $("[data-confirm]");
    const accept = $("[data-confirm-accept]");
    $("[data-confirm-title]").textContent = title;
    $("[data-confirm-message]").textContent = message;
    accept.textContent = confirmLabel;
    accept.className = `button ${danger ? "button--danger-solid" : "button--primary"}`;
    dialog.hidden = false;
    dialog.classList.add("is-open");
    accept.focus();
    return new Promise((resolve) => {
      confirmResolver = resolve;
    });
  }

  function settleConfirm(result) {
    const dialog = $("[data-confirm]");
    dialog.hidden = true;
    dialog.classList.remove("is-open");
    const resolve = confirmResolver;
    confirmResolver = null;
    if (resolve) resolve(result);
  }

  function openModal({ title, bodyHtml, onSubmit, wide = false }) {
    const modal = $("[data-modal]");
    $("[data-modal-title]").textContent = title;
    $("[data-modal-body]").innerHTML = bodyHtml;
    $(".modal__panel", modal).classList.toggle("modal__panel--wide", wide);
    modal.hidden = false;
    modal.classList.add("is-open");

    const form = $("[data-modal-form]", modal);
    if (form && onSubmit) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        onSubmit(form);
      });
    }
    return form;
  }

  function closeModal() {
    const modal = $("[data-modal]");
    modal.hidden = true;
    modal.classList.remove("is-open");
    $("[data-modal-body]").innerHTML = "";
  }

  function isModalOpen() {
    return !$("[data-modal]").hidden;
  }

  function showModalError(message) {
    const error = $("[data-modal-error]", $("[data-modal-body]"));
    if (!error) {
      toast(message, "error");
      return;
    }
    error.textContent = message;
    error.hidden = false;
  }

  // ==================================================================
  // Fotos: campo con URL + subida comprimida
  // ==================================================================

  function imageFieldHtml({ field, value, label, required = true }) {
    return `
      <div class="image-field admin-form__full" data-image-field>
        <span class="image-field__label">${escapeHtml(label)}</span>
        <div class="image-field__row">
          <img class="image-field__preview" data-image-preview src="${escapeHtml(value)}" alt="" ${value ? "" : "hidden"} />
          <input type="text" data-field="${field}" data-image-input value="${escapeHtml(value)}" placeholder="Pega una URL o sube una foto" ${required ? "required" : ""} />
          <label class="button button--small button--outline-dark image-field__upload">
            Subir foto
            <input type="file" accept="image/*" class="visually-hidden" data-image-file />
          </label>
        </div>
        <small class="image-field__status" data-image-status></small>
      </div>
    `;
  }

  function compressImage(file, maxSize = 1000, quality = 0.78) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No se pudo procesar la foto."))), "image/jpeg", quality);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("No se pudo leer la foto."));
      };
      img.src = url;
    });
  }

  async function handleImageFile(fileInput) {
    const file = fileInput.files[0];
    if (!file) return;
    const container = fileInput.closest("[data-image-field], .admin-gallery-row");
    const target = $("[data-image-input]", container);
    const preview = $("[data-image-preview]", container);
    const status = $("[data-image-status]", container);

    if (!file.type.startsWith("image/")) {
      toast("Ese archivo no es una imagen.", "error");
      fileInput.value = "";
      return;
    }

    if (status) status.textContent = "Subiendo foto...";
    try {
      const blob = await compressImage(file);
      const url = await store.uploadImage(blob);
      target.value = url;
      preview.src = url;
      preview.hidden = false;
      if (status) status.textContent = `Foto subida (${formatBytes(blob.size)}). Recuerda guardar.`;
    } catch (error) {
      if (status) status.textContent = "";
      toast(error.message, "error");
    }
    fileInput.value = "";
  }

  // ==================================================================
  // Sesion y navegacion
  // ==================================================================

  function refreshBrand() {
    $("[data-business-name]").textContent = data.business.name;
    $("[data-brand-mark]").textContent = data.business.initials;
  }

  function showLogin(message = "") {
    $("[data-admin-login]").hidden = false;
    $("[data-admin-shell]").hidden = true;
    $("[data-login-email-field]").hidden = !auth.requiresEmail;
    $("[data-login-email]").required = auth.requiresEmail;
    $("[data-login-hint]").hidden = auth.mode !== "local" || auth.hasCustomPassword();
    // En el sitio de demostracion la contrasena ya viene escrita: basta con pulsar Entrar.
    if (window.RASEC_DEMO_SITE && !auth.hasCustomPassword()) $("[data-login-password]").value = auth.DEFAULT_PASSWORD;
    const error = $("[data-login-error]");
    error.textContent = message;
    error.hidden = !message;
  }

  // Carga los datos del panel (con Supabase, incluye todas las reservas) y lo muestra.
  async function showShell() {
    await store.init({ scope: "admin" });
    data = store.getState();
    $("[data-admin-login]").hidden = true;
    $("[data-admin-shell]").hidden = false;
    refreshBrand();
    switchTab("resumen");
  }

  function initLoginForm() {
    const form = $("[data-login-form]");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const emailField = $("[data-login-email]");
      const passwordField = $("[data-login-password]");
      const error = $("[data-login-error]");
      error.hidden = true;

      await withBusy($("button[type=submit]", form), "Entrando...", async () => {
        try {
          await auth.login(emailField.value, passwordField.value);
          passwordField.value = "";
          await showShell();
        } catch (loginError) {
          error.textContent = loginError.message;
          error.hidden = false;
        }
      });
    });
  }

  function switchTab(tab) {
    activeTab = tab;
    $$("[data-admin-tab]").forEach((btn) => btn.classList.toggle("is-active", btn.dataset.adminTab === tab));
    $$("[data-admin-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.adminPanel !== tab;
    });
    renderActiveTab();
  }

  function renderActiveTab() {
    data = store.getState();
    const renderers = {
      resumen: renderResumen,
      agenda: renderAgenda,
      reservas: renderBookingsTab,
      servicios: renderServicesTable,
      barberos: renderBarbersTable,
      horarios: renderHoursForm,
      negocio: populateBusinessForm,
      cuenta: resetPasswordForm,
    };
    renderers[activeTab]();
  }

  // Refresca la vista actual sin pisar formularios que el admin este editando.
  function refreshAfterChange() {
    data = store.getState();
    if (!FORM_TABS.includes(activeTab)) renderActiveTab();
  }

  // ==================================================================
  // Resumen
  // ==================================================================

  function upcomingItemHtml(booking) {
    return `
      <li>
        <button type="button" class="admin-upcoming-item" data-open-booking="${escapeHtml(booking.id)}">
          <span class="admin-upcoming-item__when">
            <strong>${escapeHtml(capitalize(formatDateShort(booking.date)))}</strong>
            <span>${escapeHtml(formatTime12h(booking.time))}</span>
          </span>
          <span class="admin-upcoming-item__what">
            <strong>${escapeHtml(booking.customerName)}</strong>
            <span>${escapeHtml(serviceLabel(booking))} con ${escapeHtml(barberLabel(booking))}</span>
          </span>
          ${statusBadge(booking.status)}
        </button>
      </li>
    `;
  }

  function renderResumen() {
    const today = todayISO();
    const weekEnd = addDays(today, 7);
    const active = data.bookings.filter((booking) => booking.status !== "cancelada");
    const upcoming = active.filter((booking) => store.isUpcoming(booking)).sort(byDateTime);

    const stats = [
      { label: "Citas hoy", value: active.filter((booking) => booking.date === today).length },
      { label: "Proximos 7 dias", value: active.filter((booking) => booking.date >= today && booking.date <= weekEnd).length },
      { label: "Pendientes por confirmar", value: upcoming.filter((booking) => booking.status === "pendiente").length },
      { label: "Barberos activos", value: data.barbers.filter((barber) => barber.available).length },
    ];

    $("[data-admin-stats]").innerHTML = stats
      .map((stat) => `<article class="admin-stat"><strong>${stat.value}</strong><span>${escapeHtml(stat.label)}</span></article>`)
      .join("");

    $("[data-admin-upcoming]").innerHTML = upcoming.length
      ? `<ul class="admin-upcoming-list">${upcoming.slice(0, 6).map(upcomingItemHtml).join("")}</ul>`
      : `<p class="admin-empty">No hay citas proximas.</p>`;

    const isLocal = store.mode === "local";
    $("[data-local-data]").hidden = !isLocal;
    $("[data-remote-data]").hidden = isLocal;
    if (isLocal) {
      const usage = store.getStorageUsage();
      $("[data-storage-usage]").textContent = `Espacio usado: ${formatBytes(usage.usedBytes)} de aprox. ${formatBytes(usage.approxLimitBytes)}.`;
    }
  }

  // ==================================================================
  // Agenda
  // ==================================================================

  function renderAgenda() {
    $("[data-agenda-label]").textContent = capitalize(formatDateLong(agendaDate));
    $("[data-agenda-date]").value = agendaDate;
    renderAgendaWeek();
    renderAgendaGrid();
  }

  function renderAgendaWeek() {
    const start = startOfWeekISO(agendaDate);
    const today = todayISO();

    $("[data-agenda-week]").innerHTML = Array.from({ length: 7 }, (_, index) => {
      const iso = addDays(start, index);
      const date = parseISODate(iso);
      const hours = data.hours.find((day) => day.day === weekdayLabelFor(date));
      const count = data.bookings.filter((booking) => booking.date === iso && booking.status !== "cancelada").length;
      const closed = !hours || !hours.open;
      const detail = count ? pluralize(count, "cita", "citas") : closed ? "Cerrado" : "Sin citas";
      const classes = ["agenda-week__day", iso === agendaDate ? "is-selected" : "", iso === today ? "is-today" : "", closed ? "is-closed" : ""].join(" ");

      return `
        <button type="button" class="${classes}" data-agenda-day="${iso}">
          <span>${escapeHtml(date.toLocaleDateString("es-CO", { weekday: "short" }))}</span>
          <strong>${date.getDate()}</strong>
          <small>${escapeHtml(detail)}</small>
        </button>
      `;
    }).join("");
  }

  function agendaColumnStatus(barber) {
    if (!barber.available) return { working: false, label: "Pausado" };
    const status = store.getBarberDayStatus(barber.id, agendaDate);
    if (status.working) return { working: true, label: "" };
    const labels = { closed: "Cerrado", "day-off": "Descansa", "time-off": status.note ? `Ausente · ${status.note}` : "Ausente" };
    return { working: false, label: labels[status.reason] || "No disponible" };
  }

  function renderAgendaGrid() {
    const container = $("[data-agenda-body]");
    const extra = $("[data-agenda-extra]");
    const toMin = store.timeToMinutes;
    const toTime = store.minutesToTime;

    const dayHours = data.hours.find((day) => day.day === weekdayLabelFor(parseISODate(agendaDate)));
    const isOpen = Boolean(dayHours && dayHours.open);
    const dayBookings = data.bookings.filter((booking) => booking.date === agendaDate);
    const active = dayBookings.filter((booking) => booking.status !== "cancelada");
    const barbers = data.barbers.filter((barber) => barber.available || active.some((booking) => booking.barberId === barber.id));

    let startMin = isOpen ? toMin(dayHours.start) : null;
    let endMin = isOpen ? toMin(dayHours.end) : null;
    active.forEach((booking) => {
      const start = toMin(booking.time);
      startMin = startMin === null ? start : Math.min(startMin, start);
      endMin = endMin === null ? start + booking.durationMinutes : Math.max(endMin, start + booking.durationMinutes);
    });

    if (startMin === null) {
      container.innerHTML = `<div class="agenda-empty">La barberia esta cerrada este dia y no hay citas registradas.</div>`;
    } else if (!barbers.length) {
      container.innerHTML = `<div class="agenda-empty">No hay barberos activos. Activa o agrega uno en la pestana Barberos.</div>`;
    } else {
      startMin = Math.floor(startMin / 30) * 30;
      endMin = Math.ceil(endMin / 30) * 30;
      container.innerHTML = agendaGridHtml({ barbers, active, dayHours, isOpen, startMin, endMin, toMin, toTime });
    }

    const cancelled = dayBookings.filter((booking) => booking.status === "cancelada");
    const orphans = active.filter((booking) => !barbers.some((barber) => barber.id === booking.barberId));
    extra.innerHTML = [
      orphans.length ? agendaListHtml("Citas de barberos eliminados", orphans) : "",
      cancelled.length ? agendaListHtml("Canceladas este dia", cancelled) : "",
    ].join("");
  }

  function agendaListHtml(title, bookings) {
    return `
      <div class="admin-block agenda-extra">
        <h2>${escapeHtml(title)}</h2>
        <ul class="admin-upcoming-list">${bookings.sort(byDateTime).map(upcomingItemHtml).join("")}</ul>
      </div>
    `;
  }

  function agendaGridHtml({ barbers, active, dayHours, isOpen, startMin, endMin, toMin, toTime }) {
    const rows = (endMin - startMin) / AGENDA_ROW_MINUTES;
    const rowFor = (minutes) => 2 + Math.floor((minutes - startMin) / AGENDA_ROW_MINUTES);
    const today = todayISO();
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const openStart = isOpen ? toMin(dayHours.start) : 0;
    const openEnd = isOpen ? toMin(dayHours.end) : 0;

    let html = `<div class="agenda-grid" style="grid-template-columns: 76px repeat(${barbers.length}, minmax(170px, 1fr)); grid-template-rows: auto repeat(${rows}, ${AGENDA_ROW_PX}px);">`;
    html += `<div class="agenda-grid__corner" style="grid-row: 1; grid-column: 1;"></div>`;

    barbers.forEach((barber, index) => {
      const status = agendaColumnStatus(barber);
      html += `
        <div class="agenda-grid__head ${status.working ? "" : "is-off"}" style="grid-row: 1; grid-column: ${index + 2};">
          <strong>${escapeHtml(barber.name)}</strong>
          ${status.label ? `<small>${escapeHtml(status.label)}</small>` : ""}
        </div>
      `;
    });

    for (let minutes = startMin; minutes < endMin; minutes += 30) {
      html += `<div class="agenda-grid__time" style="grid-row: ${rowFor(minutes)} / span 2; grid-column: 1;">${formatTime12h(toTime(minutes))}</div>`;
    }

    barbers.forEach((barber, index) => {
      const working = agendaColumnStatus(barber).working;
      for (let minutes = startMin; minutes < endMin; minutes += 30) {
        const style = `grid-row: ${rowFor(minutes)} / span 2; grid-column: ${index + 2};`;
        const inHours = isOpen && minutes >= openStart && minutes < openEnd;
        const past = agendaDate < today || (agendaDate === today && minutes + 30 <= nowMinutes);
        if (working && inHours) {
          const time = toTime(minutes);
          html += `
            <button type="button" class="agenda-slot ${past ? "is-past" : ""}" style="${style}"
              data-agenda-slot data-barber="${escapeHtml(barber.id)}" data-time="${time}"
              title="Agendar ${formatTime12h(time)} con ${escapeHtml(barber.name)}"><span>+ Agendar</span></button>
          `;
        } else {
          html += `<div class="agenda-slot agenda-slot--off" style="${style}"></div>`;
        }
      }
    });

    active.forEach((booking) => {
      const column = barbers.findIndex((barber) => barber.id === booking.barberId);
      if (column < 0) return;
      const start = toMin(booking.time);
      const rowStart = rowFor(start);
      const span = Math.max(1, Math.ceil((start + booking.durationMinutes - startMin) / AGENDA_ROW_MINUTES) - (rowStart - 2));
      const end = toTime(start + booking.durationMinutes);
      html += `
        <button type="button" class="agenda-booking agenda-booking--${booking.status}"
          style="grid-row: ${rowStart} / span ${span}; grid-column: ${column + 2};"
          data-open-booking="${escapeHtml(booking.id)}">
          <strong>${escapeHtml(formatTime12h(booking.time))} – ${escapeHtml(formatTime12h(end))}</strong>
          <span>${escapeHtml(booking.customerName)}</span>
          <small>${escapeHtml(serviceLabel(booking))}</small>
        </button>
      `;
    });

    if (agendaDate === today && nowMinutes >= startMin && nowMinutes < endMin) {
      const offset = ((nowMinutes - startMin) % AGENDA_ROW_MINUTES) * (AGENDA_ROW_PX / AGENDA_ROW_MINUTES);
      html += `<div class="agenda-now" style="grid-row: ${rowFor(nowMinutes)}; grid-column: 2 / -1; margin-top: ${offset}px;"></div>`;
    }

    html += `</div>`;
    return html;
  }

  // ==================================================================
  // Detalle de cita
  // ==================================================================

  function openBookingDetail(id) {
    const booking = data.bookings.find((item) => item.id === id);
    if (!booking) {
      toast("Esa cita ya no existe.", "error");
      return;
    }

    const when = `${formatDateLong(booking.date)} a las ${formatTime12h(booking.time)}`;
    const messages = {
      pendiente: `Hola ${booking.customerName}, te escribimos de ${data.business.name} para confirmar tu cita de ${serviceLabel(booking)} con ${barberLabel(booking)} el ${when}. Codigo: ${booking.code}.`,
      confirmada: `Hola ${booking.customerName}, tu cita en ${data.business.name} esta confirmada: ${serviceLabel(booking)} con ${barberLabel(booking)} el ${when}. Codigo: ${booking.code}.`,
      cancelada: `Hola ${booking.customerName}, te escribimos de ${data.business.name}: tu cita del ${when} quedo cancelada. Si quieres, puedes agendar una nueva en nuestra pagina.`,
    };
    const whatsapp = booking.customerPhone ? whatsAppLink(booking.customerPhone, messages[booking.status]) : "";
    const origin = booking.source === "admin" ? "Creada desde el panel" : "Reservada en la web";
    const cancelledBy = booking.cancelledBy === "cliente" ? "el cliente" : "la barberia";

    openModal({
      title: `Cita ${booking.code}`,
      bodyHtml: `
        <dl class="detail-list">
          <div><dt>Estado</dt><dd>${statusBadge(booking.status)}</dd></div>
          <div><dt>Cliente</dt><dd>${escapeHtml(booking.customerName)}</dd></div>
          <div><dt>Telefono</dt><dd>${escapeHtml(booking.customerPhone || "Sin telefono")}</dd></div>
          <div><dt>Servicio</dt><dd>${escapeHtml(serviceLabel(booking))} · ${formatMoneyCOP(booking.price)}</dd></div>
          <div><dt>Barbero</dt><dd>${escapeHtml(barberLabel(booking))}</dd></div>
          <div><dt>Fecha</dt><dd>${escapeHtml(capitalize(formatDateLong(booking.date)))}</dd></div>
          <div><dt>Hora</dt><dd>${escapeHtml(formatTime12h(booking.time))} (${booking.durationMinutes} min)</dd></div>
          ${booking.notes ? `<div><dt>Notas</dt><dd>${escapeHtml(booking.notes)}</dd></div>` : ""}
          <div><dt>Origen</dt><dd>${origin}</dd></div>
          ${booking.status === "cancelada" && booking.cancelledBy ? `<div><dt>Cancelada por</dt><dd>${cancelledBy}</dd></div>` : ""}
        </dl>
        <div class="detail-actions">
          <label>
            Cambiar estado
            <select data-detail-status="${escapeHtml(booking.id)}">
              ${store.BOOKING_STATUSES.map((status) => `<option value="${status}" ${booking.status === status ? "selected" : ""}>${STATUS_LABELS[status]}</option>`).join("")}
            </select>
          </label>
          ${whatsapp ? `<a class="button button--small button--outline-dark" href="${escapeHtml(whatsapp)}" target="_blank" rel="noopener">Escribir por WhatsApp</a>` : ""}
          <button type="button" class="admin-link-button admin-link-button--danger" data-delete-booking="${escapeHtml(booking.id)}">Eliminar cita</button>
        </div>
      `,
    });
  }

  async function deleteBookingFlow(id) {
    const booking = data.bookings.find((item) => item.id === id);
    if (!booking) return;
    const ok = await confirmDialog({
      title: "Eliminar cita",
      message: `Se borrara la cita ${booking.code} de ${booking.customerName}. Si solo no va a venir, es mejor marcarla como cancelada para conservar el historial.`,
      confirmLabel: "Eliminar",
    });
    if (!ok) return;
    if ((await attempt(() => store.deleteBooking(id), "Cita eliminada")).ok) {
      if (isModalOpen()) closeModal();
      refreshAfterChange();
    }
  }

  // ==================================================================
  // Nueva cita (manual)
  // ==================================================================

  function openNewBookingModal(prefill = {}) {
    const barbers = data.barbers.filter((barber) => barber.available);
    if (!barbers.length) {
      toast("Primero agrega o activa un barbero.", "error");
      return;
    }
    const barberId = barbers.some((barber) => barber.id === prefill.barberId) ? prefill.barberId : barbers[0].id;
    const date = prefill.date || todayISO();

    const form = openModal({
      title: "Nueva cita",
      bodyHtml: `
        <form data-modal-form data-new-booking-form class="admin-form admin-form--modal">
          <label>Cliente <input data-field="customerName" required minlength="2" autocomplete="off" /></label>
          <label>Telefono <input type="tel" data-field="customerPhone" placeholder="Opcional" autocomplete="off" /></label>
          <label>
            Barbero
            <select data-field="barberId">
              ${barbers.map((barber) => `<option value="${escapeHtml(barber.id)}" ${barber.id === barberId ? "selected" : ""}>${escapeHtml(barber.name)}</option>`).join("")}
            </select>
          </label>
          <label>Servicio <select data-field="serviceId"></select></label>
          <label>Fecha <input type="date" data-field="date" value="${date}" required /></label>
          <label>Hora <select data-field="time"></select></label>
          <label>
            Estado
            <select data-field="status">
              <option value="confirmada" selected>Confirmada</option>
              <option value="pendiente">Pendiente</option>
            </select>
          </label>
          <label class="admin-form__full">Notas <textarea data-field="notes" rows="2" placeholder="Ej: llego sin cita, pidio el fade bajo"></textarea></label>
          <p class="admin-form__error admin-form__full" data-modal-error hidden></p>
          <div class="admin-form__actions admin-form__full">
            <button type="submit" class="button button--primary">Guardar cita</button>
          </div>
        </form>
      `,
      onSubmit: submitNewBooking,
    });

    refreshNewBookingOptions(form, prefill.time);
    $('[data-field="customerName"]', form).focus();
  }

  function refreshNewBookingOptions(form, preferredTime) {
    const field = (key) => $(`[data-field="${key}"]`, form);
    const barber = data.barbers.find((item) => item.id === field("barberId").value);
    const serviceSelect = field("serviceId");
    const timeSelect = field("time");
    const currentService = serviceSelect.value;
    const wantedTime = preferredTime || timeSelect.value;

    const services = barber ? data.services.filter((service) => barber.serviceIds.includes(service.id)) : [];
    serviceSelect.innerHTML = services.length
      ? services
          .map(
            (service) =>
              `<option value="${escapeHtml(service.id)}" ${service.id === currentService ? "selected" : ""}>${escapeHtml(service.name)} (${service.durationMinutes} min)${service.available ? "" : " · pausado"}</option>`
          )
          .join("")
      : `<option value="">Este barbero no tiene servicios asignados</option>`;

    const serviceId = serviceSelect.value;
    const date = field("date").value;
    if (!barber || !serviceId || !date) {
      timeSelect.innerHTML = `<option value="">Elige servicio y fecha</option>`;
      return;
    }

    const status = store.getDateStatus(barber.id, date, { allowPast: true, ignoreWindow: true });
    if (!status.ok) {
      timeSelect.innerHTML = `<option value="">${escapeHtml(dayStatusText(status, barber.name))}</option>`;
      return;
    }

    const slots = store.getSlots({ barberId: barber.id, serviceId, date, allowPast: true, ignoreWindow: true });
    const free = slots.filter((slot) => slot.status === "free");
    if (!free.length) {
      timeSelect.innerHTML = `<option value="">Sin horarios libres ese dia</option>`;
      return;
    }

    timeSelect.innerHTML = slots
      .map((slot) => {
        const notes = [slot.status === "taken" ? "ocupado" : "", slot.past ? "ya paso" : ""].filter(Boolean).join(", ");
        return `<option value="${slot.time}" ${slot.status === "free" ? "" : "disabled"}>${formatTime12h(slot.time)}${notes ? ` · ${notes}` : ""}</option>`;
      })
      .join("");
    timeSelect.value = (free.find((slot) => slot.time === wantedTime) || free[0]).time;
  }

  async function submitNewBooking(form) {
    const value = (key) => $(`[data-field="${key}"]`, form).value;
    if (!value("time")) {
      showModalError("Elige una hora disponible.");
      return;
    }
    await withBusy($("button[type=submit]", form), "Guardando...", async () => {
      try {
        const booking = await store.createBooking(
          {
            customerName: value("customerName"),
            customerPhone: value("customerPhone"),
            barberId: value("barberId"),
            serviceId: value("serviceId"),
            date: value("date"),
            time: value("time"),
            notes: value("notes"),
          },
          { source: "admin", status: value("status") }
        );
        closeModal();
        toast(`Cita ${booking.code} creada`);
        agendaDate = booking.date;
        refreshAfterChange();
      } catch (error) {
        data = store.getState();
        showModalError(error.message);
        refreshNewBookingOptions(form);
      }
    });
  }

  // ==================================================================
  // Reservas (tabla)
  // ==================================================================

  function renderBookingsTab() {
    if (!bookingFiltersInitialized) {
      $("[data-filter-date]").value = todayISO();
      bookingFiltersInitialized = true;
    }
    const barberSelect = $("[data-filter-barber]");
    const current = barberSelect.value;
    barberSelect.innerHTML =
      `<option value="">Todos</option>` +
      data.barbers
        .map((barber) => `<option value="${escapeHtml(barber.id)}" ${barber.id === current ? "selected" : ""}>${escapeHtml(barber.name)}</option>`)
        .join("");
    renderBookingsTable();
  }

  function renderBookingsTable() {
    const barberFilter = $("[data-filter-barber]").value;
    const statusFilter = $("[data-filter-status]").value;
    const dateFilter = $("[data-filter-date]").value;
    const query = $("[data-filter-search]").value.trim().toLowerCase();
    const queryDigits = utils.digitsOnly(query);

    const bookings = data.bookings
      .filter((booking) => !barberFilter || booking.barberId === barberFilter)
      .filter((booking) => !statusFilter || booking.status === statusFilter)
      .filter((booking) => !dateFilter || booking.date >= dateFilter)
      .filter((booking) => {
        if (!query) return true;
        return (
          booking.customerName.toLowerCase().includes(query) ||
          booking.code.toLowerCase().includes(query) ||
          (queryDigits.length >= 3 && utils.digitsOnly(booking.customerPhone).includes(queryDigits))
        );
      })
      .sort(byDateTime);

    const tbody = $("[data-bookings-table] tbody");
    if (!bookings.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="admin-empty">No hay reservas con estos filtros.</td></tr>`;
      return;
    }

    tbody.innerHTML = bookings
      .map(
        (booking) => `
          <tr>
            <td><code class="booking-code-chip">${escapeHtml(booking.code)}</code></td>
            <td>${escapeHtml(capitalize(formatDateShort(booking.date)))}</td>
            <td>${escapeHtml(formatTime12h(booking.time))}</td>
            <td>${escapeHtml(booking.customerName)}<br /><small>${escapeHtml(booking.customerPhone || "Sin telefono")}</small></td>
            <td>${escapeHtml(serviceLabel(booking))}</td>
            <td>${escapeHtml(barberLabel(booking))}</td>
            <td>
              <select data-booking-status="${escapeHtml(booking.id)}" aria-label="Estado de la cita ${escapeHtml(booking.code)}">
                ${store.BOOKING_STATUSES.map((status) => `<option value="${status}" ${booking.status === status ? "selected" : ""}>${STATUS_LABELS[status]}</option>`).join("")}
              </select>
            </td>
            <td class="admin-table__actions">
              <button type="button" class="admin-link-button" data-open-booking="${escapeHtml(booking.id)}">Ver</button>
              <button type="button" class="admin-link-button admin-link-button--danger" data-delete-booking="${escapeHtml(booking.id)}">Eliminar</button>
            </td>
          </tr>
        `
      )
      .join("");
  }

  // ==================================================================
  // Servicios
  // ==================================================================

  function renderServicesTable() {
    const tbody = $("[data-services-table] tbody");
    if (!data.services.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="admin-empty">Sin servicios todavia.</td></tr>`;
      return;
    }
    tbody.innerHTML = data.services
      .map((service) => {
        const barbers = data.barbers.filter((barber) => barber.serviceIds.includes(service.id));
        const barberText = barbers.length ? barbers.map((barber) => barber.name.split(" ")[0]).join(", ") : "Ninguno";
        return `
          <tr>
            <td class="admin-table__name">
              <img src="${escapeHtml(service.image)}" alt="" loading="lazy" />
              ${escapeHtml(service.name)}
            </td>
            <td>${formatMoneyCOP(service.price)}</td>
            <td>${service.durationMinutes} min</td>
            <td class="${barbers.length ? "" : "admin-warning"}">${escapeHtml(barberText)}</td>
            <td>${service.available ? `<span class="badge badge--ok">Disponible</span>` : `<span class="badge badge--off">Pausado</span>`}</td>
            <td class="admin-table__actions">
              <button type="button" class="admin-link-button" data-edit-service="${escapeHtml(service.id)}">Editar</button>
              <button type="button" class="admin-link-button admin-link-button--danger" data-delete-service="${escapeHtml(service.id)}">Eliminar</button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function openServiceModal(service) {
    const isEdit = Boolean(service);
    const source = service || { name: "", description: "", price: 25000, durationMinutes: 30, image: "", tags: [], available: true };

    openModal({
      title: isEdit ? "Editar servicio" : "Agregar servicio",
      bodyHtml: `
        <form data-modal-form class="admin-form admin-form--modal">
          <label>Nombre <input data-field="name" required value="${escapeHtml(source.name)}" /></label>
          <label>Tags (separados por coma) <input data-field="tags" value="${escapeHtml(source.tags.join(", "))}" /></label>
          <label class="admin-form__full">Descripcion <textarea data-field="description" rows="2">${escapeHtml(source.description)}</textarea></label>
          <label>Precio (COP) <input type="number" min="0" step="500" data-field="price" required value="${source.price}" /></label>
          <label>Duracion (minutos) <input type="number" min="5" step="5" data-field="durationMinutes" required value="${source.durationMinutes}" /></label>
          ${imageFieldHtml({ field: "image", value: source.image, label: "Foto del servicio" })}
          <label class="admin-checkbox"><input type="checkbox" data-field="available" ${source.available ? "checked" : ""} /> Disponible para reservar</label>
          ${isEdit ? "" : `<p class="admin-muted admin-form__full">Los servicios nuevos quedan asignados a todos los barberos. Puedes ajustarlo en cada barbero.</p>`}
          <p class="admin-form__error admin-form__full" data-modal-error hidden></p>
          <div class="admin-form__actions admin-form__full">
            <button type="submit" class="button button--primary">Guardar</button>
          </div>
        </form>
      `,
      onSubmit: async (form) => {
        const value = (key) => $(`[data-field="${key}"]`, form);
        const record = {
          ...(isEdit ? source : {}),
          id: isEdit ? source.id : null,
          name: value("name").value.trim(),
          description: value("description").value.trim(),
          price: Number(value("price").value),
          durationMinutes: Number(value("durationMinutes").value),
          image: value("image").value.trim(),
          tags: value("tags")
            .value.split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          available: value("available").checked,
          currency: "COP",
        };
        await withBusy($("button[type=submit]", form), "Guardando...", async () => {
          try {
            await store.saveService(record);
            data = store.getState();
            closeModal();
            toast(isEdit ? "Servicio actualizado" : "Servicio agregado");
            renderServicesTable();
          } catch (error) {
            showModalError(error.message);
          }
        });
      },
    });
  }

  async function deleteServiceFlow(id) {
    const service = data.services.find((item) => item.id === id);
    if (!service) return;
    const upcoming = store.getUpcomingBookings({ serviceId: id }).length;
    const message = upcoming
      ? `"${service.name}" tiene ${pluralize(upcoming, "cita futura", "citas futuras")}. Las citas se conservan, pero el servicio desaparecera del sitio. Si solo quieres dejar de ofrecerlo por un tiempo, es mejor pausarlo.`
      : `Se eliminara "${service.name}" del sitio y de los barberos que lo ofrecen.`;
    const ok = await confirmDialog({ title: "Eliminar servicio", message, confirmLabel: "Eliminar" });
    if (ok && (await attempt(() => store.deleteService(id), "Servicio eliminado")).ok) renderServicesTable();
  }

  // ==================================================================
  // Barberos
  // ==================================================================

  function renderBarbersTable() {
    const tbody = $("[data-barbers-table] tbody");
    if (!data.barbers.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="admin-empty">Sin barberos todavia.</td></tr>`;
      return;
    }
    const today = todayISO();
    tbody.innerHTML = data.barbers
      .map((barber) => {
        const timeOff = barber.timeOff.filter((range) => range.end >= today).sort((a, b) => a.start.localeCompare(b.start));
        const timeOffText = timeOff.length
          ? timeOff.map((range) => (range.start === range.end ? formatDayMonth(range.start) : `${formatDayMonth(range.start)} – ${formatDayMonth(range.end)}`)).join(", ")
          : "—";
        return `
          <tr>
            <td class="admin-table__name">
              <img src="${escapeHtml(barber.image)}" alt="" loading="lazy" />
              <span>${escapeHtml(barber.name)}<br /><small>${escapeHtml(barber.specialty)}</small></span>
            </td>
            <td class="${barber.serviceIds.length ? "" : "admin-warning"}">${barber.serviceIds.filter((id) => data.services.some((service) => service.id === id)).length} de ${data.services.length}</td>
            <td>${escapeHtml(barber.daysOff.join(", ") || "—")}</td>
            <td>${escapeHtml(timeOffText)}</td>
            <td>${pluralize(barber.gallery.length, "foto", "fotos")}</td>
            <td>${barber.available ? `<span class="badge badge--ok">Disponible</span>` : `<span class="badge badge--off">Pausado</span>`}</td>
            <td class="admin-table__actions">
              <button type="button" class="admin-link-button" data-edit-barber="${escapeHtml(barber.id)}">Editar</button>
              <button type="button" class="admin-link-button admin-link-button--danger" data-delete-barber="${escapeHtml(barber.id)}">Eliminar</button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function galleryRowHtml(item) {
    const src = item ? item.src : "";
    const alt = item ? item.alt : "";
    return `
      <div class="admin-gallery-row">
        <img class="image-field__preview" data-image-preview src="${escapeHtml(src)}" alt="" ${src ? "" : "hidden"} />
        <input type="text" data-image-input data-gallery-src placeholder="URL o sube una foto" value="${escapeHtml(src)}" />
        <input type="text" data-gallery-alt placeholder="Descripcion" value="${escapeHtml(alt)}" />
        <label class="button button--small button--outline-dark image-field__upload">
          Subir
          <input type="file" accept="image/*" class="visually-hidden" data-image-file />
        </label>
        <button type="button" class="admin-link-button admin-link-button--danger" data-remove-row>Quitar</button>
      </div>
    `;
  }

  function timeOffRowHtml(range) {
    return `
      <div class="admin-timeoff-row">
        <input type="date" data-timeoff-start value="${range ? range.start : ""}" aria-label="Desde" />
        <span>a</span>
        <input type="date" data-timeoff-end value="${range ? range.end : ""}" aria-label="Hasta" />
        <input type="text" data-timeoff-reason placeholder="Motivo (opcional)" value="${escapeHtml(range ? range.reason || "" : "")}" />
        <button type="button" class="admin-link-button admin-link-button--danger" data-remove-row>Quitar</button>
      </div>
    `;
  }

  function barberFormHtml(barber) {
    return `
      <form data-modal-form class="admin-form admin-form--modal">
        <label>Nombre <input data-field="name" required value="${escapeHtml(barber.name)}" /></label>
        <label>Especialidad <input data-field="specialty" value="${escapeHtml(barber.specialty)}" /></label>
        <label class="admin-form__full">Bio <textarea data-field="bio" rows="2">${escapeHtml(barber.bio)}</textarea></label>
        ${imageFieldHtml({ field: "image", value: barber.image, label: "Foto principal" })}
        <label class="admin-checkbox admin-form__full"><input type="checkbox" data-field="available" ${barber.available ? "checked" : ""} /> Disponible para reservas</label>

        <div class="admin-form__full admin-checkgroup">
          <h4>Servicios que realiza</h4>
          <div class="admin-checkgroup__items">
            ${
              data.services.length
                ? data.services
                    .map(
                      (service) =>
                        `<label class="admin-chip"><input type="checkbox" data-barber-service value="${escapeHtml(service.id)}" ${barber.serviceIds.includes(service.id) ? "checked" : ""} /> ${escapeHtml(service.name)}</label>`
                    )
                    .join("")
                : `<p class="admin-muted">Aun no hay servicios.</p>`
            }
          </div>
        </div>

        <div class="admin-form__full admin-checkgroup">
          <h4>Dias de descanso (cada semana)</h4>
          <div class="admin-checkgroup__items">
            ${WEEK_ORDER.map(
              (day) =>
                `<label class="admin-chip"><input type="checkbox" data-barber-dayoff value="${day}" ${barber.daysOff.includes(day) ? "checked" : ""} /> ${day}</label>`
            ).join("")}
          </div>
        </div>

        <div class="admin-form__full admin-checkgroup">
          <h4>Ausencias y vacaciones</h4>
          <div data-timeoff-rows>${barber.timeOff.map(timeOffRowHtml).join("")}</div>
          <button type="button" class="admin-link-button" data-add-timeoff-row>+ Agregar ausencia</button>
        </div>

        <div class="admin-form__full admin-checkgroup">
          <h4>Galeria de trabajos</h4>
          <div data-gallery-rows>${barber.gallery.map(galleryRowHtml).join("")}</div>
          <button type="button" class="admin-link-button" data-add-gallery-row>+ Agregar foto</button>
        </div>

        <p class="admin-form__error admin-form__full" data-modal-error hidden></p>
        <div class="admin-form__actions admin-form__full">
          <button type="submit" class="button button--primary">Guardar</button>
        </div>
      </form>
    `;
  }

  function collectBarber(form, source, isEdit) {
    const value = (key) => $(`[data-field="${key}"]`, form);
    return {
      ...(isEdit ? source : {}),
      id: isEdit ? source.id : null,
      name: value("name").value.trim(),
      specialty: value("specialty").value.trim(),
      bio: value("bio").value.trim(),
      image: value("image").value.trim(),
      available: value("available").checked,
      serviceIds: $$("[data-barber-service]:checked", form).map((input) => input.value),
      daysOff: $$("[data-barber-dayoff]:checked", form).map((input) => input.value),
      timeOff: $$(".admin-timeoff-row", form)
        .map((row) => ({
          start: $("[data-timeoff-start]", row).value,
          end: $("[data-timeoff-end]", row).value,
          reason: $("[data-timeoff-reason]", row).value.trim(),
        }))
        .filter((range) => range.start || range.end),
      gallery: $$(".admin-gallery-row", form)
        .map((row) => ({
          src: $("[data-gallery-src]", row).value.trim(),
          alt: $("[data-gallery-alt]", row).value.trim(),
        }))
        .filter((item) => item.src),
    };
  }

  function openBarberModal(barber) {
    const isEdit = Boolean(barber);
    const source = barber || {
      name: "",
      specialty: "",
      bio: "",
      image: "",
      available: true,
      serviceIds: data.services.map((service) => service.id),
      daysOff: [],
      timeOff: [],
      gallery: [],
    };

    openModal({
      title: isEdit ? "Editar barbero" : "Agregar barbero",
      bodyHtml: barberFormHtml(source),
      wide: true,
      onSubmit: async (form) => {
        const record = collectBarber(form, source, isEdit);
        try {
          store.validateBarber(record);
        } catch (error) {
          showModalError(error.message);
          return;
        }

        const affected = store.getBookingsBlockedForBarber(record);
        if (affected.length) {
          const ok = await confirmDialog({
            title: "Hay citas afectadas",
            message: `${record.name} tiene ${pluralize(affected.length, "cita futura", "citas futuras")} en dias que ahora son de descanso o ausencia, o de un servicio que ya no realiza. No se cancelan solas: revisalas en la Agenda y avisale a los clientes. ¿Guardar igual?`,
            confirmLabel: "Guardar igual",
            danger: false,
          });
          if (!ok) return;
        }

        await withBusy($("button[type=submit]", form), "Guardando...", async () => {
          try {
            await store.saveBarber(record);
            data = store.getState();
            closeModal();
            toast(isEdit ? "Barbero actualizado" : "Barbero agregado");
            renderBarbersTable();
          } catch (error) {
            showModalError(error.message);
          }
        });
      },
    });
  }

  async function deleteBarberFlow(id) {
    const barber = data.barbers.find((item) => item.id === id);
    if (!barber) return;
    const upcoming = store.getUpcomingBookings({ barberId: id }).length;
    const message = upcoming
      ? `${barber.name} tiene ${pluralize(upcoming, "cita futura", "citas futuras")}. Las citas se conservan, pero ya no podras reasignarlas facilmente. Si solo no va a atender por un tiempo, es mejor pausarlo o agregarle una ausencia.`
      : `Se eliminara a ${barber.name} del sitio y de la agenda.`;
    const ok = await confirmDialog({ title: "Eliminar barbero", message, confirmLabel: "Eliminar" });
    if (ok && (await attempt(() => store.deleteBarber(id), "Barbero eliminado")).ok) renderBarbersTable();
  }

  // ==================================================================
  // Horarios
  // ==================================================================

  function renderHoursForm() {
    $("[data-hours-body]").innerHTML = data.hours
      .map(
        (day, index) => `
          <tr data-hour-row="${index}">
            <td>${escapeHtml(day.day)}</td>
            <td><input type="checkbox" data-hour-open aria-label="${escapeHtml(day.day)} abierto" ${day.open ? "checked" : ""} /></td>
            <td><input type="time" data-hour-start value="${day.start || ""}" aria-label="Apertura ${escapeHtml(day.day)}" ${day.open ? "" : "disabled"} /></td>
            <td><input type="time" data-hour-end value="${day.end || ""}" aria-label="Cierre ${escapeHtml(day.day)}" ${day.open ? "" : "disabled"} /></td>
          </tr>
        `
      )
      .join("");
    $("[data-setting-window]").value = data.settings.bookingWindowDays;
  }

  async function handleHoursSubmit(event) {
    event.preventDefault();
    const hours = $$("[data-hour-row]").map((row, index) => {
      const open = $("[data-hour-open]", row).checked;
      return {
        day: data.hours[index].day,
        open,
        start: open ? $("[data-hour-start]", row).value || null : null,
        end: open ? $("[data-hour-end]", row).value || null : null,
      };
    });
    const windowDays = Number($("[data-setting-window]").value);

    try {
      store.validateHours(hours);
    } catch (error) {
      toast(error.message, "error");
      return;
    }

    const affected = store.getBookingsOutsideHours(hours);
    if (affected.length) {
      const ok = await confirmDialog({
        title: "Hay citas fuera del nuevo horario",
        message: `${pluralize(affected.length, "cita futura queda", "citas futuras quedan")} fuera del nuevo horario. No se cancelan solas: revisalas en la Agenda y avisale a los clientes. ¿Guardar igual?`,
        confirmLabel: "Guardar igual",
        danger: false,
      });
      if (!ok) return;
    }

    await withBusy($("[data-hours-form] button[type=submit]"), "Guardando...", () =>
      attempt(async () => {
        await store.updateSiteContent({ settings: { bookingWindowDays: windowDays } });
        await store.saveHours(hours);
      }, "Horarios guardados")
    );
  }

  // ==================================================================
  // Sitio y negocio
  // ==================================================================

  function populateBusinessForm() {
    const form = $("[data-business-form]");
    const highlights = data.identity.highlights || [];
    const values = {
      name: data.business.name,
      shortName: data.business.shortName,
      initials: data.business.initials,
      subtitle: data.business.subtitle,
      description: data.business.description,
      concept: data.identity.concept,
      promise: (data.identity.promise || []).join(", "),
      phone: data.business.phone,
      whatsapp: data.business.whatsapp,
      email: data.business.email,
      instagram: data.business.instagram,
      address: data.business.address,
      neighborhood: data.business.neighborhood,
      city: data.business.city,
      mapQuery: data.business.mapQuery,
      heroEyebrow: data.hero.eyebrow,
      heroTitle: data.hero.title,
      heroText: data.hero.text,
      heroPrimaryCta: data.hero.primaryCta,
      notesTitle: data.notes.title,
      notesBody: data.notes.body,
      ctaTitle: data.cta.title,
      ctaText: data.cta.text,
    };
    [0, 1, 2].forEach((index) => {
      values[`highlightValue${index}`] = highlights[index] ? highlights[index].value : "";
      values[`highlightLabel${index}`] = highlights[index] ? highlights[index].label : "";
    });

    $("[data-hero-image-slot]").innerHTML = imageFieldHtml({ field: "heroImage", value: data.media.hero, label: "Foto de portada" });

    Object.entries(values).forEach(([key, value]) => {
      const field = $(`[data-field="${key}"]`, form);
      if (field) field.value = value || "";
    });
  }

  async function handleBusinessSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const val = (key) => $(`[data-field="${key}"]`, form).value.trim();

    const highlights = [0, 1, 2]
      .map((index) => ({ value: val(`highlightValue${index}`), label: val(`highlightLabel${index}`) }))
      .filter((item) => item.value || item.label);

    const sections = {
      media: { hero: val("heroImage") },
      business: {
        name: val("name"),
        shortName: val("shortName"),
        initials: val("initials"),
        subtitle: val("subtitle"),
        description: val("description"),
        phone: val("phone"),
        whatsapp: val("whatsapp"),
        email: val("email"),
        instagram: val("instagram"),
        address: val("address"),
        neighborhood: val("neighborhood"),
        city: val("city"),
        mapQuery: val("mapQuery"),
      },
      identity: {
        concept: val("concept"),
        promise: val("promise")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        highlights,
      },
      hero: {
        eyebrow: val("heroEyebrow"),
        title: val("heroTitle"),
        text: val("heroText"),
        primaryCta: val("heroPrimaryCta"),
      },
      notes: { title: val("notesTitle"), body: val("notesBody") },
      cta: { title: val("ctaTitle"), text: val("ctaText") },
    };

    const result = await withBusy($("button[type=submit]", form), "Guardando...", () =>
      attempt(() => store.updateSiteContent(sections), "Cambios guardados. El sitio publico ya los muestra.")
    );
    if (result.ok) refreshBrand();
  }

  // ==================================================================
  // Cuenta
  // ==================================================================

  function resetPasswordForm() {
    $("[data-password-form]").reset();
    $("[data-password-error]").hidden = true;
    const email = auth.currentEmail();
    $("[data-account-email]").hidden = !email;
    $("[data-account-email]").textContent = email ? `Sesion iniciada como ${email}.` : "";
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    const current = $("[data-password-current]").value;
    const next = $("[data-password-new]").value;
    const repeat = $("[data-password-repeat]").value;
    const error = $("[data-password-error]");
    error.hidden = true;

    let message = "";
    if (next.length < 6) message = "La nueva contrasena debe tener al menos 6 caracteres.";
    else if (next !== repeat) message = "Las contrasenas nuevas no coinciden.";

    if (!message) {
      await withBusy($("[data-password-form] button[type=submit]"), "Actualizando...", async () => {
        try {
          await auth.changePassword(current, next);
        } catch (changeError) {
          message = changeError.message;
        }
      });
    }

    if (message) {
      error.textContent = message;
      error.hidden = false;
      return;
    }
    resetPasswordForm();
    toast("Contrasena actualizada");
  }

  // ==================================================================
  // Eventos
  // ==================================================================

  function handleGlobalClick(event) {
    const target = event.target;

    if (target.closest("[data-confirm-accept]")) return settleConfirm(true);
    if (target.closest("[data-confirm-cancel]")) return settleConfirm(false);
    if (target.matches("[data-modal-close]") || target.closest(".modal__header [data-modal-close]")) return closeModal();

    const tabButton = target.closest("[data-admin-tab]");
    if (tabButton) return switchTab(tabButton.dataset.adminTab);

    if (target.closest("[data-admin-logout]")) {
      return auth.logout().finally(() => showLogin());
    }

    if (target.closest("[data-new-booking]")) {
      return openNewBookingModal({ date: activeTab === "agenda" ? agendaDate : todayISO() });
    }

    const openBooking = target.closest("[data-open-booking]");
    if (openBooking) return openBookingDetail(openBooking.dataset.openBooking);

    const deleteBooking = target.closest("[data-delete-booking]");
    if (deleteBooking) return deleteBookingFlow(deleteBooking.dataset.deleteBooking);

    // Agenda
    if (target.closest("[data-agenda-prev]")) {
      agendaDate = addDays(agendaDate, -1);
      return renderAgenda();
    }
    if (target.closest("[data-agenda-next]")) {
      agendaDate = addDays(agendaDate, 1);
      return renderAgenda();
    }
    if (target.closest("[data-agenda-today]")) {
      agendaDate = todayISO();
      return renderAgenda();
    }
    const agendaDay = target.closest("[data-agenda-day]");
    if (agendaDay) {
      agendaDate = agendaDay.dataset.agendaDay;
      return renderAgenda();
    }
    const agendaSlot = target.closest("[data-agenda-slot]");
    if (agendaSlot) {
      return openNewBookingModal({ barberId: agendaSlot.dataset.barber, date: agendaDate, time: agendaSlot.dataset.time });
    }

    // Servicios
    if (target.closest("[data-add-service]")) return openServiceModal(null);
    const editService = target.closest("[data-edit-service]");
    if (editService) return openServiceModal(data.services.find((service) => service.id === editService.dataset.editService));
    const deleteService = target.closest("[data-delete-service]");
    if (deleteService) return deleteServiceFlow(deleteService.dataset.deleteService);

    // Barberos
    if (target.closest("[data-add-barber]")) return openBarberModal(null);
    const editBarber = target.closest("[data-edit-barber]");
    if (editBarber) return openBarberModal(data.barbers.find((barber) => barber.id === editBarber.dataset.editBarber));
    const deleteBarber = target.closest("[data-delete-barber]");
    if (deleteBarber) return deleteBarberFlow(deleteBarber.dataset.deleteBarber);

    const modalBody = $("[data-modal-body]");
    if (target.closest("[data-add-gallery-row]")) {
      return $("[data-gallery-rows]", modalBody).insertAdjacentHTML("beforeend", galleryRowHtml(null));
    }
    if (target.closest("[data-add-timeoff-row]")) {
      return $("[data-timeoff-rows]", modalBody).insertAdjacentHTML("beforeend", timeOffRowHtml(null));
    }
    if (target.closest("[data-remove-row]")) {
      return target.closest(".admin-gallery-row, .admin-timeoff-row").remove();
    }

    if (target.closest("[data-reset-demo]")) return resetDemoFlow();
  }

  async function resetDemoFlow() {
    const ok = await confirmDialog({
      title: "Restaurar datos de ejemplo",
      message: "Se borran todas las reservas y los cambios hechos en el panel, y se vuelve a los datos originales. La contrasena no cambia.",
      confirmLabel: "Restaurar",
    });
    if (!ok) return;
    if ((await attempt(() => store.resetToDefaults(), "Datos de ejemplo restaurados")).ok) {
      refreshBrand();
      renderActiveTab();
    }
  }

  async function changeBookingStatus(id, status, reopenDetail) {
    if ((await attempt(() => store.updateBookingStatus(id, status), "Estado actualizado")).ok) {
      if (reopenDetail) openBookingDetail(id);
    }
    refreshAfterChange();
  }

  function handleGlobalChange(event) {
    const target = event.target;

    if (target.matches("[data-image-file]")) {
      handleImageFile(target);
      return;
    }

    if (target.matches("[data-hour-open]")) {
      const row = target.closest("[data-hour-row]");
      $("[data-hour-start]", row).disabled = !target.checked;
      $("[data-hour-end]", row).disabled = !target.checked;
      return;
    }

    if (target.matches("[data-booking-status]")) {
      changeBookingStatus(target.dataset.bookingStatus, target.value, false);
      return;
    }

    if (target.matches("[data-detail-status]")) {
      changeBookingStatus(target.dataset.detailStatus, target.value, true);
      return;
    }

    if (target.matches("[data-filter-barber], [data-filter-status], [data-filter-date]")) {
      renderBookingsTable();
      return;
    }

    if (target.matches("[data-agenda-date]") && target.value) {
      agendaDate = target.value;
      renderAgenda();
      return;
    }

    const newBookingForm = target.closest("[data-new-booking-form]");
    if (newBookingForm && target.matches('[data-field="barberId"], [data-field="serviceId"], [data-field="date"]')) {
      refreshNewBookingOptions(newBookingForm);
    }
  }

  function handleGlobalInput(event) {
    const target = event.target;
    if (target.matches("[data-filter-search]")) {
      renderBookingsTable();
      return;
    }
    if (target.matches("[data-image-input]")) {
      const container = target.closest("[data-image-field], .admin-gallery-row");
      const preview = $("[data-image-preview]", container);
      const status = $("[data-image-status]", container);
      preview.hidden = !target.value.trim();
      if (target.value.trim()) preview.src = target.value.trim();
      if (status) status.textContent = "";
    }
  }

  function handleKeydown(event) {
    if (event.key !== "Escape") return;
    if (!$("[data-confirm]").hidden) settleConfirm(false);
    else if (isModalOpen()) closeModal();
  }

  // Oculta miniaturas de URLs que no cargan en lugar de mostrar el icono roto.
  function handleImageError(event) {
    if (event.target.matches && event.target.matches("[data-image-preview]")) event.target.hidden = true;
  }

  // ==================================================================
  // Init
  // ==================================================================

  initLoginForm();
  $("[data-business-form]").addEventListener("submit", handleBusinessSubmit);
  $("[data-hours-form]").addEventListener("submit", handleHoursSubmit);
  $("[data-password-form]").addEventListener("submit", handlePasswordSubmit);
  document.addEventListener("click", handleGlobalClick);
  document.addEventListener("change", handleGlobalChange);
  document.addEventListener("input", handleGlobalInput);
  document.addEventListener("keydown", handleKeydown);
  document.addEventListener("error", handleImageError, true);

  store.subscribe((nextState, meta) => {
    if (meta.source !== "external" || $("[data-admin-shell]").hidden) return;
    data = nextState;
    if (activeTab !== "negocio") refreshBrand();
    refreshAfterChange();
  });

  auth.onSessionEnded(() => showLogin("Tu sesion termino. Vuelve a iniciar sesion."));

  (async () => {
    showLogin();
    $("[data-login-form]").hidden = true;
    try {
      if (await auth.isAuthenticated()) {
        await showShell();
        return;
      }
    } catch (error) {
      console.error(error);
      showLogin("No pudimos conectar con el servidor. Revisa tu conexion y recarga la pagina.");
    } finally {
      $("[data-login-form]").hidden = false;
    }
  })();
})();
