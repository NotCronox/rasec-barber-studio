(function () {
  const store = window.RasecStore;
  const utils = window.RasecUtils;
  if (!store || !utils) return;

  const { escapeHtml, formatMoneyCOP, formatDateLong, formatTime12h, toISODate, weekdayLabelFor } = utils;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const data = store.getState();

  const STEPS = ["service", "barber", "datetime", "customer", "confirm"];
  const STEP_LABEL = { pendiente: "Pendiente", confirmada: "Confirmada", cancelada: "Cancelada" };
  const SLOT_STEP_MINUTES = 30;

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
  let lastBooking = null;

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function findService(id) {
    return data.services.find((service) => service.id === id && service.available);
  }

  function findBarber(id) {
    return data.barbers.find((barber) => barber.id === id && barber.available);
  }

  function applyQueryParams() {
    const params = new URLSearchParams(location.search);
    const serviceId = params.get("service");
    const barberId = params.get("barber");
    if (serviceId && findService(serviceId)) draft.serviceId = serviceId;
    if (barberId && findBarber(barberId)) draft.barberId = barberId;

    if (draft.serviceId && draft.barberId) {
      stepIndex = 2;
    } else if (draft.serviceId) {
      stepIndex = 1;
    }
    furthestStep = stepIndex;
  }

  function setBrand() {
    if (data.business) {
      const mark = $("[data-brand-mark]");
      const name = $("[data-business-name]");
      if (mark) mark.textContent = data.business.initials;
      if (name) name.textContent = data.business.name;
    }
  }

  function renderStepIndicator() {
    $$("[data-step-indicator]").forEach((item, index) => {
      item.classList.toggle("is-active", index === stepIndex);
      item.classList.toggle("is-done", index < stepIndex);
      item.classList.toggle("is-reachable", index <= furthestStep);
    });
  }

  function renderServiceOptions() {
    const container = $("[data-service-options]");
    if (!container) return;
    const services = data.services.filter((service) => service.available);
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
    if (!container) return;
    const barbers = data.barbers.filter((barber) => barber.available);
    container.innerHTML = barbers
      .map(
        (barber) => `
          <button type="button" class="booking-option booking-option--barber ${draft.barberId === barber.id ? "is-selected" : ""}" data-barber-option="${escapeHtml(barber.id)}">
            <img src="${escapeHtml(barber.image)}" alt="${escapeHtml(barber.name)}" loading="lazy" />
            <strong>${escapeHtml(barber.name)}</strong>
            <span>${escapeHtml(barber.specialty)}</span>
          </button>
        `
      )
      .join("");
  }

  function renderCalendar() {
    const grid = $("[data-calendar-grid]");
    const label = $("[data-calendar-label]");
    const prevButton = $("[data-calendar-prev]");
    if (!grid || !label) return;

    label.textContent = calendarMonth.toLocaleDateString("es-CO", { month: "long", year: "numeric" });

    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayISO = toISODate(new Date());
    const currentMonthStart = startOfMonth(new Date());

    if (prevButton) prevButton.disabled = calendarMonth <= currentMonthStart;

    let html = "";
    for (let i = 0; i < startOffset; i++) {
      html += `<span class="calendar__cell calendar__cell--empty"></span>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const cellDate = new Date(year, month, day);
      const iso = toISODate(cellDate);
      const weekday = weekdayLabelFor(cellDate);
      const hoursDay = data.hours.find((item) => item.day === weekday);
      const isPast = iso < todayISO;
      const isClosed = !hoursDay || !hoursDay.open;
      const disabled = isPast || isClosed;
      const isSelected = draft.date === iso;

      html += `
        <button type="button"
          class="calendar__cell ${disabled ? "is-disabled" : ""} ${isSelected ? "is-selected" : ""}"
          data-calendar-day="${iso}"
          ${disabled ? "disabled" : ""}
        >${day}</button>
      `;
    }

    grid.innerHTML = html;
  }

  function renderSlots() {
    const container = $("[data-slots]");
    if (!container) return;

    if (!draft.date) {
      container.innerHTML = `<p class="slots-empty">Elige un dia en el calendario.</p>`;
      return;
    }

    const service = findService(draft.serviceId);
    if (!service) {
      container.innerHTML = `<p class="slots-empty">Elige primero un servicio.</p>`;
      return;
    }

    const weekday = weekdayLabelFor(utils.parseISODate(draft.date));
    const hoursDay = data.hours.find((item) => item.day === weekday);

    if (!hoursDay || !hoursDay.open) {
      container.innerHTML = `<p class="slots-empty">Cerrado ese dia. Elige otra fecha.</p>`;
      return;
    }

    const openMinutes = store.timeToMinutes(hoursDay.start);
    const closeMinutes = store.timeToMinutes(hoursDay.end);
    const isToday = draft.date === toISODate(new Date());
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const slots = [];
    for (let cursor = openMinutes; cursor + service.durationMinutes <= closeMinutes; cursor += SLOT_STEP_MINUTES) {
      slots.push(cursor);
    }

    if (!slots.length) {
      container.innerHTML = `<p class="slots-empty">No hay horarios para este servicio ese dia.</p>`;
      return;
    }

    let anyAvailable = false;
    const buttons = slots
      .map((minutes) => {
        const time = store.minutesToTime(minutes);
        const isPast = isToday && minutes <= nowMinutes;
        const isTaken = store.findConflict(draft.barberId, draft.date, minutes, service.durationMinutes);
        const disabled = isPast || isTaken;
        if (!disabled) anyAvailable = true;
        const isSelected = draft.time === time;
        return `
          <button type="button"
            class="slot ${disabled ? "is-disabled" : ""} ${isSelected ? "is-selected" : ""}"
            data-slot="${time}"
            ${disabled ? "disabled" : ""}
            title="${isTaken ? "Ya reservado" : ""}"
          >${formatTime12h(time)}</button>
        `;
      })
      .join("");

    container.innerHTML = buttons + (anyAvailable ? "" : `<p class="slots-empty">Todos los horarios de este dia estan ocupados.</p>`);
  }

  function renderCustomerForm() {
    $$("[data-field]", $("[data-customer-form]")).forEach((field) => {
      const key = field.dataset.field;
      field.value = draft[key] || "";
    });
  }

  function buildSummaryHtml() {
    const service = findService(draft.serviceId);
    const barber = findBarber(draft.barberId);
    if (!service || !barber || !draft.date || !draft.time) return "";

    return `
      <dl>
        <div><dt>Servicio</dt><dd>${escapeHtml(service.name)} · ${formatMoneyCOP(service.price)}</dd></div>
        <div><dt>Barbero</dt><dd>${escapeHtml(barber.name)}</dd></div>
        <div><dt>Fecha</dt><dd>${escapeHtml(formatDateLong(draft.date))}</dd></div>
        <div><dt>Hora</dt><dd>${escapeHtml(formatTime12h(draft.time))} (${service.durationMinutes} min)</dd></div>
        <div><dt>Nombre</dt><dd>${escapeHtml(draft.customerName)}</dd></div>
        <div><dt>Telefono</dt><dd>${escapeHtml(draft.customerPhone)}</dd></div>
        ${draft.notes ? `<div><dt>Notas</dt><dd>${escapeHtml(draft.notes)}</dd></div>` : ""}
      </dl>
    `;
  }

  function renderConfirm() {
    const summary = $("[data-summary]");
    if (summary) summary.innerHTML = buildSummaryHtml();
    const error = $("[data-booking-error]");
    if (error) {
      error.hidden = true;
      error.textContent = "";
    }
  }

  function renderPanel() {
    STEPS.forEach((step, index) => {
      const panel = $(`[data-panel="${step}"]`);
      if (panel) panel.hidden = index !== stepIndex;
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
        return Boolean(draft.serviceId);
      case "barber":
        return Boolean(draft.barberId);
      case "datetime":
        return Boolean(draft.date && draft.time);
      case "customer":
        return draft.customerName.trim().length > 1 && draft.customerPhone.replace(/\D/g, "").length >= 7;
      default:
        return true;
    }
  }

  function renderActions() {
    const backButton = $("[data-step-back]");
    const nextButton = $("[data-step-next]");
    const confirmButton = $("[data-step-confirm]");

    if (backButton) backButton.hidden = stepIndex === 0;

    const isConfirmStep = STEPS[stepIndex] === "confirm";
    if (nextButton) nextButton.hidden = isConfirmStep;
    if (confirmButton) confirmButton.hidden = !isConfirmStep;

    if (nextButton) nextButton.disabled = !canContinue();
  }

  function goToStep(index) {
    stepIndex = Math.max(0, Math.min(STEPS.length - 1, index));
    furthestStep = Math.max(furthestStep, stepIndex);
    renderPanel();
  }

  function handleNext() {
    if (!canContinue()) return;
    goToStep(stepIndex + 1);
  }

  function handleBack() {
    goToStep(stepIndex - 1);
  }

  function handleConfirm() {
    const service = findService(draft.serviceId);
    const barber = findBarber(draft.barberId);
    const error = $("[data-booking-error]");

    if (!service || !barber || !draft.date || !draft.time) {
      if (error) {
        error.textContent = "Falta informacion para confirmar la cita.";
        error.hidden = false;
      }
      return;
    }

    try {
      const booking = store.createBooking({
        serviceId: service.id,
        barberId: barber.id,
        date: draft.date,
        time: draft.time,
        durationMinutes: service.durationMinutes,
        customerName: draft.customerName.trim(),
        customerPhone: draft.customerPhone.trim(),
        notes: draft.notes.trim(),
      });
      lastBooking = booking;
      showSuccess(service, barber, booking);
    } catch (submitError) {
      if (error) {
        error.textContent = submitError.message;
        error.hidden = false;
      }
      renderSlots();
    }
  }

  function showSuccess(service, barber, booking) {
    $$("[data-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.panel !== "success";
    });

    const stepsList = $("[data-booking-steps]");
    if (stepsList) stepsList.hidden = true;

    const actions = $("[data-booking-actions]");
    if (actions) actions.hidden = true;

    const summary = $("[data-success-summary]");
    if (summary) summary.innerHTML = buildSummaryHtml();

    const whatsappLink = $("[data-whatsapp-notice]");
    if (whatsappLink && data.business) {
      const message = `Hola, acabo de agendar una cita: ${service.name} con ${barber.name} el ${formatDateLong(draft.date)} a las ${formatTime12h(draft.time)}. Mi nombre es ${draft.customerName}.`;
      const phone = data.business.whatsapp.replace(/\D/g, "");
      whatsappLink.href = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    }
  }

  function wireEvents() {
    document.addEventListener("click", (event) => {
      const serviceOption = event.target.closest("[data-service-option]");
      if (serviceOption) {
        draft.serviceId = serviceOption.dataset.serviceOption;
        draft.date = null;
        draft.time = null;
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
        handleNext();
        return;
      }

      if (event.target.closest("[data-step-back]")) {
        handleBack();
        return;
      }

      if (event.target.closest("[data-step-confirm]")) {
        handleConfirm();
        return;
      }

      const stepIndicator = event.target.closest("[data-step-indicator]");
      if (stepIndicator) {
        const index = STEPS.indexOf(stepIndicator.dataset.stepIndicator);
        if (index >= 0 && index <= furthestStep) goToStep(index);
      }
    });

    const form = $("[data-customer-form]");
    if (form) {
      form.addEventListener("input", (event) => {
        const field = event.target.closest("[data-field]");
        if (!field) return;
        draft[field.dataset.field] = field.value;
        renderActions();
      });
    }
  }

  setBrand();
  applyQueryParams();
  wireEvents();
  renderPanel();
})();
