(function () {
  const HOVER_ANIM_MS = 250;

  function initWrap(wrap) {
    const card = wrap.closest(".card");
    let leaveTimer = null;
    let savedZ = null;

    const setState = (on) => {
      if (on) {
        if (leaveTimer) {
          clearTimeout(leaveTimer);
          leaveTimer = null;
        }
        wrap.classList.add("is-hovered");
        if (card) {
          savedZ = {
            value: card.style.getPropertyValue("z-index"),
            priority: card.style.getPropertyPriority("z-index"),
          };
          card.style.setProperty("z-index", "999", "important");
        }
      } else {
        wrap.classList.remove("is-hovered");
        if (leaveTimer) clearTimeout(leaveTimer);
        leaveTimer = setTimeout(() => {
          if (card) {
            if (savedZ?.priority) {
              card.style.setProperty("z-index", savedZ.value, savedZ.priority);
            } else {
              card.style.setProperty("z-index", savedZ?.value || "");
            }
          }
          leaveTimer = null;
        }, HOVER_ANIM_MS);
      }
    };

    wrap.addEventListener("mouseenter", () => setState(true));
    wrap.addEventListener("mouseleave", () => setState(false));

    wrap.addEventListener(
      "click",
      () => {
        if (window.matchMedia("(hover: none)").matches) {
          setState(!wrap.classList.contains("is-hovered"));
        }
      },
      { passive: true }
    );
  }

  document.querySelectorAll('[class*="hover-wrap"]').forEach(initWrap);
})();
