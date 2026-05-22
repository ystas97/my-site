(function () {
  const preloader = document.getElementById("preloader");
  const video = preloader?.querySelector(".preloader__video");
  if (!preloader || !video) return;

  document.body.classList.add("is-preloading");

  const MIN_SHOW_MS = 1200;
  const MAX_WAIT_MS = 10000;
  const startedAt = Date.now();
  let finished = false;

  function hidePreloader() {
    if (finished) return;
    finished = true;

    const elapsed = Date.now() - startedAt;
    const delay = Math.max(0, MIN_SHOW_MS - elapsed);

    window.setTimeout(() => {
      preloader.classList.add("is-hidden");
      preloader.setAttribute("aria-hidden", "true");
      document.body.classList.remove("is-preloading");
      window.setTimeout(() => preloader.remove(), 550);
    }, delay);
  }

  video.addEventListener("ended", hidePreloader);
  video.addEventListener("error", hidePreloader);

  const playAttempt = video.play();
  if (playAttempt?.catch) {
    playAttempt.catch(() => window.setTimeout(hidePreloader, MIN_SHOW_MS));
  }

  window.setTimeout(hidePreloader, MAX_WAIT_MS);
})();
