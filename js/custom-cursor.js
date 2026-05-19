(function () {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  const dot = document.createElement("div");
  dot.className = "cursor-dot";
  dot.setAttribute("aria-hidden", "true");
  document.body.appendChild(dot);

  let visible = false;

  function setPosition(clientX, clientY) {
    dot.style.transform = `translate3d(${clientX}px, ${clientY}px, 0) translate(-50%, -50%)`;
  }

  function show() {
    if (visible) return;
    dot.style.opacity = "1";
    visible = true;
  }

  function hide() {
    dot.style.opacity = "0";
    visible = false;
  }

  document.addEventListener(
    "mousemove",
    (e) => {
      setPosition(e.clientX, e.clientY);
      show();
    },
    { passive: true }
  );

  document.addEventListener("mouseleave", hide);
  window.addEventListener("blur", hide);
})();
