(function () {
  const BUCKET = window.SupabasePortfolio?.BUCKET || "project-images";
  const SYNC_KEY = window.SiteContent?.STORAGE_SYNC_KEY || "antonovka_site_updated_at";

  const moduleProjects = document.getElementById("moduleProjects");
  const modulePages = document.getElementById("modulePages");
  const pageList = document.getElementById("pageList");
  const pagesEmpty = document.getElementById("pagesEmpty");
  const aboutForm = document.getElementById("aboutPageForm");
  const contactsForm = document.getElementById("contactsPageForm");

  let currentSlug = null;
  let aboutDraft = null;
  let contactsDraft = null;
  let showToast = () => {};
  let setBusy = () => {};

  function client() {
    return window.SupabasePortfolio?.getClient();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function publicUrl(path) {
    return window.SupabasePortfolio?.storagePublicUrl(path) || path;
  }

  function paragraphsToText(paragraphs) {
    return (paragraphs || []).join("\n\n");
  }

  function textToParagraphs(text) {
    return String(text || "")
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
  }

  function bulletsToText(bullets) {
    return (bullets || []).join("\n");
  }

  function textToBullets(text) {
    return String(text || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function setModule(module) {
    const isProjects = module === "projects";
    moduleProjects.hidden = !isProjects;
    modulePages.hidden = isProjects;

    document.querySelectorAll("[data-admin-module]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.adminModule === module);
    });
  }

  function renderPageList() {
    if (!pageList) return;
    pageList.querySelectorAll("[data-page-slug]").forEach((btn) => {
      const slug = btn.dataset.pageSlug;
      btn.classList.toggle("is-active", slug === currentSlug);
    });
  }

  function showPageForm(slug) {
    currentSlug = slug;
    renderPageList();
    pagesEmpty.hidden = true;
    aboutForm.hidden = slug !== "about";
    contactsForm.hidden = slug !== "contacts";
  }

  function personImageInput(index) {
    return aboutForm.querySelector(`input[name="person${index}Image"]`);
  }

  function personPreviewWrap(index) {
    return document.getElementById(`person${index}PreviewWrap`);
  }

  function readAboutFromForm() {
    const f = aboutForm;
    const content = window.SiteContent.normalizeAbout({
      blocks: [
        {
          title: "О бюро",
          lead: "",
          paragraphs: textToParagraphs(f.aboutIntro.value),
        },
        {
          title: "Кто мы?",
          lead: String(f.aboutWhoLead.value || "").trim(),
          paragraphs: textToParagraphs(f.aboutWhoText.value),
        },
        {
          title: "Миссия",
          lead: "",
          paragraphs: textToParagraphs(f.aboutMission.value),
        },
      ],
      people: [
        {
          name: String(f.person1Name.value || "").trim(),
          image_path: String(personImageInput(1)?.value || "").trim(),
          bullets: textToBullets(f.person1Bullets.value),
        },
        {
          name: String(f.person2Name.value || "").trim(),
          image_path: String(personImageInput(2)?.value || "").trim(),
          bullets: textToBullets(f.person2Bullets.value),
        },
      ],
    });

    content.people.forEach((person, i) => {
      const draftPerson = aboutDraft?.people?.[i];
      if (draftPerson?.image_version && person.image_path === draftPerson.image_path) {
        person.image_version = draftPerson.image_version;
      }
    });

    return content;
  }

  function fillAboutForm(about) {
    const f = aboutForm;
    const blocks = about.blocks || [];
    f.aboutIntro.value = paragraphsToText(blocks[0]?.paragraphs);
    f.aboutWhoLead.value = blocks[1]?.lead || "";
    f.aboutWhoText.value = paragraphsToText(blocks[1]?.paragraphs);
    f.aboutMission.value = paragraphsToText(blocks[2]?.paragraphs);

    const people = about.people || [];
    f.person1Name.value = people[0]?.name || "";
    if (personImageInput(1)) personImageInput(1).value = people[0]?.image_path || "";
    f.person1Bullets.value = bulletsToText(people[0]?.bullets);
    f.person2Name.value = people[1]?.name || "";
    if (personImageInput(2)) personImageInput(2).value = people[1]?.image_path || "";
    f.person2Bullets.value = bulletsToText(people[1]?.bullets);

    updatePersonPreview(1, people[0]?.image_path, people[0]?.image_version);
    updatePersonPreview(2, people[1]?.image_path, people[1]?.image_version);
  }

  function fillContactsForm(contacts) {
    contactsForm.phone.value = contacts.phone || "";
    contactsForm.email.value = contacts.email || "";
    contactsForm.address.value = contacts.address || "";
  }

  function readContactsFromForm() {
    return window.SiteContent.normalizeContacts({
      phone: String(contactsForm.phone.value || "").trim(),
      email: String(contactsForm.email.value || "").trim(),
      address: String(contactsForm.address.value || "").trim(),
    });
  }

  function previewUrl(path, version) {
    if (!path) return "";
    const base = publicUrl(path) || path;
    if (!version || path.startsWith("assets/")) return base;
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}v=${version}`;
  }

  function setPersonPreviewLoading(index, loading) {
    const wrap = personPreviewWrap(index);
    if (!wrap) return;
    wrap.classList.toggle("is-uploading", loading);
    wrap.classList.toggle("is-loading", loading);
  }

  function updatePersonPreview(index, path, version) {
    const img = document.getElementById(`person${index}Preview`);
    const wrap = personPreviewWrap(index);
    if (!img || !wrap) return;

    wrap.classList.remove("is-uploading", "is-loading", "is-error");

    const url = previewUrl(path, version);
    if (!url) {
      img.removeAttribute("src");
      wrap.classList.add("is-empty");
      return;
    }

    wrap.classList.remove("is-empty");
    wrap.classList.add("is-loading");

    img.onload = () => wrap.classList.remove("is-loading");
    img.onerror = () => {
      wrap.classList.remove("is-loading");
      wrap.classList.add("is-empty", "is-error");
      img.removeAttribute("src");
    };
    img.src = url;
    img.alt = "";
  }

  async function loadSections() {
    aboutDraft = window.SiteContent.DEFAULT_ABOUT;
    contactsDraft = window.SiteContent.DEFAULT_CONTACTS;

    if (!window.SupabasePortfolio?.isConfigured()) return;

    try {
      const rows = await window.SupabasePortfolio.fetchSiteSections();
      const map = {};
      rows.forEach((row) => {
        map[row.slug] = row.content;
      });
      if (map.about) aboutDraft = window.SiteContent.normalizeAbout(map.about);
      if (map.contacts) contactsDraft = window.SiteContent.normalizeContacts(map.contacts);
    } catch (err) {
      console.warn(err);
      showToast(
        "Не загружены разделы «О бюро». Выполните supabase/migrate-site-sections.sql в SQL Editor.",
        true,
      );
    }
  }

  function broadcastUpdate() {
    localStorage.setItem(SYNC_KEY, String(Date.now()));
    try {
      const channel = new BroadcastChannel("antonovka-portfolio-sync");
      channel.postMessage({ type: "site" });
      channel.close();
    } catch (_) {
      /* ignore */
    }
  }

  async function saveAbout() {
    const content = readAboutFromForm();
    if (!content.blocks[0].paragraphs.length) {
      showToast("Заполните текст «О бюро»", true);
      return;
    }

    setBusy(true);
    try {
      await window.SupabasePortfolio.upsertSiteSection("about", content);
      aboutDraft = content;
      broadcastUpdate();
      showToast("Раздел «О бюро» сохранён");
    } catch (err) {
      console.error(err);
      showToast(err.message || "Не удалось сохранить", true);
    } finally {
      setBusy(false);
    }
  }

  async function saveContacts() {
    const content = readContactsFromForm();
    if (!content.phone || !content.email) {
      showToast("Укажите телефон и email", true);
      return;
    }

    setBusy(true);
    try {
      await window.SupabasePortfolio.upsertSiteSection("contacts", content);
      contactsDraft = content;
      broadcastUpdate();
      showToast("Контакты сохранены");
    } catch (err) {
      console.error(err);
      showToast(err.message || "Не удалось сохранить", true);
    } finally {
      setBusy(false);
    }
  }

  function fileExt(name) {
    const parts = name.split(".");
    return parts.length > 1 ? parts.pop().toLowerCase() : "jpg";
  }

  function workerConfig() {
    const url = window.UPLOAD_WORKER_URL?.trim();
    const secret = window.UPLOAD_WORKER_SECRET?.trim();
    if (!url || !secret) throw new Error("UPLOAD_WORKER_URL / UPLOAD_WORKER_SECRET не заданы в supabase-config.js");
    return { url, secret };
  }

  async function uploadPersonImage(index, file) {
    const path = `assets/images/about/person-${index}.${fileExt(file.name)}`;
    const version = Date.now();
    const previewWrap = personPreviewWrap(index);
    const localUrl = URL.createObjectURL(file);

    if (previewWrap) {
      previewWrap.classList.remove("is-empty");
      previewWrap.classList.add("is-uploading");
      const img = document.getElementById(`person${index}Preview`);
      if (img) img.src = localUrl;
    }

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

    URL.revokeObjectURL(localUrl);

    const field = personImageInput(index);
    if (field) field.value = path;

    const content = readAboutFromForm();
    const person = content.people[index - 1];
    if (person) {
      person.image_path = path;
      person.image_version = version;
    }

    await window.SupabasePortfolio.upsertSiteSection("about", content);
    aboutDraft = content;
    broadcastUpdate();

    updatePersonPreview(index, path, version);
    showToast("Фото сохранено и опубликовано на сайте");
  }

  function bindEvents() {
    document.querySelectorAll("[data-admin-module]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setModule(btn.dataset.adminModule);
        if (btn.dataset.adminModule === "pages" && !currentSlug) {
          showPageForm("about");
          fillAboutForm(aboutDraft);
        }
      });
    });

    pageList?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-page-slug]");
      if (!btn) return;
      const slug = btn.dataset.pageSlug;
      showPageForm(slug);
      if (slug === "about") fillAboutForm(aboutDraft);
      if (slug === "contacts") fillContactsForm(contactsDraft);
    });

    document.getElementById("btnSaveAbout")?.addEventListener("click", () => saveAbout());
    document.getElementById("btnSaveAboutTop")?.addEventListener("click", () => saveAbout());
    document.getElementById("btnSaveContacts")?.addEventListener("click", () => saveContacts());
    document.getElementById("btnSaveContactsTop")?.addEventListener("click", () => saveContacts());

    document.getElementById("person1Upload")?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      setBusy(true);
      setPersonPreviewLoading(1, true);
      uploadPersonImage(1, file)
        .catch((err) => showToast(err.message, true))
        .finally(() => {
          setPersonPreviewLoading(1, false);
          setBusy(false);
        });
    });

    document.getElementById("person2Upload")?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      setBusy(true);
      setPersonPreviewLoading(2, true);
      uploadPersonImage(2, file)
        .catch((err) => showToast(err.message, true))
        .finally(() => {
          setPersonPreviewLoading(2, false);
          setBusy(false);
        });
    });
  }

  async function init(deps) {
    showToast = deps.showToast || showToast;
    setBusy = deps.setBusy || setBusy;
    bindEvents();
    await loadSections();
    fillAboutForm(aboutDraft);
    fillContactsForm(contactsDraft);
  }

  window.AdminPages = { init, setModule };
})();
