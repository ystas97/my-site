(function () {
  const STORAGE_SYNC_KEY = "antonovka_site_updated_at";

  const DEFAULT_ABOUT = {
    blocks: [
      {
        title: "О бюро",
        lead: "",
        paragraphs: [
          "Мы назвали архитектурное бюро «Антоновка», потому что хотели живого, близкого и понятного каждому имени. Оно напоминает о ярком вкусе, семейном уюте и тёплых воспоминаниях детства. Хотя мы — семейное бюро и не используем фамилию, «Антоновка» созвучна имени основателя и отражает наш характер — одновременно гармоничный и смелый.",
        ],
      },
      {
        title: "Кто мы?",
        lead: "Светлана и Антон Севастьяновы",
        paragraphs: [
          "За «Антоновкой» стоят супруги Светлана и Антон Севастьяновы — архитекторы с опытом более 10 лет каждый. Светлана работала в крупных бюро над жилыми и коммерческими проектами, Антон был главным архитектором города. Вместе они создали десятки общественных, жилых и коммерческих объектов.",
        ],
      },
      {
        title: "Миссия",
        lead: "",
        paragraphs: [
          "«Антоновка» — это архитектурное бюро полного цикла, специализирующееся на социально-ориентированных проектах. В центре каждого решения — человек, его эмоции и опыт взаимодействия с городской средой.",
          "Наша цель — сделать город по-настоящему жизнерадостным и любимым. Это наш вклад в общую копилку городской индивидуальности, красоты и атмосферы коллективного благополучия.",
          "Мы умеем создавать глубокие и эффектные объекты даже при ограниченных ресурсах и сжатых сроках, находя общий язык со всеми участниками процесса. Каждый наш проект это рождение новых ярких историй и счастливых моментов.",
        ],
      },
    ],
    people: [
      {
        name: "Антон Севастьянов",
        image_path: "assets/images/anton-sevastyanov.png",
        bullets: [
          "выпускник в 2011 Казанского Государственного Архитектурно-строительного Университета",
          "с 2013 по 2016 работал главным архитектором проекта в проектном институте Моспромпроект",
          "с 2016 по 2019 работал в команде бюро Wowhaus",
          "с 2019-2024 главный архитектор города Альметьевск в Республике Татарстан",
        ],
      },
      {
        name: "Светлана Севастьянова",
        image_path: "assets/images/svetlana-sevastyanova.png",
        bullets: [
          "выпускница Казанского Государственного Архитектурно-строительного Университета в 2012",
          "с 2013 по 2014 работала ведущим архитектором проекта в проектном институте Моспромпроект",
          "с 2014 по 2019 работала ведущим архитектором бюро Speech",
          "с 2019-2024 главный архитектор города Альметьевск в Республике Татарстан",
        ],
      },
    ],
  };

  const DEFAULT_CONTACTS = {
    phone: "+7 (499) 281-55-40",
    email: "info@antonovka.studio",
    address: "Москва, Малый Рогожский пер, 11",
  };

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function resolveImageUrl(path, cacheVersion) {
    if (!path) return "";
    let url = path;
    if (/^https?:\/\//i.test(path)) {
      url = path;
    } else if (window.SupabasePortfolio?.storagePublicUrl && !path.startsWith("assets/")) {
      url = window.SupabasePortfolio.storagePublicUrl(path) || path;
    } else {
      url = path.replace(/^\//, "");
    }
    if (cacheVersion && !path.startsWith("assets/")) {
      const sep = url.includes("?") ? "&" : "?";
      return `${url}${sep}v=${cacheVersion}`;
    }
    return url;
  }

  function phoneHref(phone) {
    const digits = String(phone || "").replace(/\D/g, "");
    return digits ? `tel:+${digits}` : "#";
  }

  function normalizeAbout(raw) {
    const content = raw && typeof raw === "object" ? raw : {};
    const blocks = Array.isArray(content.blocks) ? content.blocks : DEFAULT_ABOUT.blocks;
    const people = Array.isArray(content.people) ? content.people : DEFAULT_ABOUT.people;
    return {
      blocks: blocks.map((b, i) => ({
        title: b.title || DEFAULT_ABOUT.blocks[i]?.title || "",
        lead: b.lead || "",
        paragraphs: Array.isArray(b.paragraphs) ? b.paragraphs.filter(Boolean) : [],
      })),
      people: people.map((p, i) => ({
        name: p.name || DEFAULT_ABOUT.people[i]?.name || "",
        image_path: p.image_path || DEFAULT_ABOUT.people[i]?.image_path || "",
        image_version: p.image_version || null,
        bullets: Array.isArray(p.bullets) ? p.bullets.filter(Boolean) : [],
      })),
    };
  }

  function normalizeContacts(raw) {
    const content = raw && typeof raw === "object" ? raw : {};
    return {
      phone: content.phone || DEFAULT_CONTACTS.phone,
      email: content.email || DEFAULT_CONTACTS.email,
      address: content.address || DEFAULT_CONTACTS.address,
    };
  }

  function renderAbout(about, sectionUpdatedAt) {
    const inner = document.querySelector("#headerAbout .header__about-inner");
    if (!inner) return;

    const sectionBust = sectionUpdatedAt
      ? new Date(sectionUpdatedAt).getTime()
      : null;

    const blocksHtml = about.blocks
      .map((block) => {
        const lead = block.lead
          ? `<p class="header__about-lead">${escapeHtml(block.lead)}</p>`
          : "";
        const paragraphs = block.paragraphs
          .map((p) => `<p>${escapeHtml(p)}</p>`)
          .join("");
        return `
        <section class="header__about-block">
          <h2>${escapeHtml(block.title)}</h2>
          ${lead}
          ${paragraphs}
        </section>`;
      })
      .join("");

    const peopleHtml = about.people
      .map((person) => {
        const bust = person.image_version || sectionBust;
        const src = resolveImageUrl(person.image_path, bust);
        const bullets = person.bullets
          .map((line) => `<li>${escapeHtml(line)}</li>`)
          .join("");
        return `
        <div class="header__about-person">
          <img src="${escapeHtml(src)}" alt="${escapeHtml(person.name)}" width="300" height="300" loading="lazy" />
          <h3>${escapeHtml(person.name)}</h3>
          <ul>${bullets}</ul>
        </div>`;
      })
      .join("");

    inner.innerHTML = `
      <div class="header__about-text">${blocksHtml}</div>
      ${peopleHtml}`;
  }

  function renderContacts(contacts) {
    const inner = document.querySelector("#headerContacts .header__contacts-inner");
    if (!inner) return;

    inner.innerHTML = `
      <p><a href="${escapeHtml(phoneHref(contacts.phone))}">${escapeHtml(contacts.phone)}</a></p>
      <p><a href="mailto:${escapeHtml(contacts.email)}">${escapeHtml(contacts.email)}</a></p>
      <p>${escapeHtml(contacts.address)}</p>`;
  }

  function notifyLayout() {
    window.dispatchEvent(new Event("resize"));
  }

  async function fetchSections() {
    if (!window.SupabasePortfolio?.isConfigured()) return null;
    const client = window.SupabasePortfolio.getClient();
    const { data, error } = await client
      .from("site_sections")
      .select("slug, content, updated_at");
    if (error) throw error;
    const map = {};
    (data || []).forEach((row) => {
      map[row.slug] = { content: row.content, updated_at: row.updated_at };
    });
    return map;
  }

  async function initSiteContent() {
    let about = DEFAULT_ABOUT;
    let contacts = DEFAULT_CONTACTS;
    let aboutUpdatedAt = null;

    try {
      const map = await fetchSections();
      if (map) {
        if (map.about) {
          about = normalizeAbout(map.about.content);
          aboutUpdatedAt = map.about.updated_at;
        }
        if (map.contacts) contacts = normalizeContacts(map.contacts.content);
      }
    } catch (err) {
      console.warn("Контент секций (fallback на вёрстку):", err);
    }

    renderAbout(about, aboutUpdatedAt);
    renderContacts(contacts);
    notifyLayout();

    window.SITE_CONTENT = { about, contacts };
    window.dispatchEvent(new CustomEvent("sitecontentready"));
  }

  function setupAutoRefresh() {
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_SYNC_KEY) initSiteContent();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") initSiteContent();
    });
    try {
      const channel = new BroadcastChannel("antonovka-portfolio-sync");
      channel.onmessage = (e) => {
        if (e.data?.type === "site") initSiteContent();
      };
    } catch (_) {
      /* ignore */
    }
  }

  window.SiteContent = {
    DEFAULT_ABOUT,
    DEFAULT_CONTACTS,
    normalizeAbout,
    normalizeContacts,
    STORAGE_SYNC_KEY,
    initSiteContent,
  };

  setupAutoRefresh();
  initSiteContent();
})();
