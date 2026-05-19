(function () {
  const popup = document.getElementById("projectPopup");
  if (!popup) return;

  const panel = popup.querySelector(".project-popup__panel");
  const footer = popup.querySelector(".project-popup__footer");
  const footerBar = popup.querySelector(".project-popup__footer-bar");
  const detailsEl = document.getElementById("projectDetails");
  const imageEl = popup.querySelector(".project-popup__image");
  const titleEl = popup.querySelector(".project-popup__title");
  const cityEl = popup.querySelector(".project-popup__city");
  const yearEl = popup.querySelector(".project-popup__year");
  const statusEl = popup.querySelector(".project-popup__status");
  const typologyEl = popup.querySelector(".project-popup__typology");
  const descriptionEl = popup.querySelector(".project-popup__description-text");
  const btnPrev = popup.querySelector(".project-popup__arrow--prev");
  const btnNext = popup.querySelector(".project-popup__arrow--next");
  const btnClose = popup.querySelector(".project-popup__close");
  const btnExpand = popup.querySelector(".project-popup__expand");

  let projectIndex = 0;
  let slideIndex = 0;
  let gallery = [];

  function syncHeaderOffset() {
    const headerBar = document.querySelector(".header__inner");
    const h = headerBar ? headerBar.offsetHeight : 79;
    document.documentElement.style.setProperty("--header-offset", `${h}px`);
  }

  function syncFooterBarSize() {
    if (!footerBar) return;
    footer.style.setProperty("--footer-bar-size", `${footerBar.offsetHeight}px`);
  }

  function syncFooterMetrics() {
    syncFooterBarSize();
    const barH = footerBar ? Math.ceil(footerBar.offsetHeight) : 82;
    panel.style.setProperty("--footer-reserve", `${barH}px`);
  }

  function galleryFor(project) {
    if (project.gallery?.length) return project.gallery;
    return project.image ? [project.image] : [];
  }

  function setDetailsOpen(open) {
    footer.classList.toggle("is-expanded", open);
    syncFooterMetrics();
    if (open) {
      requestAnimationFrame(() => {
        syncFooterMetrics();
        requestAnimationFrame(syncFooterMetrics);
      });
    } else {
      requestAnimationFrame(syncFooterMetrics);
    }
    btnExpand.setAttribute("aria-expanded", String(open));
    btnExpand.setAttribute(
      "aria-label",
      open ? "Скрыть описание проекта" : "Показать описание проекта"
    );
    detailsEl.setAttribute("aria-hidden", String(!open));
  }

  function mediaUrl(file) {
    if (!file) return "";
    if (/^https?:\/\//i.test(file)) return file;
    return `assets/images/${file.replace(/^\//, "")}`;
  }

  function updateSlide() {
    const file = gallery[slideIndex];
    imageEl.src = mediaUrl(file);
    imageEl.alt = titleEl.textContent;
    btnPrev.disabled = gallery.length <= 1;
    btnNext.disabled = gallery.length <= 1;
  }

  function updateMeta() {
    const project = window.PROJECTS[projectIndex];
    titleEl.textContent = project.title;
    cityEl.textContent = project.city;
    yearEl.textContent = project.year;
    statusEl.textContent = project.status || "—";
    typologyEl.textContent = project.typology || "—";
    descriptionEl.textContent = project.description || "";
  }

  function open(index) {
    if (!Array.isArray(window.PROJECTS) || !window.PROJECTS[index]) return;

    projectIndex = index;
    const project = window.PROJECTS[projectIndex];
    gallery = galleryFor(project);
    slideIndex = 0;
    setDetailsOpen(false);
    updateMeta();
    updateSlide();

    syncHeaderOffset();
    popup.hidden = false;
    popup.setAttribute("aria-hidden", "false");
    document.body.classList.add("popup-open");

    requestAnimationFrame(() => {
      syncFooterMetrics();
      requestAnimationFrame(() => {
        syncFooterMetrics();
        popup.classList.add("is-open");
      });
    });
  }

  function close() {
    setDetailsOpen(false);
    popup.classList.remove("is-open");
    document.body.classList.remove("popup-open");

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      popup.hidden = true;
      popup.setAttribute("aria-hidden", "true");
      imageEl.removeAttribute("src");
    };

    const onEnd = (e) => {
      if (e.target !== panel) return;
      if (e.propertyName !== "transform" && e.propertyName !== "-webkit-transform") return;
      finish();
    };
    panel.addEventListener("transitionend", onEnd);
    setTimeout(finish, 600);
  }

  function showSlide(delta) {
    if (gallery.length <= 1) return;
    slideIndex = (slideIndex + delta + gallery.length) % gallery.length;
    updateSlide();
  }

  function toggleDescription() {
    setDetailsOpen(!footer.classList.contains("is-expanded"));
  }

  document.getElementById("projects")?.addEventListener("click", (e) => {
    const link = e.target.closest(".card__inner");
    if (!link) return;
    e.preventDefault();
    const index = Number(link.dataset.projectIndex);
    if (!Number.isNaN(index)) open(index);
  });

  btnClose?.addEventListener("click", close);
  btnExpand?.addEventListener("click", toggleDescription);
  btnPrev?.addEventListener("click", () => showSlide(-1));
  btnNext?.addEventListener("click", () => showSlide(1));

  document.addEventListener("keydown", (e) => {
    if (!popup.classList.contains("is-open")) return;
    if (e.key === "Escape") {
      if (footer.classList.contains("is-expanded")) {
        setDetailsOpen(false);
        return;
      }
      close();
    }
    if (e.key === "ArrowLeft") showSlide(-1);
    if (e.key === "ArrowRight") showSlide(1);
  });

  syncHeaderOffset();
  syncFooterMetrics();
  window.addEventListener("resize", () => {
    syncHeaderOffset();
    syncFooterMetrics();
  });
  window.addEventListener("headeroffset", syncHeaderOffset);
})();
