/* Тач: переключение класса .is-active на карточке. Десктоп — CSS :hover */
(function () {
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  document.querySelectorAll(".card").forEach((card) => {
    card.addEventListener(
      "click",
      () => {
        const active = card.classList.contains("is-active");
        document.querySelectorAll(".card.is-active").forEach((c) => c.classList.remove("is-active"));
        if (!active) card.classList.add("is-active");
      },
      { passive: true }
    );
  });
})();
