(function () {
  const header = document.querySelector(".header");
  const headerBar = header?.querySelector(".header__inner");

  const panelConfigs = [
    {
      openClass: "is-contacts-open",
      panel: document.getElementById("headerContacts"),
      trigger: document.querySelector(".header__nav-contacts"),
      heightVar: "--contacts-panel-height",
      innerSelector: ".header__contacts-inner",
    },
    {
      openClass: "is-about-open",
      panel: document.getElementById("headerAbout"),
      trigger: document.querySelector(".header__nav-about"),
      heightVar: "--about-panel-height",
      innerSelector: ".header__about-inner",
    },
  ].filter((config) => header && headerBar && config.panel && config.trigger);

  if (!panelConfigs.length) return;

  function syncHeaderOffset() {
    document.documentElement.style.setProperty(
      "--header-offset",
      `${Math.ceil(headerBar.offsetHeight)}px`
    );
    window.dispatchEvent(new Event("headeroffset"));
  }

  function syncPanelHeight(config) {
    const inner = config.panel.querySelector(config.innerSelector);
    if (!inner) return;
    document.documentElement.style.setProperty(
      config.heightVar,
      `${Math.ceil(inner.scrollHeight)}px`
    );
  }

  function setPanelOpen(config, open) {
    if (open) {
      panelConfigs.forEach((other) => {
        if (other !== config) setPanelOpen(other, false);
      });
      syncPanelHeight(config);
    }

    header.classList.toggle(config.openClass, open);
    config.trigger.classList.toggle("is-active", open);
    config.trigger.setAttribute("aria-expanded", String(open));
    config.panel.setAttribute("aria-hidden", String(!open));
  }

  function isAnyPanelOpen() {
    return panelConfigs.some((config) => header.classList.contains(config.openClass));
  }

  panelConfigs.forEach((config) => {
    config.trigger.addEventListener("click", (e) => {
      e.preventDefault();
      const isOpen = header.classList.contains(config.openClass);
      setPanelOpen(config, !isOpen);
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isAnyPanelOpen()) {
      panelConfigs.forEach((config) => setPanelOpen(config, false));
    }
  });

  window.addEventListener("resize", () => {
    syncHeaderOffset();
    panelConfigs.forEach((config) => {
      if (header.classList.contains(config.openClass)) syncPanelHeight(config);
    });
  });

  panelConfigs.forEach(syncPanelHeight);
  syncHeaderOffset();

  window.addEventListener("sitecontentready", () => {
    panelConfigs.forEach(syncPanelHeight);
    syncHeaderOffset();
  });
})();
