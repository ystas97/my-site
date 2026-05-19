(function () {
  const BUCKET = window.SupabasePortfolio?.BUCKET || "project-images";

  const loginScreen = document.getElementById("loginScreen");
  const appScreen = document.getElementById("appScreen");
  const loginForm = document.getElementById("loginForm");
  const loginError = document.getElementById("loginError");
  const projectList = document.getElementById("projectList");
  const projectForm = document.getElementById("projectForm");
  const emptyState = document.getElementById("emptyState");
  const coverPreview = document.getElementById("coverPreview");
  const coverInput = document.getElementById("coverInput");
  const galleryInput = document.getElementById("galleryInput");
  const galleryList = document.getElementById("galleryList");
  const formTitle = document.getElementById("formTitle");
  const toast = document.getElementById("toast");

  const STORAGE_SYNC_KEY = "antonovka_projects_updated_at";
  const SYNC_CHANNEL = "antonovka-portfolio-sync";

  let projects = [];
  let currentId = null;
  let pendingCoverFile = null;
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
    return `projects/${projectId}/cover.${fileExt(filename)}`;
  }

  function galleryStoragePath(projectId, filename, index) {
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    return `projects/${projectId}/gallery/${String(index).padStart(2, "0")}_${safe}`;
  }

  async function uploadStorage(path, file) {
    const supabase = client();
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      upsert: true,
      contentType: file.type,
    });
    if (error) throw error;
    return path;
  }

  async function removeStorage(paths) {
    if (!paths.length) return;
    const supabase = client();
    const { error } = await supabase.storage.from(BUCKET).remove(paths);
    if (error) console.warn("Storage remove:", error.message);
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

  function renderProjectList() {
    projectList.innerHTML = projects
      .map((p) => {
        const active = p.id === currentId ? " is-active" : "";
        const draft = p.published ? "" : ' <span class="admin-project-list__badge is-draft">черновик</span>';
        return `
        <li class="admin-project-list__item${active}" data-id="${p.id}" draggable="true">
          <span class="admin-project-list__handle" title="Перетащить" aria-hidden="true">⋮⋮</span>
          <button type="button" class="admin-project-list__btn" data-select-id="${p.id}">
            <span class="admin-project-list__title">${escapeHtml(p.title)}</span>
            <span class="admin-project-list__meta">${escapeHtml(p.city)} · ${escapeHtml(p.year)}</span>
            ${draft}
          </button>
        </li>`;
      })
      .join("");
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
      const btn = e.target.closest("[data-select-id]");
      if (!btn) return;
      selectProject(btn.dataset.selectId);
    });

    projectList.addEventListener("dragstart", (e) => {
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
    pendingCoverFile = null;
    pendingGalleryFiles = [];
    coverInput.value = "";
    galleryInput.value = "";
  }

  function renderGallery(project) {
    const items = [];

    project.project_images.forEach((img) => {
      items.push(`
        <li class="admin-gallery__item" data-image-id="${img.id}" data-path="${escapeHtml(img.storage_path)}">
          <img src="${publicUrl(img.storage_path)}" alt="" />
          <button type="button" class="admin-gallery__remove" aria-label="Удалить">×</button>
        </li>
      `);
    });

    pendingGalleryFiles.forEach((file, index) => {
      const url = URL.createObjectURL(file);
      items.push(`
        <li class="admin-gallery__item" data-pending-index="${index}">
          <img src="${url}" alt="" />
          <span class="admin-project-list__badge is-draft" style="position:absolute;bottom:4px;left:4px;">новое</span>
        </li>
      `);
    });

    galleryList.innerHTML = items.join("");

    galleryList.querySelectorAll(".admin-gallery__remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const li = btn.closest(".admin-gallery__item");
        const imageId = li?.dataset.imageId;
        if (imageId) removeGalleryImage(imageId, li.dataset.path);
      });
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

  function fillForm(project) {
    projectForm.hidden = false;
    emptyState.hidden = true;
    formTitle.textContent = project.title || "Проект";

    const f = projectForm.elements;
    f.title.value = project.title;
    f.city.value = project.city;
    f.year.value = project.year;
    f.sort_order.value = project.sort_order;
    f.status.value = project.status || "";
    f.typology.value = project.typology || "";
    f.description.value = project.description || "";
    f.published.checked = Boolean(project.published);

    if (projectForm.elements.sort_order) {
      projectForm.elements.sort_order.value = project.sort_order;
    }

    coverPreview.src = publicUrl(project.cover_path);
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

  async function loadProjects() {
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
      fillForm(getCurrentProject());
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
      published: fd.get("published") === "on",
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
      let coverPath = project.cover_path;

      if (pendingCoverFile) {
        coverPath = coverStoragePath(currentId, pendingCoverFile.name);
        await uploadStorage(coverPath, pendingCoverFile);
      }

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

      if (pendingGalleryFiles.length) {
        let nextOrder =
          project.project_images.length > 0
            ? Math.max(...project.project_images.map((i) => i.sort_order)) + 1
            : 0;

        for (const file of pendingGalleryFiles) {
          const path = galleryStoragePath(currentId, file.name, nextOrder);
          await uploadStorage(path, file);
          const { data: imgRow, error: imgError } = await supabase
            .from("project_images")
            .insert({
              project_id: currentId,
              storage_path: path,
              sort_order: nextOrder,
            })
            .select("id")
            .single();
          if (imgError) throw imgError;
          if (!imgRow?.id) throw new Error("Фото не добавилось в project_images");
          nextOrder += 1;
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
      await loadProjects();
      selectProject(currentId);
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
      showToast("Создан новый проект — заполните поля и загрузите фото");
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
  document.getElementById("btnSave").addEventListener("click", () => saveProject());
  document.getElementById("btnDelete").addEventListener("click", deleteProject);
  document.getElementById("btnPublishSite")?.addEventListener("click", () => {
    window.AdminPublish?.publishSite(showToast, setBusy);
  });

  coverInput.addEventListener("change", () => {
    const file = coverInput.files?.[0];
    if (!file) return;
    pendingCoverFile = file;
    coverPreview.src = URL.createObjectURL(file);
  });

  galleryInput.addEventListener("change", () => {
    const files = [...(galleryInput.files || [])];
    if (!files.length) return;
    pendingGalleryFiles.push(...files);
    galleryInput.value = "";
    const project = getCurrentProject();
    if (project) renderGallery(project);
  });

  client()?.auth.onAuthStateChange((event) => {
    if (isLoggingIn) return;
    if (event === "SIGNED_OUT") showLogin();
  });

  setupProjectListDnD();

  if (!window.SupabasePortfolio?.isConfigured()) {
    loginError.textContent = "Заполните js/supabase-config.js";
    loginError.hidden = false;
  } else {
    initSession();
  }
})();
