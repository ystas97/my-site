(function () {
  const header = document.querySelector(".header");
  const headerBar = header?.querySelector(".header__inner");
  const projectsRoot = document.getElementById("projects");

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
      config.panel.style.removeProperty("pointer-events");
      syncPanelHeight(config);
    } else {
      config.panel.style.pointerEvents = "none";
    }

    header.classList.toggle(config.openClass, open);
    config.trigger.classList.toggle("is-active", open);
    config.trigger.setAttribute("aria-expanded", String(open));
    config.panel.setAttribute("aria-hidden", String(!open));
  }

  function isAnyPanelOpen() {
    return panelConfigs.some((config) => header.classList.contains(config.openClass));
  }

  function closeAllPanels() {
    panelConfigs.forEach((config) => setPanelOpen(config, false));
  }

  function getEventStack(e) {
    if (typeof e.composedPath === "function") {
      const path = e.composedPath();
      if (path.length) return path;
    }
    if (typeof e.clientX === "number" && typeof e.clientY === "number") {
      return document.elementsFromPoint(e.clientX, e.clientY);
    }
    return e.target ? [e.target] : [];
  }

  function stackIncludesTrigger(stack) {
    return panelConfigs.some((config) =>
      stack.some((el) => el instanceof Node && config.trigger.contains(el)),
    );
  }

  function stackIncludesPanelInner(stack) {
    return panelConfigs.some((config) => {
      const inner = config.panel.querySelector(config.innerSelector);
      return (
        inner &&
        stack.some((el) => el instanceof Node && (el === inner || inner.contains(el)))
      );
    });
  }

  function stackIncludesPortfolio(stack) {
    if (!projectsRoot) return false;
    return stack.some(
      (el) => el instanceof Node && (el === projectsRoot || projectsRoot.contains(el)),
    );
  }

  function findPortfolioClickTarget(stack) {
    return stack.find(
      (el) =>
        el instanceof Element &&
        el.closest?.("#projects .card__inner, #projects .card"),
    );
  }

  function handleOutsidePointer(e) {
    if (!isAnyPanelOpen()) return;

    const stack = getEventStack(e);
    if (!stack.length) return;

    if (stackIncludesTrigger(stack)) return;

    if (stackIncludesPortfolio(stack)) {
      const passthrough = findPortfolioClickTarget(stack);
      closeAllPanels();
      if (passthrough && e.type === "click") {
        requestAnimationFrame(() => passthrough.click());
      }
      return;
    }

    if (stackIncludesPanelInner(stack)) return;

    closeAllPanels();
  }

  panelConfigs.forEach((config) => {
    config.trigger.addEventListener("click", (e) => {
      e.preventDefault();
      const isOpen = header.classList.contains(config.openClass);
      setPanelOpen(config, !isOpen);
    });
  });

  document.addEventListener("pointerdown", handleOutsidePointer, true);
  document.addEventListener("click", handleOutsidePointer, true);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isAnyPanelOpen()) closeAllPanels();
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
