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
    const FADE_MS = 650;
    const FADE_START_MS = 100;

    window.setTimeout(() => {
      preloader.classList.add("is-hiding");
      preloader.setAttribute("aria-hidden", "true");
      document.body.classList.remove("is-preloading");
      document.body.classList.add("is-preloader-hiding");

      const cleanup = () => {
        document.body.classList.remove("is-preloader-hiding");
        preloader.remove();
      };

      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        cleanup();
      };

      preloader.addEventListener(
        "transitionend",
        (e) => {
          if (e.target === preloader && e.propertyName === "opacity") finish();
        },
        { once: true },
      );
      window.setTimeout(finish, FADE_MS + 120);
    }, delay + FADE_START_MS);
  }

  video.addEventListener("ended", hidePreloader);
  video.addEventListener("error", hidePreloader);

  const playAttempt = video.play();
  if (playAttempt?.catch) {
    playAttempt.catch(() => window.setTimeout(hidePreloader, MIN_SHOW_MS));
  }

  window.setTimeout(hidePreloader, MAX_WAIT_MS);
})();
