(function () {
  const MANIFEST_URL = "../deploy/manifest.json";
  const BINARY_RE = /\.(png|jpe?g|gif|webp|ico)$/i;

  function client() {
    return window.SupabasePortfolio?.getClient();
  }

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  async function collectDeployFiles() {
    const manifestRes = await fetch(MANIFEST_URL, { cache: "no-store" });
    if (!manifestRes.ok) {
      throw new Error("Не найден deploy/manifest.json");
    }
    const manifest = await manifestRes.json();
    const paths = manifest.paths;
    if (!Array.isArray(paths) || !paths.length) {
      throw new Error("manifest.json пуст");
    }

    const files = [];
    for (const path of paths) {
      const url = new URL(`../${path.replace(/^\//, "")}`, window.location.href);
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Файл не найден: ${path}`);
      }

      if (BINARY_RE.test(path)) {
        const buffer = await res.arrayBuffer();
        files.push({
          path: path.replace(/^\//, ""),
          content: arrayBufferToBase64(buffer),
          encoding: "base64",
        });
      } else {
        files.push({
          path: path.replace(/^\//, ""),
          content: await res.text(),
          encoding: "utf-8",
        });
      }
    }
    return files;
  }

  async function publishSite(showToast, setBusy) {
    const supabase = client();
    if (!supabase) {
      showToast("Supabase не настроен", true);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      showToast("Сначала войдите в админку", true);
      return;
    }

    if (
      !confirm(
        "Опубликовать текущую версию сайта на GitHub Pages?\n\n" +
          "Будут отправлены файлы с этого сервера (локально или с уже открытого сайта).",
      )
    ) {
      return;
    }

    setBusy(true);
    try {
      showToast("Собираем файлы…");
      const files = await collectDeployFiles();

      showToast(`Отправка ${files.length} файлов…`);

      const { data, error } = await supabase.functions.invoke("publish-site", {
        body: {
          files,
          message: "Публикация из админки antonovka.studio",
        },
      });

      if (data?.error) {
        throw new Error(data.error);
      }
      if (error) {
        const body = error.context?.body;
        let detail = error.message;
        if (typeof body === "string") {
          try {
            const parsed = JSON.parse(body);
            if (parsed.error) detail = parsed.error;
          } catch (_) {
            detail = body;
          }
        }
        throw new Error(detail);
      }

      showToast(
        `Опубликовано. Сайт обновится за 1–2 мин: ${data.siteUrl || "GitHub Pages"}`,
      );
    } catch (err) {
      console.error(err);
      const msg =
        err.message ||
        (err.context?.body ? String(err.context.body) : "Не удалось опубликовать");
      showToast(msg, true);
    } finally {
      setBusy(false);
    }
  }

  window.AdminPublish = { publishSite };
})();
