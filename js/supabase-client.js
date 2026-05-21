(function () {
  const BUCKET = "project-images";

  function isConfigured() {
    const url = window.SUPABASE_URL?.trim();
    const key = window.SUPABASE_ANON_KEY?.trim();
    if (!url || !key) return false;
    if (url.includes("YOUR_PROJECT") || key.includes("YOUR_ANON")) return false;
    return true;
  }

  function getClient() {
    if (!isConfigured()) return null;
    if (!window.supabase?.createClient) {
      console.error("Supabase JS SDK не загружен");
      return null;
    }
    if (!window.__supabaseClient) {
      window.__supabaseClient = window.supabase.createClient(
        window.SUPABASE_URL.trim(),
        window.SUPABASE_ANON_KEY.trim(),
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
          },
          global: {
            fetch: (url, options = {}) =>
              fetch(url, { ...options, cache: "no-store" }),
          },
        }
      );
    }
    return window.__supabaseClient;
  }

  function storagePublicUrl(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    const client = getClient();
    if (!client) return "";
    const { data } = client.storage.from(BUCKET).getPublicUrl(path.replace(/^\//, ""));
    return data.publicUrl;
  }

  function normalizeRow(row) {
    const images = (row.project_images || [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((img) => storagePublicUrl(img.storage_path))
      .filter(Boolean);

    const coverUrl = storagePublicUrl(row.cover_path);
    const gallery = images.length ? images : coverUrl ? [coverUrl] : [];

    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      city: row.city,
      year: row.year,
      status: row.status || "Концепция",
      typology: row.typology || "Общественное здание",
      description: row.description || "",
      image: coverUrl,
      gallery,
    };
  }

  async function fetchSiteSections() {
    const client = getClient();
    if (!client) throw new Error("Supabase не настроен (js/supabase-config.js)");

    const { data, error } = await client.from("site_sections").select("slug, content, updated_at");
    if (error) throw error;
    return data || [];
  }

  async function upsertSiteSection(slug, content) {
    const client = getClient();
    if (!client) throw new Error("Supabase не настроен (js/supabase-config.js)");

    const { data, error } = await client
      .from("site_sections")
      .upsert({ slug, content }, { onConflict: "slug" })
      .select("slug, content, updated_at")
      .single();

    if (error) throw error;
    return data;
  }

  async function fetchPublishedProjects() {
    const client = getClient();
    if (!client) {
      throw new Error("Supabase не настроен (js/supabase-config.js)");
    }

    const { data, error } = await client
      .from("projects")
      .select(
        `
        id,
        slug,
        title,
        city,
        year,
        status,
        typology,
        description,
        cover_path,
        sort_order,
        project_images (
          storage_path,
          sort_order
        )
      `
      )
      .eq("published", true)
      .order("sort_order", { ascending: true });

    if (error) throw error;
    return (data || []).map(normalizeRow);
  }

  window.SupabasePortfolio = {
    BUCKET,
    isConfigured,
    getClient,
    storagePublicUrl,
    fetchSiteSections,
    upsertSiteSection,
    fetchPublishedProjects,
  };
})();
