(function () {
  const store = window.RasecStore;
  const utils = window.RasecUtils;

  if (!store || !utils) return;

  const { escapeHtml, formatMoneyCOP, formatHourRange } = utils;

  let data = store.getState();

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function setText(selector, text) {
    const node = $(selector);
    if (node && text) node.textContent = text;
  }

  function buildWhatsAppLink(message) {
    const phone = data.business.whatsapp.replace(/\D/g, "");
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }

  function buildMapEmbedUrl(query) {
    return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
  }

  function buildMapsLink(query) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  function createTagList(tags) {
    return tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
  }

  function renderHeader() {
    setText("[data-business-name]", data.business.name);
    setText("[data-business-subtitle]", data.business.subtitle);
    setText("[data-brand-mark]", data.business.initials);
  }

  function renderHero() {
    const heroImage = $("[data-hero-image]");
    if (heroImage) heroImage.src = data.media.hero;

    setText("[data-hero-eyebrow]", data.hero.eyebrow);
    setText("[data-hero-title]", data.hero.title);
    setText("[data-hero-text]", data.hero.text);
    setText("[data-main-cta]", data.hero.primaryCta);
  }

  function renderHighlights() {
    const container = $("[data-highlights]");
    if (!container) return;

    container.innerHTML = data.identity.highlights
      .map(
        (item) => `
          <article>
            <strong>${escapeHtml(item.value)}</strong>
            <span>${escapeHtml(item.label)}</span>
          </article>
        `
      )
      .join("");
  }

  function renderIntro() {
    setText("[data-intro-title]", data.business.description);
    setText("[data-intro-text]", data.identity.concept);

    const promiseList = $("[data-promise-list]");
    if (!promiseList) return;

    promiseList.innerHTML = data.identity.promise.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  }

  function renderServices() {
    const container = $("[data-services]");
    if (!container) return;

    container.innerHTML = data.services
      .map(
        (service) => `
          <article class="service-card">
            <img src="${escapeHtml(service.image)}" alt="${escapeHtml(service.name)}" loading="lazy" />
            <div class="service-card__body">
              <div class="service-card__top">
                <div>
                  <h3>${escapeHtml(service.name)}</h3>
                  <p>${escapeHtml(service.description)}</p>
                </div>
                <span class="status ${service.available ? "status--open" : "status--closed"}">
                  ${service.available ? "Disponible" : "Pausado"}
                </span>
              </div>
              <div class="tag-list">${createTagList(service.tags)}</div>
              <div class="service-card__meta">
                <strong>${formatMoneyCOP(service.price)}</strong>
                <span>${service.durationMinutes} min</span>
              </div>
              <a class="button button--small" href="reserva.html?service=${encodeURIComponent(service.id)}">
                Reservar
              </a>
            </div>
          </article>
        `
      )
      .join("");
  }

  function renderBarbers() {
    const container = $("[data-barbers]");
    if (!container) return;

    container.innerHTML = data.barbers
      .map(
        (barber) => `
          <article class="barber-card">
            <img src="${escapeHtml(barber.image)}" alt="${escapeHtml(barber.name)}" loading="lazy" />
            <div class="barber-card__body">
              <span class="status ${barber.available ? "status--open" : "status--closed"}">
                ${barber.available ? "Agenda abierta" : "No disponible"}
              </span>
              <h3>${escapeHtml(barber.name)}</h3>
              <p class="barber-card__specialty">${escapeHtml(barber.specialty)}</p>
              <p>${escapeHtml(barber.bio)}</p>
              <div class="barber-card__actions">
                <a class="button button--small button--light" href="reserva.html?barber=${encodeURIComponent(barber.id)}">
                  Reservar
                </a>
                ${
                  barber.gallery && barber.gallery.length
                    ? `<button type="button" class="button button--small button--outline-light" data-open-gallery="${escapeHtml(barber.id)}">
                        Ver galeria
                      </button>`
                    : ""
                }
              </div>
            </div>
          </article>
        `
      )
      .join("");
  }

  function setupGalleryModal() {
    const modal = $("[data-gallery-modal]");
    const grid = $("[data-gallery-grid]");
    const title = $("[data-gallery-title]");
    if (!modal || !grid || !title) return;

    function openGallery(barberId) {
      const barber = data.barbers.find((item) => item.id === barberId);
      if (!barber || !barber.gallery || !barber.gallery.length) return;

      title.textContent = `Trabajos de ${barber.name}`;
      grid.innerHTML = barber.gallery
        .map((item) => `<figure><img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.alt)}" loading="lazy" /></figure>`)
        .join("");

      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("no-scroll");
    }

    function closeGallery() {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("no-scroll");
    }

    $$("[data-open-gallery]").forEach((button) => {
      button.addEventListener("click", () => openGallery(button.dataset.openGallery));
    });

    $$("[data-gallery-close]").forEach((element) => {
      element.addEventListener("click", closeGallery);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeGallery();
    });
  }

  function renderInfo() {
    const list = $("[data-info-panel]");
    if (list) {
      const items = [
        { label: "Direccion", value: `${data.business.address}, ${data.business.city}` },
        { label: "Zona", value: data.business.neighborhood },
        { label: "Contacto", value: data.business.phone },
        { label: "Instagram", value: data.business.instagram },
      ];

      list.innerHTML = items
        .map(
          (item) => `
            <article>
              <span>${escapeHtml(item.label)}</span>
              <strong>${escapeHtml(item.value)}</strong>
            </article>
          `
        )
        .join("");
    }

    const mapQuery = data.business.mapQuery || `${data.business.neighborhood}, ${data.business.city}, Colombia`;
    const mapFrame = $("[data-map-frame]");
    if (mapFrame) mapFrame.src = buildMapEmbedUrl(mapQuery);

    const mapsLink = $("[data-maps-link]");
    if (mapsLink) mapsLink.href = buildMapsLink(mapQuery);
  }

  function renderHours() {
    const container = $("[data-hours]");
    if (!container) return;

    container.innerHTML = data.hours
      .map(
        (item) => `
          <article class="${item.open ? "" : "is-closed"}">
            <strong>${escapeHtml(item.day)}</strong>
            <span>${escapeHtml(formatHourRange(item))}</span>
          </article>
        `
      )
      .join("");

    const note = $("[data-note-panel]");
    if (note) {
      note.innerHTML = `
        <h3>${escapeHtml(data.notes.title)}</h3>
        <p>${escapeHtml(data.notes.body)}</p>
        <a href="${buildWhatsAppLink(data.cta.whatsappMessage)}">${escapeHtml(data.business.phone)}</a>
      `;
    }
  }

  function renderCta() {
    setText("[data-cta-title]", data.cta.title);
    setText("[data-cta-text]", data.cta.text);
    setText("[data-footer-brand]", data.business.name);
    setText("[data-footer-copy]", `${data.business.neighborhood}, ${data.business.city} · ${data.business.instagram}`);
  }

  function setupNavigation() {
    const toggle = $("[data-menu-toggle]");
    const nav = $("[data-primary-nav]");

    if (!toggle || !nav) return;

    toggle.addEventListener("click", () => {
      const isOpen = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!isOpen));
      nav.classList.toggle("is-open", !isOpen);
    });

    $$("#primary-nav a").forEach((link) => {
      link.addEventListener("click", () => {
        toggle.setAttribute("aria-expanded", "false");
        nav.classList.remove("is-open");
      });
    });
  }

  function renderAll() {
    renderHeader();
    renderHero();
    renderHighlights();
    renderIntro();
    renderServices();
    renderBarbers();
    renderInfo();
    renderHours();
    renderCta();
    setupGalleryModal();
  }

  renderAll();
  setupNavigation();

  window.addEventListener("storage", (event) => {
    if (event.key === store.STORAGE_KEY) {
      data = store.getState();
      renderAll();
    }
  });
})();
