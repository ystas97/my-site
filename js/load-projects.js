(function () {
  const STORAGE_SYNC_KEY = "antonovka_projects_updated_at";
  const SYNC_CHANNEL = "antonovka-portfolio-sync";
  const DATA_URL = "data/projects.json";

  function applyDefaults(project) {
    if (!project.status) project.status = "Концепция";
    if (!project.typology) project.typology = "Общественное здание";
    if (!project.description) {
      project.description =
        `Проект «${project.title}» — ${project.city}, ${project.year}. ` +
        "Архитектурная концепция, разработка проектной и рабочей документации. " +
        "В основе решения — функциональная планировка, связь с городской средой и выразительность фасадов.";
    }
  }

  function normalizeProject(p) {
    const toUrl = (path) => {
      if (!path) return "";
      if (/^https?:\/\//i.test(path)) return path;
      if (path.startsWith("assets/")) return path;
      return `assets/images/${path.replace(/^\//, "")}`;
    };

    const cover = toUrl(p.cover_path || p.image || "");
    const images = Array.isArray(p.project_images)
      ? p.project_images
          .slice()
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((i) => toUrl(i.storage_path || i.path || ""))
          .filter(Boolean)
      : Array.isArray(p.gallery)
      ? p.gallery.map(toUrl).filter(Boolean)
      : [];

    const gallery = images.length ? images : cover ? [cover] : [];

    return {
      id: p.id || p.slug || "",
      slug: p.slug || "",
      title: p.title || "",
      city: p.city || "",
      year: p.year || "",
      status: p.status || "",
      typology: p.typology || "",
      description: p.description || "",
      image: cover,
      gallery,
    };
  }

  function getLocalProjects() {
    const source = window.PROJECTS_LOCAL;
    if (!Array.isArray(source)) return [];
    return source.map(normalizeProject);
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

  async function fetchJsonData() {
    const res = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data.projects) ? data.projects : [];
  }

  async function initProjects() {
    const grid = document.getElementById("projects");
    if (grid) grid.classList.add("is-loading");
    window.PROJECTS = [];

    let projects = [];
    let source = "local";

    try {
      const raw = await fetchJsonData();
      projects = raw
        .filter((p) => p.published !== false)
        .map(normalizeProject);
      source = "json";
    } catch (err) {
      console.warn("data/projects.json недоступен, fallback на local:", err.message);
      projects = getLocalProjects();
      source = "local-fallback";
    }

    if (!projects.length) {
      setGridMessage('<p class="grid-message">Проекты не найдены.</p>');
      window.PROJECTS = [];
      window.dispatchEvent(new CustomEvent("projectsready", { detail: { source, count: 0 } }));
      return;
    }

    projects.forEach(applyDefaults);
    window.PROJECTS = projects;

    if (grid) grid.classList.remove("is-loading");
    window.dispatchEvent(new CustomEvent("projectsready", { detail: { source, count: projects.length } }));
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
    } catch (_) { /* ignore */ }
  }

  window.initProjects = initProjects;
  setupAutoRefresh();
  initProjects();
})();
