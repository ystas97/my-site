/* Только для тач-устройств. На десктопе (в т.ч. Safari) — CSS :hover */
(function () {
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  document.querySelectorAll(".card").forEach((card) => {
    const wrap = card.querySelector('[class*="hover-wrap"]');
    if (!wrap) return;

    card.addEventListener(
      "click",
      () => {
        const on = !wrap.classList.contains("is-hovered");
        wrap.classList.toggle("is-hovered", on);
        card.classList.toggle("is-card-hovered", on);
      },
      { passive: true }
    );
  });
})();
