(function () {
  const store = window.RasecStore;
  const utils = window.RasecUtils;

  if (!store || !utils) return;

  const { escapeHtml, formatMoneyCOP, formatHourRange, whatsAppLink } = utils;

  let data = null;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function setText(selector, text) {
    const node = $(selector);
    if (node && text) node.textContent = text;
  }

  function buildMapEmbedUrl(query) {
    return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
  }

  function buildMapsLink(query) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  function isServiceBookable(service) {
    return service.available && data.barbers.some((barber) => barber.available && barber.serviceIds.includes(service.id));
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
      .map((service) => {
        const bookable = isServiceBookable(service);
        return `
          <article class="service-card">
            <img src="${escapeHtml(service.image)}" alt="${escapeHtml(service.name)}" loading="lazy" />
            <div class="service-card__body">
              <div class="service-card__top">
                <div>
                  <h3>${escapeHtml(service.name)}</h3>
                  <p>${escapeHtml(service.description)}</p>
                </div>
                <span class="status ${bookable ? "status--open" : "status--closed"}">
                  ${bookable ? "Disponible" : "Pausado"}
                </span>
              </div>
              <div class="tag-list">${createTagList(service.tags)}</div>
              <div class="service-card__meta">
                <strong>${formatMoneyCOP(service.price)}</strong>
                <span>${service.durationMinutes} min</span>
              </div>
              ${
                bookable
                  ? `<a class="button button--small" href="reserva.html?service=${encodeURIComponent(service.id)}">Reservar</a>`
                  : `<span class="button button--small button--disabled" aria-disabled="true">No disponible por ahora</span>`
              }
            </div>
          </article>
        `;
      })
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
              ${
                barber.daysOff.length
                  ? `<p class="barber-card__rest">Descansa: ${escapeHtml(barber.daysOff.join(", "))}</p>`
                  : ""
              }
              <div class="barber-card__actions">
                ${
                  barber.available
                    ? `<a class="button button--small button--light" href="reserva.html?barber=${encodeURIComponent(barber.id)}">Reservar</a>`
                    : ""
                }
                ${
                  barber.gallery.length
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

  function openGallery(barberId) {
    const modal = $("[data-gallery-modal]");
    const barber = data.barbers.find((item) => item.id === barberId);
    if (!modal || !barber || !barber.gallery.length) return;

    $("[data-gallery-title]").textContent = `Trabajos de ${barber.name}`;
    $("[data-gallery-grid]").innerHTML = barber.gallery
      .map((item) => `<figure><img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.alt)}" loading="lazy" /></figure>`)
      .join("");

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
  }

  function closeGallery() {
    const modal = $("[data-gallery-modal]");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("no-scroll");
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
    const embedUrl = buildMapEmbedUrl(mapQuery);
    if (mapFrame && mapFrame.getAttribute("src") !== embedUrl) mapFrame.src = embedUrl;

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
        <a href="${whatsAppLink(data.business.whatsapp, data.cta.whatsappMessage)}">${escapeHtml(data.business.phone)}</a>
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

  function setupGalleryEvents() {
    document.addEventListener("click", (event) => {
      const opener = event.target.closest("[data-open-gallery]");
      if (opener) {
        openGallery(opener.dataset.openGallery);
        return;
      }
      if (event.target.closest("[data-gallery-close]")) closeGallery();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeGallery();
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
  }

  function showLoadError() {
    const message = `<p class="load-error">No pudimos cargar esta seccion. Revisa tu conexion y recarga la pagina.</p>`;
    ["[data-services]", "[data-barbers]", "[data-hours]"].forEach((selector) => {
      const container = $(selector);
      if (container) container.innerHTML = message;
    });
  }

  setupNavigation();
  setupGalleryEvents();

  store
    .init({ bookings: false })
    .then(() => {
      data = store.getState();
      renderAll();
      store.subscribe((nextState) => {
        data = nextState;
        renderAll();
      });
    })
    .catch((error) => {
      console.error(error);
      showLoadError();
    });
})();
