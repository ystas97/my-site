(function () {
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function useFlexLayout() {
    return window.matchMedia("(max-width: 900px)").matches;
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

  function clearFixedGridLayout(grid) {
    grid.classList.remove("is-sized");
    grid.style.removeProperty("--grid-cell");
    grid.style.gridTemplateRows = "";
  }

  function layoutGrid() {
    const grid = document.getElementById("projects");
    if (!grid || grid.classList.contains("is-loading")) return;

    const columns = gridColumns();
    const cards = grid.querySelectorAll(".card");
    if (!cards.length) {
      clearFixedGridLayout(grid);
      return;
    }

    /* До 900px — flex в CSS, без px-рядов (Safari ломает grid при скролле) */
    if (useFlexLayout()) {
      clearFixedGridLayout(grid);
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
    if (useFlexLayout()) return;
    const run = () => layoutGrid();
    run();
    requestAnimationFrame(layoutGrid);
    clearTimeout(layoutTimer);
    layoutTimer = setTimeout(run, 120);
  }

  function bindImageLayout(grid) {
    if (useFlexLayout()) return;
    grid.querySelectorAll(".card__media img").forEach((img) => {
      if (img.complete) return;
      img.addEventListener("load", scheduleLayout, { once: true });
      img.addEventListener("error", scheduleLayout, { once: true });
    });
  }

  function cardImageAttrs() {
    if (useFlexLayout()) {
      return 'loading="eager" decoding="async"';
    }
    return 'loading="lazy" decoding="async"';
  }

  function renderCard(project, index) {
    return `
    <article class="card">
      <a class="card__inner" href="#" data-project-index="${index}">
        <div class="card__media">
          <img src="${escapeHtml(project.image)}" alt="" ${cardImageAttrs()} />
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

  let lastColumns = 0;
  let lastGridWidth = 0;

  function renderCards() {
    const grid = document.getElementById("projects");
    if (!grid || !Array.isArray(window.PROJECTS)) return;

    const columns = gridColumns();
    lastColumns = columns;
    const spacers = spacerCount(window.PROJECTS.length, columns);

    clearFixedGridLayout(grid);
    grid.innerHTML =
      window.PROJECTS.map((p, index) => renderCard(p, index)).join("") + renderSpacers(spacers);

    lastGridWidth = Math.round(grid.getBoundingClientRect().width);
    if (!useFlexLayout()) {
      bindImageLayout(grid);
      scheduleLayout();
    }
  }

  function onBreakpointChange() {
    renderCards();
  }

  window.matchMedia("(max-width: 900px)").addEventListener("change", onBreakpointChange);
  window.matchMedia("(max-width: 520px)").addEventListener("change", onBreakpointChange);

  window.addEventListener("projectsready", renderCards);

  if (!useFlexLayout()) {
    window.addEventListener("load", scheduleLayout);

    if (typeof ResizeObserver !== "undefined") {
      const grid = document.getElementById("projects");
      if (grid) {
        new ResizeObserver(() => {
          if (useFlexLayout()) return;
          const width = Math.round(grid.getBoundingClientRect().width);
          if (width === lastGridWidth) return;
          lastGridWidth = width;
          scheduleLayout();
        }).observe(grid);
      }
    }

    if (document.fonts?.ready) {
      document.fonts.ready.then(scheduleLayout).catch(() => {});
    }
  }
})();
