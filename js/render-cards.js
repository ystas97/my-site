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

  function readGridGap(grid) {
    const styles = getComputedStyle(grid);
    const rowGap = parseFloat(styles.rowGap);
    if (!Number.isNaN(rowGap) && rowGap > 0) return rowGap;
    const gap = parseFloat(styles.gap);
    return Number.isNaN(gap) ? 0 : gap;
  }

  function measureCellSize(grid, columns) {
    const width = grid.getBoundingClientRect().width;
    if (width <= 0 || columns < 1) return 0;
    const gap = readGridGap(grid);
    return Math.floor((width - gap * (columns - 1)) / columns);
  }

  function layoutGrid() {
    const grid = document.getElementById("projects");
    if (!grid || grid.classList.contains("is-loading")) return;

    const columns = gridColumns();
    const cards = grid.querySelectorAll(".card");
    if (!cards.length) {
      grid.classList.remove("is-sized");
      grid.style.removeProperty("--grid-cell");
      grid.style.gridTemplateRows = "";
      return;
    }

    const rows = Math.ceil(cards.length / columns);
    const cell = measureCellSize(grid, columns);
    if (cell <= 0) return;

    grid.style.setProperty("--grid-cell", `${cell}px`);
    grid.style.gridTemplateRows = `repeat(${rows}, ${cell}px)`;
    grid.classList.add("is-sized");
  }

  let layoutTimer;
  function scheduleLayout() {
    const run = () => layoutGrid();
    run();
    requestAnimationFrame(() => {
      layoutGrid();
      requestAnimationFrame(layoutGrid);
    });
    clearTimeout(layoutTimer);
    layoutTimer = setTimeout(run, 80);
    setTimeout(run, 280);
  }

  function bindImageLayout(grid) {
    grid.querySelectorAll(".card__media img").forEach((img) => {
      if (img.complete) return;
      img.addEventListener("load", scheduleLayout, { once: true });
      img.addEventListener("error", scheduleLayout, { once: true });
    });
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

    grid.classList.remove("is-sized");
    grid.innerHTML =
      window.PROJECTS.map((p, index) => renderCard(p, index)).join("") + renderSpacers(spacers);

    bindImageLayout(grid);
    scheduleLayout();
  }

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderCards, 150);
  });

  window.addEventListener("projectsready", renderCards);
  window.addEventListener("load", scheduleLayout);

  if (typeof ResizeObserver !== "undefined") {
    const grid = document.getElementById("projects");
    if (grid) {
      new ResizeObserver(() => scheduleLayout()).observe(grid);
    }
  }

  if (document.fonts?.ready) {
    document.fonts.ready.then(scheduleLayout).catch(() => {});
  }
})();
