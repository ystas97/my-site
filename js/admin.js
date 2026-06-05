(function () {
  const BUCKET = window.SupabasePortfolio?.BUCKET || "project-images";

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

  let projects = [];
  let currentId = null;
  let pendingGalleryFiles = [];
  let isBusy = false;
  let isLoggingIn = false;

  function client() {
    return window.SupabasePortfolio?.getClient();
  }

  function publicUrl(path) {
    return window.SupabasePortfolio?.storagePublicUrl(path) || "";
  }

  function showToast(message, isError) {
    toast.textContent = message;
    toast.classList.toggle("is-error", Boolean(isError));
    toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      toast.hidden = true;
    }, 5000);
  }

  function showLoginError(message) {
    showLogin();
    loginError.textContent = message;
    loginError.hidden = false;
    showToast(message, true);
  }

  function setBusy(busy) {
    isBusy = busy;
    document.querySelectorAll(".admin-btn").forEach((btn) => {
      btn.disabled = busy;
    });
  }

  function translitSlug(text) {
    const map = {
      а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
      й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
      у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "",
      э: "e", ю: "yu", я: "ya",
    };
    return text
      .toLowerCase()
      .split("")
      .map((ch) => map[ch] ?? ch)
      .join("")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
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

  function workerConfig() {
    const url = window.UPLOAD_WORKER_URL?.trim();
    const secret = window.UPLOAD_WORKER_SECRET?.trim();
    if (!url || !secret) throw new Error("UPLOAD_WORKER_URL / UPLOAD_WORKER_SECRET не заданы в supabase-config.js");
    return { url, secret };
  }

  async function uploadStorage(path, file) {
    const { url, secret } = workerConfig();
    const form = new FormData();
    form.append("file", file);
    form.append("path", path);
    const res = await fetch(`${url}/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      body: form,
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText);
      throw new Error(`Worker upload failed: ${msg}`);
    }
    return path;
  }

  async function removeStorage(paths) {
    if (!paths.length) return;
    const onlyGitHub = paths.filter((p) => p.startsWith("assets/images/"));
    const onlySupabase = paths.filter((p) => !p.startsWith("assets/images/"));

    if (onlyGitHub.length) {
      try {
        const { url, secret } = workerConfig();
        await fetch(`${url}/delete`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
          body: JSON.stringify({ paths: onlyGitHub }),
        });
      } catch (err) {
        console.warn("Worker delete:", err.message);
      }
    }

    if (onlySupabase.length) {
      const supabase = client();
      const { error } = await supabase.storage.from(BUCKET).remove(onlySupabase);
      if (error) console.warn("Storage remove:", error.message);
    }
  }

  async function fetchAllProjects() {
    const supabase = client();
    const { data, error } = await supabase
      .from("projects")
      .select(
        `
        id,
        slug,
        title,
        city,
        year,
        status,
        typology,
        description,
        cover_path,
        sort_order,
        published,
        project_images (
          id,
          storage_path,
          sort_order
        )
      `
      )
      .order("sort_order", { ascending: true });

    if (error) throw error;

    return (data || []).map((row) => ({
      ...row,
      project_images: (row.project_images || []).sort((a, b) => a.sort_order - b.sort_order),
    }));
  }

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

  async function setProjectPublished(projectId, published) {
    if (isBusy) return;

    setBusy(true);
    try {
      const supabase = client();
      const { error } = await supabase
        .from("projects")
        .update({ published })
        .eq("id", projectId);
      if (error) throw error;

      const project = projects.find((p) => p.id === projectId);
      if (project) project.published = published;

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

  function applySortOrderToProjects() {
    projects.forEach((p, index) => {
      p.sort_order = index + 1;
    });
  }

  async function saveSortOrder() {
    if (!projects.length) return;

    setBusy(true);
    try {
      const supabase = client();
      const updates = projects.map((p) =>
        supabase.from("projects").update({ sort_order: p.sort_order }).eq("id", p.id)
      );
      const results = await Promise.all(updates);
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;

      notifyMainSiteRefresh();
      showToast("Порядок на сайте сохранён");

      const current = getCurrentProject();
      if (current && projectForm.elements.sort_order) {
        projectForm.elements.sort_order.value = current.sort_order;
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || "Не удалось сохранить порядок", true);
      await loadProjects();
    } finally {
      setBusy(false);
    }
  }

  async function reorderProjects(dragId, targetId) {
    if (!dragId || !targetId || dragId === targetId || isBusy) return;

    const fromIndex = projects.findIndex((p) => p.id === dragId);
    const toIndex = projects.findIndex((p) => p.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;

    const [moved] = projects.splice(fromIndex, 1);
    projects.splice(toIndex, 0, moved);
    applySortOrderToProjects();
    renderProjectList();
    await saveSortOrder();
  }

  function setupProjectListDnD() {
    let dragId = null;
    let suppressClick = false;

    projectList.addEventListener("click", (e) => {
      if (suppressClick) return;
      if (e.target.closest(".admin-project-list__visibility")) return;
      const btn = e.target.closest("[data-select-id]");
      if (!btn) return;
      selectProject(btn.dataset.selectId);
    });

    projectList.addEventListener("change", (e) => {
      const input = e.target.closest("[data-publish-toggle]");
      if (!input) return;
      void setProjectPublished(input.dataset.publishToggle, input.checked);
    });

    projectList.addEventListener("dragstart", (e) => {
      if (e.target.closest(".admin-project-list__visibility")) {
        e.preventDefault();
        return;
      }
      const item = e.target.closest(".admin-project-list__item");
      if (!item) return;
      dragId = item.dataset.id;
      suppressClick = true;
      item.classList.add("is-dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", dragId);
    });

    projectList.addEventListener("dragend", () => {
      projectList.querySelectorAll(".admin-project-list__item").forEach((el) => {
        el.classList.remove("is-dragging", "is-drag-over");
      });
      dragId = null;
      window.setTimeout(() => {
        suppressClick = false;
      }, 0);
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

    projectList.addEventListener("drop", (e) => {
      e.preventDefault();
      const item = e.target.closest(".admin-project-list__item");
      if (!item || !dragId) return;
      const targetId = item.dataset.id;
      item.classList.remove("is-drag-over");
      void reorderProjects(dragId, targetId);
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getCurrentProject() {
    return projects.find((p) => p.id === currentId) || null;
  }

  function clearPendingFiles() {
    pendingGalleryFiles = [];
    coverInput.value = "";
    galleryInput.value = "";
    setMediaStatus("cover", "");
    setMediaStatus("gallery", "");
    if (coverPreviewWrap) {
      coverPreviewWrap.classList.remove("is-uploading");
    }
  }

  function setMediaStatus(which, text, busy) {
    const el = which === "cover" ? coverMediaStatus : galleryMediaStatus;
    if (!el) return;
    if (!text) {
      el.hidden = true;
      el.textContent = "";
      el.classList.remove("is-busy");
      return;
    }
    el.hidden = false;
    el.textContent = text;
    el.classList.toggle("is-busy", Boolean(busy));
  }

  function resetCoverPreview() {
    if (!coverPreviewWrap || !coverPreview) return;
    coverPreview.onload = null;
    coverPreview.onerror = null;
    coverPreview.removeAttribute("src");
    coverPreviewWrap.classList.remove("is-loading", "is-uploading", "is-error");
    coverPreviewWrap.classList.add("is-empty");
  }

  function setCoverPreviewUrl(url) {
    if (!coverPreviewWrap || !coverPreview) return;
    if (!url) {
      resetCoverPreview();
      return;
    }

    coverPreviewWrap.classList.remove("is-empty", "is-error", "is-uploading");
    coverPreviewWrap.classList.add("is-loading");

    coverPreview.onload = () => {
      coverPreviewWrap.classList.remove("is-loading");
    };
    coverPreview.onerror = () => {
      coverPreviewWrap.classList.remove("is-loading");
      coverPreviewWrap.classList.add("is-empty", "is-error");
      coverPreview.removeAttribute("src");
    };
    coverPreview.src = url;
  }

  function setCoverPreviewFile(file) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCoverPreviewUrl(url);
  }

  async function uploadCoverNow(file) {
    const projectId = currentId;
    if (!projectId || isBusy || !file) return;

    setCoverPreviewFile(file);
    setBusy(true);
    try {
      const supabase = client();
      const path = coverStoragePath(projectId, file.name);

      if (coverPreviewWrap) coverPreviewWrap.classList.add("is-uploading");
      setMediaStatus("cover", "Загрузка обложки…", true);

      await uploadStorage(path, file);

      const { error } = await supabase
        .from("projects")
        .update({ cover_path: path })
        .eq("id", projectId);
      if (error) throw error;

      const project = projects.find((p) => p.id === projectId);
      if (project) project.cover_path = path;

      coverInput.value = "";
      if (currentId === projectId) {
        setCoverPreviewUrl(publicUrl(path));
        setMediaStatus("cover", "Обложка загружена");
      }
      notifyMainSiteRefresh();
      showToast("Обложка загружена");
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

  async function uploadGalleryFilesNow(files) {
    const projectId = currentId;
    if (!projectId || isBusy || !files.length) return;

    const startIndex = pendingGalleryFiles.length;
    pendingGalleryFiles.push(...files);
    const project = getCurrentProject();
    if (project) renderGallery(project);

    setBusy(true);
    try {
      const supabase = client();
      let project = getCurrentProject();
      if (!project) throw new Error("Проект не найден");

      let nextOrder =
        project.project_images.length > 0
          ? Math.max(...project.project_images.map((i) => i.sort_order)) + 1
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

        const { data: imgRow, error: imgError } = await supabase
          .from("project_images")
          .insert({
            project_id: projectId,
            storage_path: path,
            sort_order: nextOrder,
          })
          .select("id, storage_path, sort_order")
          .single();

        if (imgError) throw imgError;
        if (!imgRow?.id) throw new Error("Фото не добавилось в галерею");

        const pendingIdx = pendingGalleryFiles.indexOf(file);
        if (pendingIdx >= 0) pendingGalleryFiles.splice(pendingIdx, 1);

        nextOrder += 1;
      }

      await loadProjects({ preserveFormDraft: true });
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

    project.project_images.forEach((img) => {
      items.push(`
        <li class="admin-gallery__item is-loading" draggable="true" data-image-id="${img.id}" data-path="${escapeHtml(img.storage_path)}">
          <span class="admin-gallery__handle" title="Перетащить" aria-hidden="true">⋮⋮</span>
          <img src="${publicUrl(img.storage_path)}" alt="" loading="lazy" draggable="false" />
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

    galleryList.querySelectorAll(".admin-gallery__item").forEach((li) => {
      bindGalleryImageLoad(li);
    });

    if (pendingGalleryFiles.length) {
      setMediaStatus("gallery", "Загрузка…", true);
    } else if (project.project_images.length) {
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

  function getGalleryOrderFromDom() {
    return [...galleryList.querySelectorAll(".admin-gallery__item")]
      .map((li) => {
        if (li.dataset.imageId) {
          return { type: "saved", id: li.dataset.imageId };
        }
        if (li.dataset.pendingIndex !== undefined) {
          return { type: "pending", index: Number(li.dataset.pendingIndex) };
        }
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

    const savedById = new Map(project.project_images.map((img) => [img.id, img]));
    const newImages = [];
    const newPending = [];

    order.forEach((entry, sortOrder) => {
      if (entry.type === "saved") {
        const img = savedById.get(entry.id);
        if (img) {
          img.sort_order = sortOrder;
          newImages.push(img);
        }
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
    if (!project?.project_images.length || !currentId) return;

    setBusy(true);
    try {
      const supabase = client();
      const updates = project.project_images.map((img) =>
        supabase.from("project_images").update({ sort_order: img.sort_order }).eq("id", img.id),
      );
      const results = await Promise.all(updates);
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;

      notifyMainSiteRefresh();
      showToast("Порядок фото в галерее сохранён");
    } catch (err) {
      console.error(err);
      showToast(err.message || "Не удалось сохранить порядок фото", true);
      await loadProjects({ preserveFormDraft: true });
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
      if (key.startsWith("saved:")) {
        return { type: "saved", id: key.slice(6) };
      }
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
      if (e.target.closest(".admin-gallery__remove")) {
        e.preventDefault();
        return;
      }
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

  function notifyMainSiteRefresh() {
    try {
      localStorage.setItem(STORAGE_SYNC_KEY, String(Date.now()));
    } catch (_) {
      /* ignore */
    }
    try {
      const channel = new BroadcastChannel(SYNC_CHANNEL);
      channel.postMessage("updated");
      channel.close();
    } catch (_) {
      /* ignore */
    }
  }

  async function fetchProjectById(id) {
    const supabase = client();
    const { data, error } = await supabase
      .from("projects")
      .select(
        `
        id,
        slug,
        title,
        city,
        year,
        status,
        typology,
        description,
        sort_order,
        updated_at,
        published,
        cover_path,
        project_images (id, storage_path, sort_order)
      `
      )
      .eq("id", id)
      .single();

    if (error) throw error;
    return {
      ...data,
      project_images: (data.project_images || []).sort((a, b) => a.sort_order - b.sort_order),
    };
  }

  function applyFormFields(fields) {
    if (!projectForm || !fields) return;
    const f = projectForm.elements;
    f.title.value = fields.title;
    f.city.value = fields.city;
    f.year.value = fields.year;
    f.sort_order.value = fields.sort_order;
    f.status.value = fields.status;
    f.typology.value = fields.typology;
    f.description.value = fields.description;
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
    if (projectForm.elements.sort_order) {
      projectForm.elements.sort_order.value = project.sort_order;
    }

    if (draft) {
      applyFormFields(draft);
      formTitle.textContent = draft.title || "Проект";
    } else {
      formTitle.textContent = project.title || "Проект";
    }

    if (project.cover_path && !project.cover_path.startsWith("legacy/")) {
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

  async function loadProjects(opts = {}) {
    const supabase = client();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      throw new Error("Нет активной сессии. Проверьте URL в Supabase Auth (см. supabase/ADMIN.md).");
    }

    try {
      projects = await fetchAllProjects();
    } catch (err) {
      throw new Error(
        (err.message || "Ошибка загрузки") +
          " — выполните supabase/policies-admin.sql в SQL Editor, если ещё не делали."
      );
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
      const supabase = client();
      const coverPath = project.cover_path;

      const { data: savedRow, error: updateError } = await supabase
        .from("projects")
        .update({
          title: fields.title,
          city: fields.city,
          year: fields.year,
          sort_order: fields.sort_order,
          status: fields.status,
          typology: fields.typology,
          slug,
          description: fields.description,
          cover_path: coverPath,
          published: fields.published,
        })
        .eq("id", currentId)
        .select("id, title, status, typology, description, updated_at, published")
        .single();

      if (updateError) throw updateError;
      if (!savedRow?.id) {
        throw new Error("Supabase не обновил запись. Проверьте RLS и policies-admin.sql");
      }

      const galleryOrder = getGalleryOrderFromDom();
      if (galleryOrder.some((e) => e.type === "saved")) {
        applyGalleryOrder(galleryOrder);
        const orderedProject = getCurrentProject();

        if (orderedProject?.project_images.length) {
          const sortUpdates = orderedProject.project_images.map((img) =>
            supabase.from("project_images").update({ sort_order: img.sort_order }).eq("id", img.id),
          );
          const sortResults = await Promise.all(sortUpdates);
          const sortFailed = sortResults.find((r) => r.error);
          if (sortFailed?.error) throw sortFailed.error;
        }
      }

      const verified = await fetchProjectById(currentId);
      if (verified.title !== fields.title) {
        throw new Error("Проверка не прошла: название в базе не совпадает");
      }

      clearPendingFiles();
      await loadProjects();
      selectProject(currentId);
      notifyMainSiteRefresh();
      setMediaStatus("cover", "");

      showToast(
        fields.published
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
      const supabase = client();
      const { error } = await supabase.from("project_images").delete().eq("id", imageId);
      if (error) throw error;
      await removeStorage([storagePath]);
      await loadProjects({ preserveFormDraft: true });
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
      const supabase = client();
      const nextOrder =
        projects.length > 0 ? Math.min(...projects.map((p) => p.sort_order)) - 1 : 1;
      const title = "Новый проект";
      const slug = makeUniqueSlug(title, null);

      const { data, error } = await supabase
        .from("projects")
        .insert({
          slug,
          title,
          city: "город",
          year: String(new Date().getFullYear()),
          status: "Концепция",
          typology: "Общественное здание",
          description: "",
          cover_path: "legacy/project-01.jpg",
          sort_order: nextOrder,
          published: false,
        })
        .select()
        .single();

      if (error) throw error;

      await loadProjects();
      selectProject(data.id);
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
      const supabase = client();
      const paths = [
        project.cover_path,
        ...project.project_images.map((i) => i.storage_path),
      ].filter(Boolean);

      const { error } = await supabase.from("projects").delete().eq("id", currentId);
      if (error) throw error;

      await removeStorage(paths);

      currentId = null;
      projectForm.hidden = true;
      emptyState.hidden = false;
      clearPendingFiles();
      await loadProjects();
      showToast("Проект удалён");
    } catch (err) {
      showToast(err.message || "Не удалось удалить", true);
    } finally {
      setBusy(false);
    }
  }

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
    if (window.AdminPages?.init) {
      await window.AdminPages.init({ showToast, setBusy });
    }
    showApp();
    if (showWelcome) showToast("Вы вошли в админку");
  }

  async function initSession() {
    const supabase = client();
    if (!supabase) {
      loginError.textContent = "Настройте js/supabase-config.js";
      loginError.hidden = false;
      return;
    }

    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        await tryEnterApp(false);
      }
    } catch (err) {
      console.error(err);
      showLoginError("Не удалось загрузить проекты: " + (err.message || ""));
      await supabase.auth.signOut();
    }
  }

  function formatLoginError(error) {
    const msg = error?.message || "";
    if (/email not confirmed/i.test(msg)) {
      return "Подтвердите email (письмо от Supabase) или отключите Confirm email в Auth → Providers.";
    }
    if (/invalid login credentials/i.test(msg)) {
      return "Неверный email или пароль.";
    }
    return msg || "Не удалось войти.";
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.hidden = true;

    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const fd = new FormData(loginForm);
    const email = String(fd.get("email") || "").trim();
    const password = String(fd.get("password") || "");

    const supabase = client();
    if (!supabase) {
      loginError.textContent = "Supabase не настроен (js/supabase-config.js)";
      loginError.hidden = false;
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Вход…";
    isLoggingIn = true;

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        showLoginError(formatLoginError(signInError));
        return;
      }

      const { data: sessionWrap, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        showLoginError(sessionError.message);
        return;
      }
      if (!sessionWrap.session) {
        showLoginError(
          "Вход выполнен, но сессия не сохранилась. В Supabase: Auth → URL Configuration добавьте http://127.0.0.1:8080"
        );
        return;
      }

      await tryEnterApp(true);
    } catch (err) {
      console.error(err);
      showLoginError(err.message || "Ошибка входа");
      await supabase.auth.signOut();
    } finally {
      isLoggingIn = false;
      submitBtn.disabled = false;
      submitBtn.textContent = "Войти";
    }
  });

  document.getElementById("btnLogout").addEventListener("click", async () => {
    await client().auth.signOut();
    projects = [];
    currentId = null;
    showLogin();
  });

  document.getElementById("btnNewProject").addEventListener("click", createProject);
  document.querySelectorAll("#btnSave, #btnSaveTop").forEach((btn) => {
    btn.addEventListener("click", () => saveProject());
  });
  document.getElementById("btnDelete").addEventListener("click", deleteProject);
  coverInput.addEventListener("change", () => {
    const file = coverInput.files?.[0];
    if (!file) return;
    if (!currentId) {
      showToast("Сначала выберите или создайте проект", true);
      coverInput.value = "";
      return;
    }
    void uploadCoverNow(file);
  });

  galleryInput.addEventListener("change", () => {
    const files = [...(galleryInput.files || [])];
    if (!files.length) return;
    galleryInput.value = "";
    if (!currentId) {
      showToast("Сначала выберите или создайте проект", true);
      return;
    }
    void uploadGalleryFilesNow(files);
  });

  client()?.auth.onAuthStateChange((event) => {
    if (isLoggingIn) return;
    if (event === "SIGNED_OUT") showLogin();
  });

  setupProjectListDnD();
  setupGalleryDnD();

  if (!window.SupabasePortfolio?.isConfigured()) {
    loginError.textContent = "Заполните js/supabase-config.js";
    loginError.hidden = false;
  } else {
    initSession();
  }
})();
