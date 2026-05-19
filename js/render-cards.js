(function () {
  const grid = document.getElementById("projects");
  if (!grid || typeof PROJECTS === "undefined") return;

  grid.innerHTML = PROJECTS.map(
    (p, index) => `
    <article class="card">
      <a class="card__inner" href="#" data-project-index="${index}">
        <div class="card__media">
          <img src="assets/images/${p.image}" alt="" loading="lazy" />
        </div>
        <div class="card__text">
          <div class="card__row">
            <h2 class="card__title">${p.title}</h2>
            <span class="card__year">${p.year}</span>
          </div>
          <p class="card__city">${p.city}</p>
        </div>
      </a>
    </article>
  `
  ).join("");
})();
