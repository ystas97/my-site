(function () {
  const HOVER_ANIM_MS = 250;

  function initCard(card) {
    const wrap = card.querySelector('[class*="hover-wrap"]');
    if (!wrap) return;

    let leaveTimer = null;

    const setState = (on) => {
      if (on) {
        if (leaveTimer) {
          clearTimeout(leaveTimer);
          leaveTimer = null;
        }
        wrap.classList.add("is-hovered");
        card.classList.add("is-card-hovered");
      } else {
        wrap.classList.remove("is-hovered");
        card.classList.remove("is-card-hovered");
        if (leaveTimer) clearTimeout(leaveTimer);
        leaveTimer = setTimeout(() => {
          leaveTimer = null;
        }, HOVER_ANIM_MS);
      }
    };

    /* События на .card — зона наведения не меняется при scale внутри */
    card.addEventListener("mouseenter", () => setState(true));
    card.addEventListener("mouseleave", () => setState(false));

    card.addEventListener(
      "click",
      () => {
        if (window.matchMedia("(hover: none)").matches) {
          setState(!wrap.classList.contains("is-hovered"));
        }
      },
      { passive: true }
    );
  }

  document.querySelectorAll(".card").forEach(initCard);
})();
