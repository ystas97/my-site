(function () {
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function gridColumns() {
    if (window.matchMedia("(max-width: 520px)").matches) return 1;
    if (window.matchMedia("(max-width: 900px)").matches) return 2;
    return 4;
  }

  function spacerCount(projectCount, columns) {
    const remainder = projectCount % columns;
    return remainder === 0 ? 0 : columns - remainder;
  }

  function renderCard(project, index) {
    return `
    <article class="card">
      <a class="card__inner" href="#" data-project-index="${index}">
        <div class="card__media">
          <img src="${escapeHtml(project.image)}" alt="" loading="lazy" />
        </div>
        <div class="card__text">
          <div class="card__row">
            <h2 class="card__title">${escapeHtml(project.title)}</h2>
            <span class="card__year">${escapeHtml(project.year)}</span>
          </div>
          <p class="card__city">${escapeHtml(project.city)}</p>
        </div>
      </a>
    </article>
  `;
  }

  function renderSpacers(count) {
    let html = "";
    for (let i = 0; i < count; i += 1) {
      html += '<article class="card card--spacer" aria-hidden="true"></article>';
    }
    return html;
  }

  function renderCards() {
    const grid = document.getElementById("projects");
    if (!grid || !Array.isArray(window.PROJECTS)) return;

    const columns = gridColumns();
    const spacers = spacerCount(window.PROJECTS.length, columns);

    grid.innerHTML =
      window.PROJECTS.map((p, index) => renderCard(p, index)).join("") + renderSpacers(spacers);
  }

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderCards, 150);
  });

  /* Всегда ждём load-projects.js — иначе показывается устаревший projects.js */
  window.addEventListener("projectsready", renderCards);
})();
