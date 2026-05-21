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

  function getCnameContent() {
    const host = window.location.hostname;
    if (
      host &&
      host !== "localhost" &&
      host !== "127.0.0.1" &&
      !host.endsWith(".github.io")
    ) {
      return `${host}\n`;
    }
    return "antonovka.studio\n";
  }

  function buildCnameFile() {
    return {
      path: "CNAME",
      content: getCnameContent(),
      encoding: "utf-8",
    };
  }

  async function fetchDeployFile(path) {
    if (path === "CNAME") {
      return buildCnameFile();
    }

    const normalized = path.replace(/^\//, "");
    const url = new URL(`../${normalized}`, window.location.href);
    url.searchParams.set("t", String(Date.now()));
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return null;
    }

    if (BINARY_RE.test(normalized)) {
      const buffer = await res.arrayBuffer();
      return {
        path: normalized,
        content: arrayBufferToBase64(buffer),
        encoding: "base64",
      };
    }

    return {
      path: normalized,
      content: await res.text(),
      encoding: "utf-8",
    };
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
      const file = await fetchDeployFile(path);
      if (!file) {
        throw new Error(`Файл не найден: ${path}`);
      }
      files.push(file);
    }

    /* На GitHub Pages нужен publishable key — файл в .gitignore, но есть локально */
    const hasConfig = files.some((f) => f.path === "js/supabase-config.js");
    if (!hasConfig) {
      const config = await fetchDeployFile("js/supabase-config.js");
      if (!config) {
        throw new Error(
          "Нет js/supabase-config.js — создайте из supabase-config.example.js",
        );
      }
      if (
        config.content.includes("YOUR_KEY") ||
        config.content.includes("YOUR_PROJECT")
      ) {
        throw new Error("Заполните ключи в js/supabase-config.js перед публикацией");
      }
      files.push(config);
    }

    return files;
  }

  function isLocalDeployOrigin() {
    const host = window.location.hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
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

    const fromLocal = isLocalDeployOrigin();

    if (fromLocal) {
      if (
        !confirm(
          "Опубликовать сайт на GitHub Pages?\n\n" +
            "Будут отправлены файлы с вашего компьютера (с локального сервера).",
        )
      ) {
        return;
      }
    } else if (
      !confirm(
        "Опубликовать сайт из последнего git push?\n\n" +
          "Будут взяты файлы из репозитория GitHub (ветка main), не с диска.\n" +
          "Несохранённые на компьютере правки не попадут — сначала git push или откройте админку на http://127.0.0.1:8080/admin/",
      )
    ) {
      return;
    }

    setBusy(true);
    try {
      let payload;

      if (fromLocal) {
        showToast("Собираем файлы с компьютера…");
        const files = await collectDeployFiles();
        showToast(`Отправка ${files.length} файлов…`);
        payload = {
          source: "browser",
          files,
          message: "Публикация из админки (локально)",
        };
      } else {
        showToast("Берём файлы из GitHub (main)…");
        payload = {
          source: "repository",
          message: "Публикация из админки (из репозитория)",
        };
      }

      const { data, error } = await supabase.functions.invoke("publish-site", {
        body: payload,
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
