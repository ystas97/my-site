(function () {
  // ── DOM refs ──────────────────────────────────────────────────────────────
  const loginScreen = document.getElementById("loginScreen");
  const appScreen = document.getElementById("appScreen");
  const loginForm = document.getElementById("loginForm");
  const loginError = document.getElementById("loginError");
  const projectList = document.getElementById("projectList");
  const projectForm = document.getElementById("projectForm");
  const emptyState = document.getElementById("emptyState");
  const coverPreviewWrap = document.getElementById("coverPreviewWrap");
  const coverPreview = document.getElementById("coverPreview");
  const coverMediaStatus = document.getElementById("coverMediaStatus");
  const galleryMediaStatus = document.getElementById("galleryMediaStatus");
  const coverInput = document.getElementById("coverInput");
  const galleryInput = document.getElementById("galleryInput");
  const galleryList = document.getElementById("galleryList");
  const formTitle = document.getElementById("formTitle");
  const toast = document.getElementById("toast");

  const STORAGE_SYNC_KEY = "antonovka_projects_updated_at";
  const SYNC_CHANNEL = "antonovka-portfolio-sync";
  const TOKEN_KEY = "antonovka_worker_token";

  let projects = [];
  let currentId = null;
  let pendingGalleryFiles = [];
  let isBusy = false;

  // ── Worker API ────────────────────────────────────────────────────────────

  function getWorkerUrl() {
    return (window.UPLOAD_WORKER_URL || "").trim();
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  async function workerFetch(method, path, body) {
    const url = getWorkerUrl();
    if (!url) throw new Error("UPLOAD_WORKER_URL не задан в supabase-config.js");

    const opts = { method, headers: { Authorization: `Bearer ${getToken()}` } };

    if (body instanceof FormData) {
      opts.body = body;
    } else if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }

    const res = await fetch(`${url}${path}`, opts);

    if (res.status === 401) {
      clearToken();
      showLogin();
      throw new Error("Сессия истекла — войдите снова");
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  // ── auth ──────────────────────────────────────────────────────────────────

  async function loginWithPassword(password) {
    const url = getWorkerUrl();
    if (!url) throw new Error("UPLOAD_WORKER_URL не задан в supabase-config.js");
    const res = await fetch(`${url}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) throw new Error("Неверный пароль");
    const { token } = await res.json();
    localStorage.setItem(TOKEN_KEY, token);
    return token;
  }

  // ── data helpers ──────────────────────────────────────────────────────────

  function newId() {
    return typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  async function fetchAllProjects() {
    const data = await workerFetch("GET", "/data/projects");
    return Array.isArray(data.projects) ? data.projects : [];
  }

  async function saveAllProjects() {
    await workerFetch("PUT", "/data/projects", {
      version: 1,
      updated_at: new Date().toISOString(),
      projects,
    });
  }

  // ── file paths ────────────────────────────────────────────────────────────

  function fileExt(name) {
    const parts = name.split(".");
    return parts.length > 1 ? parts.pop().toLowerCase() : "jpg";
  }

  function coverStoragePath(projectId, filename) {
    return `assets/images/projects/${projectId}/cover.${fileExt(filename)}`;
  }

  function galleryStoragePath(projectId, filename, index) {
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    return `assets/images/projects/${projectId}/gallery/${String(index).padStart(2, "0")}_${safe}`;
  }

  // Локальные превью только что загруженных файлов (до деплоя GitHub Pages)
  const localPreviews = new Map();

  function rememberLocalPreview(path, file) {
    if (!path || !file) return;
    const prev = localPreviews.get(path);
    if (prev) URL.revokeObjectURL(prev);
    localPreviews.set(path, URL.createObjectURL(file));
  }

  function publicUrl(path) {
    if (path && localPreviews.has(path)) return localPreviews.get(path);
    const url = window.SupabasePortfolio?.storagePublicUrl(path) || path || "";
    // Админка в /admin/ — относительные assets-пути ведут из корня сайта
    if (url && !/^https?:\/\//i.test(url) && url.startsWith("assets/")) {
      return `../${url}`;
    }
    return url;
  }

  // ── file upload / delete via Worker ──────────────────────────────────────

  async function uploadStorage(path, file) {
    const url = getWorkerUrl();
    if (!url) throw new Error("UPLOAD_WORKER_URL не задан в supabase-config.js");
    const form = new FormData();
    form.append("file", file);
    form.append("path", path);
    const res = await fetch(`${url}/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
      body: form,
    });
    if (res.status === 401) { clearToken(); showLogin(); throw new Error("Сессия истекла"); }
    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText);
      throw new Error(`Worker upload failed: ${msg}`);
    }
    rememberLocalPreview(path, file);
    return path;
  }

  async function removeStorage(paths) {
    if (!paths.length) return;
    const url = getWorkerUrl();
    if (!url) return;
    const githubPaths = paths.filter((p) => p && p.startsWith("assets/images/"));
    if (!githubPaths.length) return;
    try {
      await fetch(`${url}/delete`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ paths: githubPaths }),
      });
    } catch (err) {
      console.warn("Worker delete:", err.message);
    }
  }

  // ── toast / busy ──────────────────────────────────────────────────────────

  function showToast(message, isError) {
    toast.textContent = message;
    toast.classList.toggle("is-error", Boolean(isError));
    toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { toast.hidden = true; }, 5000);
  }

  function showLoginError(message) {
    showLogin();
    loginError.textContent = message;
    loginError.hidden = false;
    showToast(message, true);
  }

  function setBusy(busy) {
    isBusy = busy;
    document.querySelectorAll(".admin-btn").forEach((btn) => { btn.disabled = busy; });
  }

  // ── slugs ─────────────────────────────────────────────────────────────────

  function translitSlug(text) {
    const map = {
      а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",
      й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",
      у:"u",ф:"f",х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",
      э:"e",ю:"yu",я:"ya",
    };
    return text.toLowerCase().split("").map((ch) => map[ch] ?? ch).join("")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  }

  function makeUniqueSlug(title, excludeId) {
    let base = translitSlug(title);
    if (!base) base = `project-${Date.now()}`;
    let slug = base;
    let n = 2;
    while (projects.some((p) => p.slug === slug && p.id !== excludeId)) {
      slug = `${base}-${n}`;
      n += 1;
    }
    return slug;
  }

  // ── HTML helpers ──────────────────────────────────────────────────────────

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function setMediaStatus(type, msg, busy) {
    const el = type === "cover" ? coverMediaStatus : galleryMediaStatus;
    if (!el) return;
    el.textContent = msg || "";
    el.hidden = !msg;
    if (busy) el.classList.add("is-loading");
    else el.classList.remove("is-loading");
  }

  // ── cover preview ─────────────────────────────────────────────────────────

  function setCoverPreviewUrl(url) {
    if (!url) { resetCoverPreview(); return; }
    if (!coverPreview || !coverPreviewWrap) return;
    coverPreviewWrap.classList.remove("is-empty", "is-error");
    coverPreviewWrap.classList.add("is-loading");
    coverPreview.onload = () => coverPreviewWrap.classList.remove("is-loading");
    coverPreview.onerror = () => {
      coverPreviewWrap.classList.remove("is-loading");
      coverPreviewWrap.classList.add("is-empty", "is-error");
    };
    coverPreview.src = url;
  }

  function resetCoverPreview() {
    if (!coverPreview || !coverPreviewWrap) return;
    coverPreview.removeAttribute("src");
    coverPreviewWrap.classList.add("is-empty");
    coverPreviewWrap.classList.remove("is-loading", "is-error", "is-uploading");
  }

  function setCoverPreviewFile(file) {
    if (!file) return;
    setCoverPreviewUrl(URL.createObjectURL(file));
  }

  // ── gallery render ────────────────────────────────────────────────────────

  function bindGalleryImageLoad(li) {
    const img = li.querySelector("img");
    if (!img) return;
    li.classList.add("is-loading");
    const done = () => li.classList.remove("is-loading");
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
  }

  function renderGallery(project) {
    const items = [];

    (project.project_images || []).forEach((img) => {
      items.push(`
        <li class="admin-gallery__item is-loading" draggable="true" data-image-id="${escapeHtml(img.id)}" data-path="${escapeHtml(img.storage_path)}">
          <span class="admin-gallery__handle" title="Перетащить" aria-hidden="true">⋮⋮</span>
          <img src="${escapeHtml(publicUrl(img.storage_path))}" alt="" loading="lazy" draggable="false" />
          <button type="button" class="admin-gallery__remove" aria-label="Удалить">×</button>
        </li>
      `);
    });

    pendingGalleryFiles.forEach((file, index) => {
      const url = URL.createObjectURL(file);
      items.push(`
        <li class="admin-gallery__item" draggable="true" data-pending-index="${index}">
          <span class="admin-gallery__handle" title="Перетащить" aria-hidden="true">⋮⋮</span>
          <img src="${url}" alt="" draggable="false" />
          <span class="admin-gallery__badge is-pending">загрузка…</span>
        </li>
      `);
    });

    galleryList.innerHTML = items.join("");
    galleryList.querySelectorAll(".admin-gallery__item").forEach(bindGalleryImageLoad);

    if (pendingGalleryFiles.length) {
      setMediaStatus("gallery", "Загрузка…", true);
    } else if ((project.project_images || []).length) {
      setMediaStatus("gallery", "");
    }

    galleryList.querySelectorAll(".admin-gallery__remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const li = btn.closest(".admin-gallery__item");
        const imageId = li?.dataset.imageId;
        if (imageId) removeGalleryImage(imageId, li.dataset.path);
      });
    });
  }

  // ── project list ──────────────────────────────────────────────────────────

  const EYE_OPEN_SVG = `<svg class="admin-project-list__eye-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const EYE_OFF_SVG = `<svg class="admin-project-list__eye-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

  function renderProjectList() {
    projectList.innerHTML = projects
      .map((p) => {
        const active = p.id === currentId ? " is-active" : "";
        const eyeClass = p.published ? "" : " is-off";
        const eyeSvg = p.published ? EYE_OPEN_SVG : EYE_OFF_SVG;
        const checked = p.published ? " checked" : "";
        const visTitle = p.published ? "Виден на сайте" : "Скрыт с сайта";
        return `
        <li class="admin-project-list__item${active}" data-id="${p.id}" draggable="true">
          <span class="admin-project-list__handle" title="Перетащить" aria-hidden="true">⋮⋮</span>
          <button type="button" class="admin-project-list__btn" data-select-id="${p.id}">
            <span class="admin-project-list__title">${escapeHtml(p.title)}</span>
            <span class="admin-project-list__meta">${escapeHtml(p.city)} · ${escapeHtml(p.year)}</span>
          </button>
          <div class="admin-project-list__visibility" title="${visTitle}">
            <span class="admin-project-list__eye${eyeClass}" aria-hidden="true">${eyeSvg}</span>
            <label class="admin-toggle admin-toggle--list" title="${visTitle}">
              <input type="checkbox" class="admin-toggle__input" data-publish-toggle="${p.id}"${checked} />
              <span class="admin-toggle__track" aria-hidden="true"></span>
            </label>
          </div>
        </li>`;
      })
      .join("");
  }

  function getCurrentProject() {
    return projects.find((p) => p.id === currentId) || null;
  }

  function clearPendingFiles() {
    pendingGalleryFiles = [];
  }

  // ── form ──────────────────────────────────────────────────────────────────

  function readFormFields() {
    const fd = new FormData(projectForm);
    return {
      title: String(fd.get("title") || "").trim(),
      city: String(fd.get("city") || "").trim(),
      year: String(fd.get("year") || "").trim(),
      sort_order: Number(fd.get("sort_order")) || 0,
      status: String(fd.get("status") || "").trim() || "Концепция",
      typology: String(fd.get("typology") || "").trim() || "Общественное здание",
      description: String(fd.get("description") || "").trim(),
      published: Boolean(getCurrentProject()?.published),
    };
  }

  function fillForm(project, opts = {}) {
    const draft = opts.preserveFormDraft ? readFormFields() : null;
    projectForm.hidden = false;
    emptyState.hidden = true;

    const f = projectForm.elements;
    f.title.value = project.title;
    f.city.value = project.city;
    f.year.value = project.year;
    f.sort_order.value = project.sort_order;
    f.status.value = project.status || "";
    f.typology.value = project.typology || "";
    f.description.value = project.description || "";

    if (draft) {
      Object.assign(f, {});
      f.title.value = draft.title;
      f.city.value = draft.city;
      f.year.value = draft.year;
      f.sort_order.value = draft.sort_order;
      f.status.value = draft.status;
      f.typology.value = draft.typology;
      f.description.value = draft.description;
      formTitle.textContent = draft.title || "Проект";
    } else {
      formTitle.textContent = project.title || "Проект";
    }

    if (project.cover_path) {
      setCoverPreviewUrl(publicUrl(project.cover_path));
    } else {
      resetCoverPreview();
    }
    renderGallery(project);
  }

  function selectProject(id) {
    currentId = id;
    clearPendingFiles();
    const project = getCurrentProject();
    if (!project) return;
    fillForm(project);
    renderProjectList();
  }

  // ── publish toggle ────────────────────────────────────────────────────────

  async function setProjectPublished(projectId, published) {
    if (isBusy) return;
    setBusy(true);
    try {
      const project = projects.find((p) => p.id === projectId);
      if (!project) return;
      project.published = published;
      await saveAllProjects();
      renderProjectList();
      notifyMainSiteRefresh();
      showToast(published ? "Проект показан на сайте" : "Проект скрыт с сайта");
    } catch (err) {
      console.error(err);
      showToast(err.message || "Не удалось изменить видимость", true);
      renderProjectList();
    } finally {
      setBusy(false);
    }
  }

  // ── sort order ────────────────────────────────────────────────────────────

  function applySortOrderToProjects() {
    projects.forEach((p, index) => { p.sort_order = index + 1; });
  }

  async function saveSortOrder() {
    if (!projects.length) return;
    setBusy(true);
    try {
      applySortOrderToProjects();
      await saveAllProjects();
      notifyMainSiteRefresh();
    } catch (err) {
      showToast(err.message || "Не удалось сохранить порядок", true);
    } finally {
      setBusy(false);
    }
  }

  // ── project list DnD ──────────────────────────────────────────────────────

  function setupProjectListDnD() {
    let dragId = null;

    projectList.addEventListener("dragstart", (e) => {
      const item = e.target.closest(".admin-project-list__item");
      if (!item || isBusy) return;
      dragId = item.dataset.id;
      item.classList.add("is-dragging");
      e.dataTransfer.effectAllowed = "move";
    });

    projectList.addEventListener("dragend", () => {
      projectList.querySelectorAll(".admin-project-list__item").forEach((el) => {
        el.classList.remove("is-dragging", "is-drag-over");
      });
      dragId = null;
    });

    projectList.addEventListener("dragover", (e) => {
      e.preventDefault();
      const item = e.target.closest(".admin-project-list__item");
      if (!item || item.dataset.id === dragId) return;
      projectList.querySelectorAll(".is-drag-over").forEach((el) => {
        if (el !== item) el.classList.remove("is-drag-over");
      });
      item.classList.add("is-drag-over");
    });

    projectList.addEventListener("drop", async (e) => {
      e.preventDefault();
      const item = e.target.closest(".admin-project-list__item");
      if (!item || !dragId || item.dataset.id === dragId) return;
      item.classList.remove("is-drag-over");

      const fromIndex = projects.findIndex((p) => p.id === dragId);
      const toIndex = projects.findIndex((p) => p.id === item.dataset.id);
      if (fromIndex < 0 || toIndex < 0) return;

      const [moved] = projects.splice(fromIndex, 1);
      projects.splice(toIndex, 0, moved);
      renderProjectList();
      await saveSortOrder();
    });
  }

  // ── cover upload ──────────────────────────────────────────────────────────

  async function uploadCoverNow(file) {
    const projectId = currentId;
    if (!projectId || isBusy || !file) return;

    setCoverPreviewFile(file);
    setBusy(true);
    try {
      const path = coverStoragePath(projectId, file.name);
      if (coverPreviewWrap) coverPreviewWrap.classList.add("is-uploading");
      setMediaStatus("cover", "Загрузка обложки…", true);

      await uploadStorage(path, file);

      const project = projects.find((p) => p.id === projectId);
      if (project) project.cover_path = path;
      await saveAllProjects();

      coverInput.value = "";
      if (currentId === projectId) {
        setMediaStatus("cover", "Обложка загружена");
      }
      notifyMainSiteRefresh();
      showToast("Обложка загружена. На сайте обновится через 1–2 минуты");
    } catch (err) {
      console.error(err);
      showToast(err.message || "Не удалось загрузить обложку", true);
    } finally {
      if (currentId === projectId && coverPreviewWrap) {
        coverPreviewWrap.classList.remove("is-uploading");
      }
      setBusy(false);
    }
  }

  // ── gallery upload ────────────────────────────────────────────────────────

  async function uploadGalleryFilesNow(files) {
    const projectId = currentId;
    if (!projectId || isBusy || !files.length) return;

    const startIndex = pendingGalleryFiles.length;
    pendingGalleryFiles.push(...files);
    const project = getCurrentProject();
    if (project) renderGallery(project);

    setBusy(true);
    try {
      const proj = getCurrentProject();
      if (!proj) throw new Error("Проект не найден");

      let nextOrder = (proj.project_images || []).length > 0
        ? Math.max(...(proj.project_images || []).map((i) => i.sort_order)) + 1
        : 0;

      const total = files.length;

      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        const domIndex = startIndex + i;
        const li = galleryList.querySelector(`[data-pending-index="${domIndex}"]`);
        if (li) li.classList.add("is-uploading");
        setMediaStatus("gallery", `Загрузка фото ${i + 1} из ${total}…`, true);

        const path = galleryStoragePath(projectId, file.name, nextOrder);
        await uploadStorage(path, file);

        if (!proj.project_images) proj.project_images = [];
        proj.project_images.push({ id: newId(), storage_path: path, sort_order: nextOrder });

        const pendingIdx = pendingGalleryFiles.indexOf(file);
        if (pendingIdx >= 0) pendingGalleryFiles.splice(pendingIdx, 1);
        nextOrder += 1;
      }

      await saveAllProjects();
      renderProjectList();
      fillForm(getCurrentProject(), { preserveFormDraft: true });
      notifyMainSiteRefresh();
      setMediaStatus("gallery", "Фото загружены");
      showToast(total === 1 ? "Фото добавлено" : `Загружено фото: ${total}`);
    } catch (err) {
      console.error(err);
      showToast(err.message || "Не удалось загрузить фото", true);
      await loadProjects({ preserveFormDraft: true });
    } finally {
      setBusy(false);
    }
  }

  // ── gallery sort ──────────────────────────────────────────────────────────

  function getGalleryOrderFromDom() {
    return [...galleryList.querySelectorAll(".admin-gallery__item")]
      .map((li) => {
        if (li.dataset.imageId) return { type: "saved", id: li.dataset.imageId };
        if (li.dataset.pendingIndex !== undefined) return { type: "pending", index: Number(li.dataset.pendingIndex) };
        return null;
      })
      .filter(Boolean);
  }

  function galleryEntryKey(entry) {
    return entry.type === "saved" ? `saved:${entry.id}` : `pending:${entry.index}`;
  }

  function applyGalleryOrder(order) {
    const project = getCurrentProject();
    if (!project) return;
    const savedById = new Map((project.project_images || []).map((img) => [img.id, img]));
    const newImages = [];
    const newPending = [];
    order.forEach((entry, sortOrder) => {
      if (entry.type === "saved") {
        const img = savedById.get(entry.id);
        if (img) { img.sort_order = sortOrder; newImages.push(img); }
      } else {
        const file = pendingGalleryFiles[entry.index];
        if (file) newPending.push(file);
      }
    });
    project.project_images = newImages;
    pendingGalleryFiles = newPending;
  }

  async function saveGallerySortOrder() {
    const project = getCurrentProject();
    if (!(project?.project_images?.length) || !currentId) return;
    setBusy(true);
    try {
      await saveAllProjects();
      notifyMainSiteRefresh();
      showToast("Порядок фото в галерее сохранён");
    } catch (err) {
      console.error(err);
      showToast(err.message || "Не удалось сохранить порядок фото", true);
    } finally {
      setBusy(false);
    }
  }

  async function reorderGallery(dragKey, targetKey) {
    if (!dragKey || !targetKey || dragKey === targetKey || isBusy) return;
    const order = getGalleryOrderFromDom();
    const keys = order.map(galleryEntryKey);
    const fromIndex = keys.indexOf(dragKey);
    const toIndex = keys.indexOf(targetKey);
    if (fromIndex < 0 || toIndex < 0) return;
    const [moved] = keys.splice(fromIndex, 1);
    keys.splice(toIndex, 0, moved);
    const newOrder = keys.map((key) => {
      if (key.startsWith("saved:")) return { type: "saved", id: key.slice(6) };
      return { type: "pending", index: Number(key.slice(8)) };
    });
    applyGalleryOrder(newOrder);
    const project = getCurrentProject();
    if (project) renderGallery(project);
    const hadSaved = newOrder.some((e) => e.type === "saved");
    if (hadSaved) await saveGallerySortOrder();
  }

  function setupGalleryDnD() {
    let dragKey = null;

    galleryList.addEventListener("dragstart", (e) => {
      if (e.target.closest(".admin-gallery__remove")) { e.preventDefault(); return; }
      const item = e.target.closest(".admin-gallery__item");
      if (!item || isBusy) return;
      const order = getGalleryOrderFromDom();
      const index = [...galleryList.querySelectorAll(".admin-gallery__item")].indexOf(item);
      const entry = order[index];
      if (!entry) return;
      dragKey = galleryEntryKey(entry);
      item.classList.add("is-dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", dragKey);
    });

    galleryList.addEventListener("dragend", () => {
      galleryList.querySelectorAll(".admin-gallery__item").forEach((el) => {
        el.classList.remove("is-dragging", "is-drag-over");
      });
      dragKey = null;
    });

    galleryList.addEventListener("dragover", (e) => {
      e.preventDefault();
      const item = e.target.closest(".admin-gallery__item");
      if (!item) return;
      const order = getGalleryOrderFromDom();
      const index = [...galleryList.querySelectorAll(".admin-gallery__item")].indexOf(item);
      const entry = order[index];
      if (!entry || galleryEntryKey(entry) === dragKey) return;
      galleryList.querySelectorAll(".is-drag-over").forEach((el) => {
        if (el !== item) el.classList.remove("is-drag-over");
      });
      item.classList.add("is-drag-over");
    });

    galleryList.addEventListener("drop", (e) => {
      e.preventDefault();
      const item = e.target.closest(".admin-gallery__item");
      if (!item || !dragKey) return;
      const order = getGalleryOrderFromDom();
      const index = [...galleryList.querySelectorAll(".admin-gallery__item")].indexOf(item);
      const entry = order[index];
      if (!entry) return;
      item.classList.remove("is-drag-over");
      void reorderGallery(dragKey, galleryEntryKey(entry));
    });
  }

  // ── sync ──────────────────────────────────────────────────────────────────

  function notifyMainSiteRefresh() {
    try { localStorage.setItem(STORAGE_SYNC_KEY, String(Date.now())); } catch (_) { /* ignore */ }
    try {
      const channel = new BroadcastChannel(SYNC_CHANNEL);
      channel.postMessage("updated");
      channel.close();
    } catch (_) { /* ignore */ }
  }

  // ── load / save projects ──────────────────────────────────────────────────

  async function loadProjects(opts = {}) {
    try {
      projects = await fetchAllProjects();
    } catch (err) {
      throw new Error(err.message || "Ошибка загрузки проектов");
    }
    renderProjectList();
    if (currentId && !getCurrentProject()) {
      currentId = null;
      projectForm.hidden = true;
      emptyState.hidden = false;
    } else if (currentId) {
      fillForm(getCurrentProject(), { preserveFormDraft: Boolean(opts.preserveFormDraft) });
    }
  }

  async function saveProject() {
    if (!currentId || isBusy) return;
    const project = getCurrentProject();
    if (!project) return;

    const fields = readFormFields();
    if (!fields.title || !fields.city || !fields.year) {
      showToast("Заполните название, город и год", true);
      return;
    }

    const slug = makeUniqueSlug(fields.title, currentId);
    setBusy(true);
    try {
      Object.assign(project, {
        title: fields.title,
        city: fields.city,
        year: fields.year,
        sort_order: fields.sort_order,
        status: fields.status,
        typology: fields.typology,
        description: fields.description,
        slug,
      });

      const galleryOrder = getGalleryOrderFromDom();
      if (galleryOrder.some((e) => e.type === "saved")) {
        applyGalleryOrder(galleryOrder);
      }

      await saveAllProjects();
      clearPendingFiles();
      selectProject(currentId);
      notifyMainSiteRefresh();
      setMediaStatus("cover", "");
      showToast(
        project.published
          ? "Сохранено — проект на сайте"
          : "Сохранено (черновик, на сайте не виден)"
      );
    } catch (err) {
      console.error(err);
      showToast(err.message || "Ошибка сохранения", true);
    } finally {
      setBusy(false);
    }
  }

  async function removeGalleryImage(imageId, storagePath) {
    if (!currentId || isBusy) return;
    if (!confirm("Удалить это фото из галереи?")) return;
    setBusy(true);
    try {
      const project = getCurrentProject();
      if (project) {
        project.project_images = (project.project_images || []).filter((i) => i.id !== imageId);
      }
      await saveAllProjects();
      await removeStorage([storagePath]);
      renderProjectList();
      fillForm(getCurrentProject(), { preserveFormDraft: true });
      showToast("Фото удалено");
    } catch (err) {
      showToast(err.message || "Не удалось удалить", true);
    } finally {
      setBusy(false);
    }
  }

  async function createProject() {
    if (isBusy) return;
    setBusy(true);
    try {
      const nextOrder = projects.length > 0
        ? Math.min(...projects.map((p) => p.sort_order)) - 1
        : 1;
      const id = newId();
      const title = "Новый проект";
      const slug = makeUniqueSlug(title, null);
      const newProject = {
        id, slug, title,
        city: "город",
        year: String(new Date().getFullYear()),
        status: "Концепция",
        typology: "Общественное здание",
        description: "",
        cover_path: "",
        sort_order: nextOrder,
        published: false,
        project_images: [],
      };
      projects.unshift(newProject);
      await saveAllProjects();
      selectProject(id);
      resetCoverPreview();
      setMediaStatus("cover", "Выберите обложку — загрузится сразу");
      showToast("Создан новый проект — загрузите фото");
    } catch (err) {
      showToast(err.message || "Не удалось создать проект", true);
    } finally {
      setBusy(false);
    }
  }

  async function deleteProject() {
    if (!currentId || isBusy) return;
    const project = getCurrentProject();
    if (!project) return;
    if (!confirm(`Удалить проект «${project.title}»?`)) return;
    setBusy(true);
    try {
      const paths = [project.cover_path, ...(project.project_images || []).map((i) => i.storage_path)].filter(Boolean);
      projects = projects.filter((p) => p.id !== currentId);
      await saveAllProjects();
      await removeStorage(paths);
      currentId = null;
      projectForm.hidden = true;
      emptyState.hidden = false;
      clearPendingFiles();
      renderProjectList();
      showToast("Проект удалён");
    } catch (err) {
      showToast(err.message || "Не удалось удалить", true);
    } finally {
      setBusy(false);
    }
  }

  // ── screens ───────────────────────────────────────────────────────────────

  function showApp() {
    loginScreen.hidden = true;
    appScreen.hidden = false;
    loginScreen.setAttribute("aria-hidden", "true");
    appScreen.setAttribute("aria-hidden", "false");
    document.body.classList.add("admin-is-authed");
  }

  function showLogin() {
    loginScreen.hidden = false;
    appScreen.hidden = true;
    loginScreen.setAttribute("aria-hidden", "false");
    appScreen.setAttribute("aria-hidden", "true");
    document.body.classList.remove("admin-is-authed");
  }

  async function tryEnterApp(showWelcome) {
    await loadProjects();
    if (window.AdminPages?.init) await window.AdminPages.init({ showToast, setBusy });
    showApp();
    if (showWelcome) showToast("Вы вошли в админку");
  }

  async function initSession() {
    const token = getToken();
    if (!token) return;
    try {
      await tryEnterApp(false);
    } catch (err) {
      clearToken();
      console.warn("Сессия недействительна:", err.message);
    }
  }

  // ── event bindings ────────────────────────────────────────────────────────

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.hidden = true;
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const fd = new FormData(loginForm);
    const password = String(fd.get("password") || "");

    if (!getWorkerUrl()) {
      loginError.textContent = "UPLOAD_WORKER_URL не задан в supabase-config.js";
      loginError.hidden = false;
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Вход…";

    try {
      await loginWithPassword(password);
      await tryEnterApp(true);
    } catch (err) {
      loginError.textContent = err.message || "Не удалось войти";
      loginError.hidden = false;
      showToast(err.message || "Ошибка входа", true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Войти";
    }
  });

  document.getElementById("btnLogout").addEventListener("click", () => {
    clearToken();
    projects = [];
    currentId = null;
    showLogin();
  });

  projectList.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-select-id]");
    if (btn) { selectProject(btn.dataset.selectId); return; }
    const toggle = e.target.closest("[data-publish-toggle]");
    if (toggle) setProjectPublished(toggle.dataset.publishToggle, toggle.checked);
  });

  document.getElementById("btnNewProject").addEventListener("click", createProject);
  document.querySelectorAll("#btnSave, #btnSaveTop").forEach((btn) => {
    btn.addEventListener("click", () => saveProject());
  });
  document.getElementById("btnDelete").addEventListener("click", deleteProject);

  coverInput.addEventListener("change", () => {
    const file = coverInput.files?.[0];
    if (!file) return;
    if (!currentId) { showToast("Сначала выберите или создайте проект", true); coverInput.value = ""; return; }
    void uploadCoverNow(file);
  });

  galleryInput.addEventListener("change", () => {
    const files = [...(galleryInput.files || [])];
    if (!files.length) return;
    galleryInput.value = "";
    if (!currentId) { showToast("Сначала выберите или создайте проект", true); return; }
    void uploadGalleryFilesNow(files);
  });

  setupProjectListDnD();
  setupGalleryDnD();
  initSession();
})();
