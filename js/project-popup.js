(function () {
  const popup = document.getElementById("projectPopup");
  if (!popup || typeof PROJECTS === "undefined") return;

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
    const header = document.querySelector(".header");
    const h = header ? header.offsetHeight : 79;
    document.documentElement.style.setProperty("--header-offset", `${h}px`);
  }

  function syncFooterBarSize() {
    if (!footerBar) return;
    footer.style.setProperty("--footer-bar-size", `${footerBar.offsetHeight}px`);
  }

  function galleryFor(project) {
    if (project.gallery?.length) return project.gallery;
    return [project.image];
  }

  function setDetailsOpen(open) {
    footer.classList.toggle("is-expanded", open);
    btnExpand.setAttribute("aria-expanded", String(open));
    btnExpand.setAttribute(
      "aria-label",
      open ? "Скрыть описание проекта" : "Показать описание проекта"
    );
    detailsEl.setAttribute("aria-hidden", String(!open));
  }

  function updateSlide() {
    const file = gallery[slideIndex];
    imageEl.src = `assets/images/${file}`;
    imageEl.alt = titleEl.textContent;
    btnPrev.disabled = gallery.length <= 1;
    btnNext.disabled = gallery.length <= 1;
  }

  function updateMeta() {
    const project = PROJECTS[projectIndex];
    titleEl.textContent = project.title;
    cityEl.textContent = project.city;
    yearEl.textContent = project.year;
    statusEl.textContent = project.status || "—";
    typologyEl.textContent = project.typology || "—";
    descriptionEl.textContent = project.description || "";
  }

  function open(index) {
    projectIndex = index;
    const project = PROJECTS[projectIndex];
    gallery = galleryFor(project);
    slideIndex = 0;
    setDetailsOpen(false);
    updateMeta();
    updateSlide();

    popup.hidden = false;
    popup.setAttribute("aria-hidden", "false");
    document.body.classList.add("popup-open");

    requestAnimationFrame(() => {
      syncFooterBarSize();
      popup.classList.add("is-open");
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
    syncFooterBarSize();
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
  syncFooterBarSize();
  window.addEventListener("resize", () => {
    syncHeaderOffset();
    syncFooterBarSize();
  });
})();
