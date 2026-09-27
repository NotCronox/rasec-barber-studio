(function () {
  const store = window.RasecStore;
  const utils = window.RasecUtils;
  if (!store || !utils) return;

  const { escapeHtml, formatMoneyCOP, formatDateLong, formatTime12h, toISODate, todayISO, parseISODate, whatsAppLink } = utils;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const STEPS = ["service", "barber", "datetime", "customer", "confirm"];
  const AVAILABILITY_REFRESH_MS = 45000;

  let data = null;

  const draft = {
    serviceId: null,
    barberId: null,
    date: null,
    time: null,
    customerName: "",
    customerPhone: "",
    notes: "",
  };

  let stepIndex = 0;
  let furthestStep = 0;
  let calendarMonth = startOfMonth(new Date());
  let completed = false;

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  // ---------- Datos disponibles para el cliente ----------

  function availableBarbers() {
    return data.barbers.filter((barber) => barber.available);
  }

  function isServiceOffered(service) {
    return service.available && availableBarbers().some((barber) => barber.serviceIds.includes(service.id));
  }

  function findService(id) {
    return data.services.find((service) => service.id === id && isServiceOffered(service));
  }

  function findBarber(id) {
    return availableBarbers().find((barber) => barber.id === id);
  }

  function barbersForService(serviceId) {
    return availableBarbers().filter((barber) => barber.serviceIds.includes(serviceId));
  }

  function servicesForStep() {
    const offered = data.services.filter(isServiceOffered);
    const barber = findBarber(draft.barberId);
    return barber ? offered.filter((service) => barber.serviceIds.includes(service.id)) : offered;
  }

  function barberDoesService(barberId, serviceId) {
    const barber = findBarber(barberId);
    return Boolean(barber && barber.serviceIds.includes(serviceId));
  }

  function applyQueryParams() {
    const params = new URLSearchParams(location.search);
    const serviceId = params.get("service");
    const barberId = params.get("barber");
    if (serviceId && findService(serviceId)) draft.serviceId = serviceId;
    if (barberId && findBarber(barberId)) draft.barberId = barberId;
    if (draft.serviceId && draft.barberId && !barberDoesService(draft.barberId, draft.serviceId)) {
      draft.barberId = null;
    }

    if (draft.serviceId && draft.barberId) stepIndex = 2;
    else if (draft.serviceId) stepIndex = 1;
    furthestStep = stepIndex;
  }

  function setBrand() {
    const mark = $("[data-brand-mark]");
    const name = $("[data-business-name]");
    if (mark) mark.textContent = data.business.initials;
    if (name) name.textContent = data.business.name;
  }

  // ---------- Pasos ----------

  function renderStepIndicator() {
    $$("[data-step-indicator]").forEach((item, index) => {
      item.classList.toggle("is-active", index === stepIndex);
      item.classList.toggle("is-done", index < stepIndex);
      item.classList.toggle("is-reachable", index <= furthestStep);
    });
  }

  function renderServiceOptions() {
    const container = $("[data-service-options]");
    const note = $("[data-service-note]");
    const barber = findBarber(draft.barberId);

    if (note) {
      note.hidden = !barber;
      if (barber) {
        note.innerHTML = `Mostrando los servicios de <strong>${escapeHtml(barber.name)}</strong>. <button type="button" class="booking-note__link" data-clear-barber>Ver todos los servicios</button>`;
      }
    }

    const services = servicesForStep();
    if (!services.length) {
      container.innerHTML = `<p class="slots-empty">No hay servicios disponibles en este momento.</p>`;
      return;
    }

    container.innerHTML = services
      .map(
        (service) => `
          <button type="button" class="booking-option ${draft.serviceId === service.id ? "is-selected" : ""}" data-service-option="${escapeHtml(service.id)}">
            <strong>${escapeHtml(service.name)}</strong>
            <span>${escapeHtml(service.description)}</span>
            <div class="booking-option__meta">
              <span>${formatMoneyCOP(service.price)}</span>
              <span>${service.durationMinutes} min</span>
            </div>
          </button>
        `
      )
      .join("");
  }

  function renderBarberOptions() {
    const container = $("[data-barber-options]");
    const barbers = barbersForService(draft.serviceId);

    if (!barbers.length) {
      container.innerHTML = `<p class="slots-empty">Ningun barbero ofrece este servicio por ahora. Elige otro servicio.</p>`;
      return;
    }

    container.innerHTML = barbers
      .map(
        (barber) => `
          <button type="button" class="booking-option booking-option--barber ${draft.barberId === barber.id ? "is-selected" : ""}" data-barber-option="${escapeHtml(barber.id)}">
            <img src="${escapeHtml(barber.image)}" alt="${escapeHtml(barber.name)}" loading="lazy" />
            <strong>${escapeHtml(barber.name)}</strong>
            <span>${escapeHtml(barber.specialty)}</span>
            ${barber.daysOff.length ? `<small>Descansa: ${escapeHtml(barber.daysOff.join(", "))}</small>` : ""}
          </button>
        `
      )
      .join("");
  }

  function dayUnavailableReason(status, barber) {
    switch (status.reason) {
      case "closed":
        return "La barberia esta cerrada";
      case "day-off":
        return `${barber.name} descansa este dia`;
      case "time-off":
        return `${barber.name} no esta disponible${status.note ? ` (${status.note})` : ""}`;
      case "beyond-window":
        return "Todavia no se abren reservas para esta fecha";
      default:
        return "";
    }
  }

  function renderCalendar() {
    const grid = $("[data-calendar-grid]");
    const label = $("[data-calendar-label]");
    const hint = $("[data-calendar-hint]");
    const service = findService(draft.serviceId);
    const barber = findBarber(draft.barberId);
    if (!grid || !service || !barber) return;

    const maxISO = store.getMaxBookingDate();
    const today = todayISO();
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    label.textContent = calendarMonth.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
    $("[data-calendar-prev]").disabled = calendarMonth <= startOfMonth(new Date());
    $("[data-calendar-next]").disabled = toISODate(new Date(year, month + 1, 1)) > maxISO;

    let html = "";
    for (let i = 0; i < startOffset; i++) {
      html += `<span class="calendar__cell calendar__cell--empty"></span>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = toISODate(new Date(year, month, day));
      const status = store.getDateStatus(barber.id, iso);
      let title = status.ok ? "" : dayUnavailableReason(status, barber);
      let isFull = false;

      if (status.ok) {
        const slots = store.getSlots({ barberId: barber.id, serviceId: service.id, date: iso });
        isFull = !slots.some((slot) => slot.status === "free");
        if (isFull) title = "Sin horarios libres";
      }

      const disabled = !status.ok || isFull;
      const classes = [
        "calendar__cell",
        disabled ? "is-disabled" : "",
        isFull ? "is-full" : "",
        draft.date === iso ? "is-selected" : "",
        iso === today ? "is-today" : "",
      ].join(" ");

      html += `<button type="button" class="${classes}" data-calendar-day="${iso}" ${disabled ? "disabled" : ""} title="${escapeHtml(title)}">${day}</button>`;
    }

    grid.innerHTML = html;

    if (hint) {
      const rest = barber.daysOff.length ? ` ${barber.name} descansa: ${barber.daysOff.join(", ")}.` : "";
      hint.textContent = `Puedes reservar hasta el ${formatDateLong(maxISO)}.${rest}`;
    }
  }

  function renderSlots() {
    const container = $("[data-slots]");
    const service = findService(draft.serviceId);
    const barber = findBarber(draft.barberId);

    if (!draft.date) {
      container.innerHTML = `<p class="slots-empty">Elige un dia en el calendario.</p>`;
      return;
    }
    if (!service || !barber) {
      container.innerHTML = `<p class="slots-empty">Vuelve a elegir el servicio y el barbero.</p>`;
      return;
    }

    const slots = store.getSlots({ barberId: barber.id, serviceId: service.id, date: draft.date });
    if (draft.time && !slots.some((slot) => slot.time === draft.time && slot.status === "free")) {
      draft.time = null;
    }

    if (!slots.length) {
      container.innerHTML = `<p class="slots-empty">No hay horarios para este dia. Elige otra fecha.</p>`;
      return;
    }

    const anyFree = slots.some((slot) => slot.status === "free");
    container.innerHTML =
      slots
        .map((slot) => {
          const disabled = slot.status !== "free";
          const title = slot.status === "taken" ? "Ya reservado" : slot.status === "past" ? "Ya paso" : "";
          return `
            <button type="button"
              class="slot ${disabled ? "is-disabled" : ""} ${draft.time === slot.time ? "is-selected" : ""}"
              data-slot="${slot.time}"
              ${disabled ? "disabled" : ""}
              title="${title}"
            >${formatTime12h(slot.time)}</button>
          `;
        })
        .join("") + (anyFree ? "" : `<p class="slots-empty">Todos los horarios de este dia estan ocupados.</p>`);
  }

  function renderCustomerForm() {
    $$("[data-field]", $("[data-customer-form]")).forEach((field) => {
      field.value = draft[field.dataset.field] || "";
    });
  }

  function summaryHtml({ serviceName, price, durationMinutes, barberName, date, time, customerName, customerPhone, notes }) {
    return `
      <dl>
        <div><dt>Servicio</dt><dd>${escapeHtml(serviceName)} · ${formatMoneyCOP(price)}</dd></div>
        <div><dt>Barbero</dt><dd>${escapeHtml(barberName)}</dd></div>
        <div><dt>Fecha</dt><dd>${escapeHtml(formatDateLong(date))}</dd></div>
        <div><dt>Hora</dt><dd>${escapeHtml(formatTime12h(time))} (${durationMinutes} min)</dd></div>
        <div><dt>Nombre</dt><dd>${escapeHtml(customerName)}</dd></div>
        <div><dt>Telefono</dt><dd>${escapeHtml(customerPhone)}</dd></div>
        ${notes ? `<div><dt>Notas</dt><dd>${escapeHtml(notes)}</dd></div>` : ""}
      </dl>
    `;
  }

  function renderConfirm() {
    const service = findService(draft.serviceId);
    const barber = findBarber(draft.barberId);
    $("[data-booking-error]").hidden = true;
    if (!service || !barber || !draft.date || !draft.time) {
      $("[data-summary]").innerHTML = `<p class="slots-empty">Falta informacion. Vuelve a los pasos anteriores.</p>`;
      return;
    }
    $("[data-summary]").innerHTML = summaryHtml({
      serviceName: service.name,
      price: service.price,
      durationMinutes: service.durationMinutes,
      barberName: barber.name,
      date: draft.date,
      time: draft.time,
      customerName: draft.customerName,
      customerPhone: draft.customerPhone,
      notes: draft.notes,
    });
  }

  function renderPanel() {
    STEPS.forEach((step, index) => {
      $(`[data-panel="${step}"]`).hidden = index !== stepIndex;
    });

    const current = STEPS[stepIndex];
    if (current === "service") renderServiceOptions();
    if (current === "barber") renderBarberOptions();
    if (current === "datetime") {
      renderCalendar();
      renderSlots();
    }
    if (current === "customer") renderCustomerForm();
    if (current === "confirm") renderConfirm();

    renderStepIndicator();
    renderActions();
  }

  function canContinue() {
    switch (STEPS[stepIndex]) {
      case "service":
        return Boolean(findService(draft.serviceId));
      case "barber":
        return barberDoesService(draft.barberId, draft.serviceId);
      case "datetime":
        return Boolean(draft.date && draft.time);
      case "customer":
        return draft.customerName.trim().length > 1 && utils.digitsOnly(draft.customerPhone).length >= 7;
      default:
        return true;
    }
  }

  function renderActions() {
    const isConfirmStep = STEPS[stepIndex] === "confirm";
    $("[data-step-back]").hidden = stepIndex === 0;
    $("[data-step-next]").hidden = isConfirmStep;
    $("[data-step-confirm]").hidden = !isConfirmStep;
    $("[data-step-next]").disabled = !canContinue();
  }

  function goToStep(index) {
    stepIndex = Math.max(0, Math.min(STEPS.length - 1, index));
    furthestStep = Math.max(furthestStep, stepIndex);
    renderPanel();
    if (STEPS[stepIndex] === "datetime") refreshAvailability();
  }

  // Trae los horarios ocupados mas recientes (otras personas pueden estar reservando).
  async function refreshAvailability() {
    try {
      await store.refreshAvailability();
    } catch (error) {
      console.warn("No se pudo actualizar la disponibilidad.", error);
      return;
    }
    data = store.getState();
    if (completed || STEPS[stepIndex] !== "datetime") return;
    renderCalendar();
    renderSlots();
    renderActions();
  }

  function selectedMonthFor(iso) {
    return startOfMonth(parseISODate(iso));
  }

  // ---------- Confirmacion ----------

  async function handleConfirm() {
    const button = $("[data-step-confirm]");
    if (button.disabled) return;
    const label = button.textContent;
    button.disabled = true;
    button.textContent = "Reservando...";
    $("[data-booking-error]").hidden = true;

    try {
      const booking = await store.createBooking({
        serviceId: draft.serviceId,
        barberId: draft.barberId,
        date: draft.date,
        time: draft.time,
        customerName: draft.customerName,
        customerPhone: draft.customerPhone,
        notes: draft.notes,
      });
      showSuccess(booking);
    } catch (error) {
      $("[data-booking-error-text]").textContent = error.message;
      $("[data-booking-error]").hidden = false;
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  }

  function showSuccess(booking) {
    completed = true;
    $$("[data-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.panel !== "success";
    });
    $("[data-booking-steps]").hidden = true;
    $("[data-booking-actions]").hidden = true;

    $("[data-booking-code]").textContent = booking.code;
    $("[data-manage-link]").href = `mi-cita.html?code=${encodeURIComponent(booking.code)}`;
    $("[data-success-summary]").innerHTML = summaryHtml(booking);

    const message = `Hola, acabo de reservar una cita (codigo ${booking.code}): ${booking.serviceName} con ${booking.barberName} el ${formatDateLong(booking.date)} a las ${formatTime12h(booking.time)}. Mi nombre es ${booking.customerName}.`;
    $("[data-whatsapp-notice]").href = whatsAppLink(data.business.whatsapp, message);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---------- Eventos ----------

  function wireEvents() {
    document.addEventListener("click", (event) => {
      const serviceOption = event.target.closest("[data-service-option]");
      if (serviceOption) {
        draft.serviceId = serviceOption.dataset.serviceOption;
        if (draft.barberId && !barberDoesService(draft.barberId, draft.serviceId)) draft.barberId = null;
        draft.date = null;
        draft.time = null;
        renderServiceOptions();
        renderActions();
        return;
      }

      if (event.target.closest("[data-clear-barber]")) {
        draft.barberId = null;
        renderServiceOptions();
        renderActions();
        return;
      }

      const barberOption = event.target.closest("[data-barber-option]");
      if (barberOption) {
        draft.barberId = barberOption.dataset.barberOption;
        draft.date = null;
        draft.time = null;
        renderBarberOptions();
        renderActions();
        return;
      }

      const dayCell = event.target.closest("[data-calendar-day]");
      if (dayCell && !dayCell.disabled) {
        draft.date = dayCell.dataset.calendarDay;
        draft.time = null;
        renderCalendar();
        renderSlots();
        renderActions();
        return;
      }

      const slotButton = event.target.closest("[data-slot]");
      if (slotButton && !slotButton.disabled) {
        draft.time = slotButton.dataset.slot;
        renderSlots();
        renderActions();
        return;
      }

      if (event.target.closest("[data-calendar-prev]")) {
        calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
        renderCalendar();
        return;
      }

      if (event.target.closest("[data-calendar-next]")) {
        calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
        renderCalendar();
        return;
      }

      if (event.target.closest("[data-step-next]")) {
        if (canContinue()) goToStep(stepIndex + 1);
        return;
      }

      if (event.target.closest("[data-step-back]")) {
        goToStep(stepIndex - 1);
        return;
      }

      if (event.target.closest("[data-step-confirm]")) {
        handleConfirm();
        return;
      }

      if (event.target.closest("[data-pick-another-time]")) {
        draft.time = null;
        if (draft.date) calendarMonth = selectedMonthFor(draft.date);
        goToStep(STEPS.indexOf("datetime"));
        return;
      }

      const stepIndicator = event.target.closest("[data-step-indicator]");
      if (stepIndicator) {
        const index = STEPS.indexOf(stepIndicator.dataset.stepIndicator);
        if (index >= 0 && index <= furthestStep) goToStep(index);
      }
    });

    $("[data-customer-form]").addEventListener("input", (event) => {
      const field = event.target.closest("[data-field]");
      if (!field) return;
      draft[field.dataset.field] = field.value;
      renderActions();
    });
  }

  async function start() {
    wireEvents();
    try {
      await store.init();
    } catch (error) {
      console.error(error);
      $("[data-service-options]").innerHTML = `<p class="load-error">No pudimos cargar la agenda. Revisa tu conexion y recarga la pagina.</p>`;
      return;
    }

    data = store.getState();
    setBrand();
    applyQueryParams();
    renderPanel();
    if (STEPS[stepIndex] === "datetime") refreshAvailability();

    store.subscribe((nextState, meta) => {
      if (meta.source !== "external" || completed) return;
      data = nextState;
      setBrand();
      const current = STEPS[stepIndex];
      if (current === "service") renderServiceOptions();
      if (current === "barber") renderBarberOptions();
      if (current === "datetime") {
        renderCalendar();
        renderSlots();
      }
      renderActions();
    });

    setInterval(() => {
      if (document.visibilityState === "visible") refreshAvailability();
    }, AVAILABILITY_REFRESH_MS);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refreshAvailability();
    });
  }

  start();
})();
