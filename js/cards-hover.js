/* Тач: только hover-стиль не нужен — открытие проекта в project-popup.js */
(function () {
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  /* На тач-устройствах карточки открывают popup по клику (см. project-popup.js) */
})();
