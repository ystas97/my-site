(function () {
  const STORAGE_SYNC_KEY = "antonovka_projects_updated_at";
  const SYNC_CHANNEL = "antonovka-portfolio-sync";

  function applyProjectDefaults(list) {
    list.forEach((project) => {
      if (!project.status) project.status = "Концепция";
      if (!project.typology) project.typology = "Общественное здание";
      if (project.description) return;
      project.description =
        `Проект «${project.title}» — ${project.city}, ${project.year}. ` +
        "Архитектурная концепция, разработка проектной и рабочей документации. " +
        "В основе решения — функциональная планировка, связь с городской средой и выразительность фасадов.";
    });
  }

  function normalizeLocalProject(project) {
    const imagePath = project.image || "";
    const toUrl = (file) => {
      if (/^https?:\/\//i.test(file)) return file;
      return `assets/images/${file.replace(/^\//, "")}`;
    };

    const gallery = (project.gallery?.length ? project.gallery : [imagePath])
      .map(toUrl)
      .filter(Boolean);

    return {
      ...project,
      image: toUrl(imagePath),
      gallery,
    };
  }

  function getLocalProjects() {
    const source = window.PROJECTS_LOCAL;
    if (!Array.isArray(source)) return [];
    return source.map(normalizeLocalProject);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function setGridMessage(html) {
    const grid = document.getElementById("projects");
    if (grid) {
      grid.innerHTML = html;
      grid.classList.remove("is-loading");
    }
  }

  async function initProjects() {
    const grid = document.getElementById("projects");
    if (grid) grid.classList.add("is-loading");

    window.PROJECTS = [];

    let projects = [];
    let source = "local";

    try {
      if (window.SupabasePortfolio?.isConfigured()) {
        projects = await window.SupabasePortfolio.fetchPublishedProjects();
        source = "supabase";
      } else {
        projects = getLocalProjects();
      }
    } catch (err) {
      console.error("Ошибка загрузки проектов:", err);
      if (window.SupabasePortfolio?.isConfigured()) {
        setGridMessage(
          `<p class="grid-message">Не удалось загрузить проекты из Supabase: ${escapeHtml(err.message || err)}. Обновите страницу (Cmd+Shift+R).</p>`
        );
        window.PROJECTS = [];
        window.dispatchEvent(
          new CustomEvent("projectsready", { detail: { source: "error", count: 0, error: String(err.message) } })
        );
        return;
      }
      projects = getLocalProjects();
      source = "local-fallback";
    }

    if (!projects.length) {
      setGridMessage(
        '<p class="grid-message">Проекты не найдены. Проверьте Supabase и опубликуйте записи.</p>'
      );
      window.PROJECTS = [];
      window.dispatchEvent(new CustomEvent("projectsready", { detail: { source, count: 0 } }));
      return;
    }

    applyProjectDefaults(projects);
    window.PROJECTS = projects;

    if (grid) grid.classList.remove("is-loading");
    window.dispatchEvent(
      new CustomEvent("projectsready", { detail: { source, count: projects.length } })
    );
  }

  function setupAutoRefresh() {
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_SYNC_KEY) initProjects();
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") initProjects();
    });

    window.addEventListener("pageshow", (e) => {
      if (e.persisted) initProjects();
    });

    try {
      const channel = new BroadcastChannel(SYNC_CHANNEL);
      channel.onmessage = () => initProjects();
    } catch (_) {
      /* BroadcastChannel недоступен */
    }
  }

  window.initProjects = initProjects;
  setupAutoRefresh();
  initProjects();
})();
