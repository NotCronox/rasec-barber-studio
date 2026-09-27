(function () {
  const store = window.RasecStore;
  const auth = window.RasecAuth;
  const utils = window.RasecUtils;
  if (!store || !auth || !utils) return;

  const { escapeHtml, formatMoneyCOP, formatDateLong, formatTime12h, toISODate } = utils;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  let data = store.getState();
  let activeTab = "resumen";

  // ---------- Login / sesion ----------

  function showLogin() {
    $("[data-admin-login]").hidden = false;
    $("[data-admin-shell]").hidden = true;
  }

  function showShell() {
    $("[data-admin-login]").hidden = true;
    $("[data-admin-shell]").hidden = false;
    data = store.getState();
    $("[data-business-name]").textContent = data.business.name;
    $("[data-brand-mark]").textContent = data.business.initials;
    switchTab("resumen");
  }

  function initLoginForm() {
    const form = $("[data-login-form]");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const passwordField = $("[data-login-password]");
      const error = $("[data-login-error]");
      if (auth.login(passwordField.value)) {
        error.hidden = true;
        passwordField.value = "";
        showShell();
      } else {
        error.textContent = "Contrasena incorrecta.";
        error.hidden = false;
      }
    });
  }

  // ---------- Tabs ----------

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
    if (activeTab === "resumen") renderResumen();
    else if (activeTab === "negocio") populateBusinessForm();
    else if (activeTab === "servicios") renderServicesTable();
    else if (activeTab === "barberos") renderBarbersTable();
    else if (activeTab === "horarios") renderHoursForm();
    else if (activeTab === "reservas") renderBookingsTab();
  }

  // ---------- Resumen ----------

  function renderResumen() {
    const todayISO = toISODate(new Date());
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndISO = toISODate(weekEnd);

    const activeBookings = data.bookings.filter((booking) => booking.status !== "cancelada");
    const todayCount = activeBookings.filter((booking) => booking.date === todayISO).length;
    const weekCount = activeBookings.filter((booking) => booking.date >= todayISO && booking.date <= weekEndISO).length;
    const activeServices = data.services.filter((service) => service.available).length;
    const activeBarbers = data.barbers.filter((barber) => barber.available).length;

    const stats = [
      { label: "Reservas hoy", value: todayCount },
      { label: "Reservas en 7 dias", value: weekCount },
      { label: "Servicios activos", value: activeServices },
      { label: "Barberos activos", value: activeBarbers },
    ];

    $("[data-admin-stats]").innerHTML = stats
      .map((stat) => `<article class="admin-stat"><strong>${stat.value}</strong><span>${escapeHtml(stat.label)}</span></article>`)
      .join("");

    const upcoming = activeBookings
      .filter((booking) => booking.date >= todayISO)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
      .slice(0, 5);

    const container = $("[data-admin-upcoming]");
    if (!upcoming.length) {
      container.innerHTML = `<p class="admin-empty">No hay reservas proximas.</p>`;
      return;
    }

    container.innerHTML = `
      <ul class="admin-upcoming-list">
        ${upcoming
          .map((booking) => {
            const service = data.services.find((item) => item.id === booking.serviceId);
            const barber = data.barbers.find((item) => item.id === booking.barberId);
            return `
              <li>
                <strong>${escapeHtml(formatDateLong(booking.date))} · ${escapeHtml(formatTime12h(booking.time))}</strong>
                <span>${escapeHtml(booking.customerName)} — ${escapeHtml(service ? service.name : "servicio eliminado")} con ${escapeHtml(barber ? barber.name : "barbero eliminado")}</span>
              </li>
            `;
          })
          .join("")}
      </ul>
    `;
  }

  // ---------- Negocio ----------

  function populateBusinessForm() {
    const form = $("[data-business-form]");
    const values = {
      name: data.business.name,
      shortName: data.business.shortName,
      initials: data.business.initials,
      subtitle: data.business.subtitle,
      description: data.business.description,
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
    Object.entries(values).forEach(([key, value]) => {
      const field = form.querySelector(`[data-field="${key}"]`);
      if (field) field.value = value || "";
    });
  }

  function handleBusinessSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const val = (key) => form.querySelector(`[data-field="${key}"]`).value.trim();

    store.updateBusiness({
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
    });
    store.updateHero({
      eyebrow: val("heroEyebrow"),
      title: val("heroTitle"),
      text: val("heroText"),
      primaryCta: val("heroPrimaryCta"),
    });
    store.updateNotes({ title: val("notesTitle"), body: val("notesBody") });
    store.updateCta({ title: val("ctaTitle"), text: val("ctaText") });

    data = store.getState();
    $("[data-business-name]").textContent = data.business.name;
    $("[data-brand-mark]").textContent = data.business.initials;
    flashSaved("[data-business-saved]");
  }

  // ---------- Servicios ----------

  function renderServicesTable() {
    const tbody = $("[data-services-table] tbody");
    if (!data.services.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="admin-empty">Sin servicios todavia.</td></tr>`;
      return;
    }
    tbody.innerHTML = data.services
      .map(
        (service) => `
          <tr>
            <td>${escapeHtml(service.name)}</td>
            <td>${formatMoneyCOP(service.price)}</td>
            <td>${service.durationMinutes} min</td>
            <td><span class="badge ${service.available ? "badge--ok" : "badge--off"}">${service.available ? "Disponible" : "Pausado"}</span></td>
            <td class="admin-table__actions">
              <button type="button" class="admin-link-button" data-edit-service="${escapeHtml(service.id)}">Editar</button>
              <button type="button" class="admin-link-button admin-link-button--danger" data-delete-service="${escapeHtml(service.id)}">Eliminar</button>
            </td>
          </tr>
        `
      )
      .join("");
  }

  function serviceFormHtml(service) {
    return `
      <form data-modal-form class="admin-form admin-form--modal">
        <label>Nombre <input data-field="name" required value="${escapeHtml(service.name)}" /></label>
        <label class="admin-form__full">Descripcion <textarea data-field="description" rows="2">${escapeHtml(service.description)}</textarea></label>
        <label>Precio (COP) <input type="number" min="0" step="1000" data-field="price" required value="${service.price ?? 0}" /></label>
        <label>Duracion (minutos) <input type="number" min="5" step="5" data-field="durationMinutes" required value="${service.durationMinutes ?? 30}" /></label>
        <label class="admin-form__full">Imagen (URL) <input type="url" data-field="image" required value="${escapeHtml(service.image)}" /></label>
        <label class="admin-form__full">Tags (separados por coma) <input data-field="tags" value="${escapeHtml((service.tags || []).join(", "))}" /></label>
        <label class="admin-checkbox"><input type="checkbox" data-field="available" ${service.available ? "checked" : ""} /> Disponible</label>
        <div class="admin-form__actions">
          <button type="submit" class="button button--primary">Guardar</button>
        </div>
      </form>
    `;
  }

  function openServiceModal(service) {
    const isEdit = Boolean(service);
    const source = service || { name: "", description: "", price: 25000, durationMinutes: 30, image: "", tags: [], available: true };

    openModal({
      title: isEdit ? "Editar servicio" : "Agregar servicio",
      bodyHtml: serviceFormHtml(source),
      onSubmit: (form) => {
        const record = {
          id: isEdit ? source.id : null,
          name: form.querySelector('[data-field="name"]').value.trim(),
          description: form.querySelector('[data-field="description"]').value.trim(),
          price: Number(form.querySelector('[data-field="price"]').value) || 0,
          durationMinutes: Number(form.querySelector('[data-field="durationMinutes"]').value) || 0,
          image: form.querySelector('[data-field="image"]').value.trim(),
          tags: form
            .querySelector('[data-field="tags"]')
            .value.split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          available: form.querySelector('[data-field="available"]').checked,
          currency: "COP",
        };
        store.saveService(record);
        data = store.getState();
        closeModal();
        renderServicesTable();
      },
    });
  }

  // ---------- Barberos ----------

  function renderBarbersTable() {
    const tbody = $("[data-barbers-table] tbody");
    if (!data.barbers.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="admin-empty">Sin barberos todavia.</td></tr>`;
      return;
    }
    tbody.innerHTML = data.barbers
      .map(
        (barber) => `
          <tr>
            <td>${escapeHtml(barber.name)}</td>
            <td>${escapeHtml(barber.specialty)}</td>
            <td>${(barber.gallery || []).length} fotos</td>
            <td><span class="badge ${barber.available ? "badge--ok" : "badge--off"}">${barber.available ? "Disponible" : "Pausado"}</span></td>
            <td class="admin-table__actions">
              <button type="button" class="admin-link-button" data-edit-barber="${escapeHtml(barber.id)}">Editar</button>
              <button type="button" class="admin-link-button admin-link-button--danger" data-delete-barber="${escapeHtml(barber.id)}">Eliminar</button>
            </td>
          </tr>
        `
      )
      .join("");
  }

  function galleryRowHtml(item) {
    const src = item ? item.src : "";
    const alt = item ? item.alt : "";
    return `
      <div class="admin-gallery-row">
        <input type="url" placeholder="URL de la imagen" data-gallery-src value="${escapeHtml(src)}" />
        <input type="text" placeholder="Descripcion" data-gallery-alt value="${escapeHtml(alt)}" />
        <button type="button" class="admin-link-button admin-link-button--danger" data-remove-gallery-row>Quitar</button>
      </div>
    `;
  }

  function barberFormHtml(barber) {
    return `
      <form data-modal-form class="admin-form admin-form--modal">
        <label>Nombre <input data-field="name" required value="${escapeHtml(barber.name)}" /></label>
        <label>Especialidad <input data-field="specialty" value="${escapeHtml(barber.specialty)}" /></label>
        <label class="admin-form__full">Bio <textarea data-field="bio" rows="2">${escapeHtml(barber.bio)}</textarea></label>
        <label class="admin-form__full">Foto principal (URL) <input type="url" data-field="image" required value="${escapeHtml(barber.image)}" /></label>
        <label class="admin-checkbox"><input type="checkbox" data-field="available" ${barber.available ? "checked" : ""} /> Disponible</label>
        <div class="admin-form__full admin-gallery-editor">
          <h4>Galeria de trabajos</h4>
          <div data-gallery-rows>${(barber.gallery || []).map(galleryRowHtml).join("")}</div>
          <button type="button" class="admin-link-button" data-add-gallery-row>+ Agregar foto</button>
        </div>
        <div class="admin-form__actions">
          <button type="submit" class="button button--primary">Guardar</button>
        </div>
      </form>
    `;
  }

  function openBarberModal(barber) {
    const isEdit = Boolean(barber);
    const source = barber || { name: "", specialty: "", bio: "", image: "", available: true, gallery: [] };

    openModal({
      title: isEdit ? "Editar barbero" : "Agregar barbero",
      bodyHtml: barberFormHtml(source),
      onSubmit: (form) => {
        const gallery = Array.from(form.querySelectorAll(".admin-gallery-row"))
          .map((row) => ({
            src: row.querySelector("[data-gallery-src]").value.trim(),
            alt: row.querySelector("[data-gallery-alt]").value.trim(),
          }))
          .filter((item) => item.src);

        const record = {
          id: isEdit ? source.id : null,
          name: form.querySelector('[data-field="name"]').value.trim(),
          specialty: form.querySelector('[data-field="specialty"]').value.trim(),
          bio: form.querySelector('[data-field="bio"]').value.trim(),
          image: form.querySelector('[data-field="image"]').value.trim(),
          available: form.querySelector('[data-field="available"]').checked,
          gallery,
        };
        store.saveBarber(record);
        data = store.getState();
        closeModal();
        renderBarbersTable();
      },
    });
  }

  // ---------- Horarios ----------

  function renderHoursForm() {
    const tbody = $("[data-hours-body]");
    tbody.innerHTML = data.hours
      .map(
        (day, index) => `
          <tr data-hour-row="${index}">
            <td>${escapeHtml(day.day)}</td>
            <td><input type="checkbox" data-hour-open ${day.open ? "checked" : ""} /></td>
            <td><input type="time" data-hour-start value="${day.start || ""}" ${day.open ? "" : "disabled"} /></td>
            <td><input type="time" data-hour-end value="${day.end || ""}" ${day.open ? "" : "disabled"} /></td>
          </tr>
        `
      )
      .join("");
  }

  function handleHoursSubmit(event) {
    event.preventDefault();
    const rows = $$("[data-hour-row]");
    const hours = rows.map((row, index) => {
      const open = row.querySelector("[data-hour-open]").checked;
      const start = row.querySelector("[data-hour-start]").value || null;
      const end = row.querySelector("[data-hour-end]").value || null;
      return {
        day: data.hours[index].day,
        open,
        start: open ? start : null,
        end: open ? end : null,
      };
    });
    store.saveHours(hours);
    data = store.getState();
    flashSaved("[data-hours-saved]");
  }

  // ---------- Reservas ----------

  function renderBookingsTab() {
    const barberSelect = $("[data-filter-barber]");
    const currentBarberFilter = barberSelect.value;
    barberSelect.innerHTML =
      `<option value="">Todos</option>` +
      data.barbers.map((barber) => `<option value="${escapeHtml(barber.id)}" ${barber.id === currentBarberFilter ? "selected" : ""}>${escapeHtml(barber.name)}</option>`).join("");

    renderBookingsTable();
  }

  function renderBookingsTable() {
    const barberFilter = $("[data-filter-barber]").value;
    const statusFilter = $("[data-filter-status]").value;
    const dateFilter = $("[data-filter-date]").value;

    let bookings = [...data.bookings];
    if (barberFilter) bookings = bookings.filter((booking) => booking.barberId === barberFilter);
    if (statusFilter) bookings = bookings.filter((booking) => booking.status === statusFilter);
    if (dateFilter) bookings = bookings.filter((booking) => booking.date >= dateFilter);
    bookings.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

    const tbody = $("[data-bookings-table] tbody");
    if (!bookings.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="admin-empty">No hay reservas con estos filtros.</td></tr>`;
      return;
    }

    tbody.innerHTML = bookings
      .map((booking) => {
        const service = data.services.find((item) => item.id === booking.serviceId);
        const barber = data.barbers.find((item) => item.id === booking.barberId);
        return `
          <tr>
            <td>${escapeHtml(formatDateLong(booking.date))}</td>
            <td>${escapeHtml(formatTime12h(booking.time))}</td>
            <td>${escapeHtml(booking.customerName)}<br /><small>${escapeHtml(booking.customerPhone)}</small></td>
            <td>${escapeHtml(service ? service.name : "(eliminado)")}</td>
            <td>${escapeHtml(barber ? barber.name : "(eliminado)")}</td>
            <td>
              <select data-booking-status="${escapeHtml(booking.id)}">
                <option value="pendiente" ${booking.status === "pendiente" ? "selected" : ""}>Pendiente</option>
                <option value="confirmada" ${booking.status === "confirmada" ? "selected" : ""}>Confirmada</option>
                <option value="cancelada" ${booking.status === "cancelada" ? "selected" : ""}>Cancelada</option>
              </select>
            </td>
            <td><button type="button" class="admin-link-button admin-link-button--danger" data-delete-booking="${escapeHtml(booking.id)}">Eliminar</button></td>
          </tr>
        `;
      })
      .join("");
  }

  // ---------- Modal generico ----------

  function openModal({ title, bodyHtml, onSubmit }) {
    const modal = $("[data-modal]");
    $("[data-modal-title]").textContent = title;
    $("[data-modal-body]").innerHTML = bodyHtml;
    modal.hidden = false;
    modal.classList.add("is-open");

    const form = $("[data-modal-form]", $("[data-modal-body]"));
    if (form && onSubmit) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        onSubmit(form);
      });
    }
  }

  function closeModal() {
    const modal = $("[data-modal]");
    modal.hidden = true;
    modal.classList.remove("is-open");
    $("[data-modal-body]").innerHTML = "";
  }

  function flashSaved(selector) {
    const el = $(selector);
    if (!el) return;
    el.hidden = false;
    clearTimeout(el._hideTimeout);
    el._hideTimeout = setTimeout(() => {
      el.hidden = true;
    }, 2000);
  }

  // ---------- Delegacion de eventos ----------

  function handleGlobalClick(event) {
    const tabButton = event.target.closest("[data-admin-tab]");
    if (tabButton) {
      switchTab(tabButton.dataset.adminTab);
      return;
    }

    if (event.target.closest("[data-admin-logout]")) {
      auth.logout();
      showLogin();
      return;
    }

    if (event.target.closest("[data-add-service]")) {
      openServiceModal(null);
      return;
    }
    const editService = event.target.closest("[data-edit-service]");
    if (editService) {
      openServiceModal(data.services.find((service) => service.id === editService.dataset.editService));
      return;
    }
    const deleteService = event.target.closest("[data-delete-service]");
    if (deleteService) {
      if (confirm("¿Eliminar este servicio?")) {
        store.deleteService(deleteService.dataset.deleteService);
        data = store.getState();
        renderServicesTable();
      }
      return;
    }

    if (event.target.closest("[data-add-barber]")) {
      openBarberModal(null);
      return;
    }
    const editBarber = event.target.closest("[data-edit-barber]");
    if (editBarber) {
      openBarberModal(data.barbers.find((barber) => barber.id === editBarber.dataset.editBarber));
      return;
    }
    const deleteBarber = event.target.closest("[data-delete-barber]");
    if (deleteBarber) {
      if (confirm("¿Eliminar este barbero?")) {
        store.deleteBarber(deleteBarber.dataset.deleteBarber);
        data = store.getState();
        renderBarbersTable();
      }
      return;
    }

    if (event.target.closest("[data-add-gallery-row]")) {
      const container = $("[data-gallery-rows]", $("[data-modal-body]"));
      if (container) container.insertAdjacentHTML("beforeend", galleryRowHtml(null));
      return;
    }
    if (event.target.closest("[data-remove-gallery-row]")) {
      event.target.closest(".admin-gallery-row")?.remove();
      return;
    }

    const deleteBooking = event.target.closest("[data-delete-booking]");
    if (deleteBooking) {
      if (confirm("¿Eliminar esta reserva?")) {
        store.deleteBooking(deleteBooking.dataset.deleteBooking);
        data = store.getState();
        renderBookingsTable();
      }
      return;
    }

    if (event.target.closest("[data-reset-demo]")) {
      if (confirm("Esto borra las reservas y los cambios, y vuelve a los datos de ejemplo originales. ¿Continuar?")) {
        store.resetToDefaults();
        data = store.getState();
        renderActiveTab();
      }
      return;
    }

    if (event.target.matches("[data-modal-close]")) {
      closeModal();
    }
  }

  function handleGlobalChange(event) {
    if (event.target.matches("[data-hour-open]")) {
      const row = event.target.closest("[data-hour-row]");
      const isOpen = event.target.checked;
      row.querySelector("[data-hour-start]").disabled = !isOpen;
      row.querySelector("[data-hour-end]").disabled = !isOpen;
      return;
    }

    if (event.target.matches("[data-booking-status]")) {
      store.updateBookingStatus(event.target.dataset.bookingStatus, event.target.value);
      data = store.getState();
      renderBookingsTable();
      return;
    }

    if (event.target.matches("[data-filter-barber], [data-filter-status], [data-filter-date]")) {
      renderBookingsTable();
    }
  }

  // ---------- Init ----------

  initLoginForm();
  $("[data-business-form]").addEventListener("submit", handleBusinessSubmit);
  $("[data-hours-form]").addEventListener("submit", handleHoursSubmit);
  document.addEventListener("click", handleGlobalClick);
  document.addEventListener("change", handleGlobalChange);

  window.addEventListener("storage", (event) => {
    if (event.key === store.STORAGE_KEY && !$("[data-admin-shell]").hidden) {
      data = store.getState();
      renderActiveTab();
    }
  });

  if (auth.isAuthenticated()) {
    showShell();
  } else {
    showLogin();
  }
})();
