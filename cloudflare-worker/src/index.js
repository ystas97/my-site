const GITHUB_OWNER = "ystas97";
const GITHUB_REPO = "my-site";
const GITHUB_BRANCH = "main";
const GITHUB_API = "https://api.github.com";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// ── helpers ──────────────────────────────────────────────────────────────────

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

async function ghRequest(env, method, path, body) {
  return fetch(`${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "antonovka-upload-worker",
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function ghGet(env, path) {
  const res = await ghRequest(env, "GET", path);
  if (!res.ok) return null;
  return res.json();
}

async function ghPut(env, path, content, message) {
  const existing = await ghGet(env, path);
  const sha = existing?.sha ?? null;
  const res = await ghRequest(env, "PUT", path, {
    message,
    content: btoa(unescape(encodeURIComponent(content))),
    branch: GITHUB_BRANCH,
    ...(sha ? { sha } : {}),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub PUT failed: ${err}`);
  }
  return res.json();
}

function isValidImagePath(path) {
  return (
    typeof path === "string" &&
    path.startsWith("assets/images/") &&
    !path.includes("..") &&
    path.length < 512
  );
}

// ── auth ─────────────────────────────────────────────────────────────────────

async function sha256hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function makeToken(env) {
  const expires = Date.now() + 24 * 60 * 60 * 1000;
  const payload = `${expires}`;
  const sig = await sha256hex(payload + env.WORKER_SECRET);
  return btoa(`${payload}.${sig}`);
}

async function verifyToken(env, token) {
  if (!token) return false;
  try {
    const decoded = atob(token);
    const [payload, sig] = decoded.split(".");
    const expires = Number(payload);
    if (Date.now() > expires) return false;
    const expected = await sha256hex(payload + env.WORKER_SECRET);
    return sig === expected;
  } catch {
    return false;
  }
}

function bearerToken(request) {
  const auth = request.headers.get("Authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : null;
}

async function handleLogin(request, env) {
  const { password } = await request.json().catch(() => ({}));
  if (!password || !env.ADMIN_PASSWORD) return json({ error: "unauthorized" }, 401);
  const hash = await sha256hex(password);
  const expected = await sha256hex(env.ADMIN_PASSWORD);
  if (hash !== expected) return json({ error: "unauthorized" }, 401);
  const token = await makeToken(env);
  return json({ token });
}

// ── image upload / delete ────────────────────────────────────────────────────

async function handleUpload(request, env) {
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return json({ error: "invalid form data" }, 400);
  }
  const file = formData.get("file");
  const path = formData.get("path");
  if (!file || !path) return json({ error: "file and path are required" }, 400);
  if (!isValidImagePath(path)) return json({ error: "invalid path" }, 400);

  const buffer = await file.arrayBuffer();
  const content = toBase64(buffer);
  const existing = await ghGet(env, path);
  const sha = existing?.sha ?? null;

  const res = await ghRequest(env, "PUT", path, {
    message: `upload: ${path}`,
    content,
    branch: GITHUB_BRANCH,
    ...(sha ? { sha } : {}),
  });
  if (!res.ok) {
    const err = await res.text();
    return json({ error: err }, 502);
  }
  return json({ ok: true, path });
}

async function handleDelete(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const paths = Array.isArray(body.paths) ? body.paths.filter(isValidImagePath) : [];
  if (!paths.length) return json({ ok: true });

  await Promise.allSettled(
    paths.map(async (path) => {
      const existing = await ghGet(env, path);
      if (!existing?.sha) return;
      await ghRequest(env, "DELETE", path, {
        message: `delete: ${path}`,
        sha: existing.sha,
        branch: GITHUB_BRANCH,
      });
    }),
  );
  return json({ ok: true });
}

// ── data (JSON files in repo) ─────────────────────────────────────────────────

const DATA_FILES = {
  projects: "data/projects.json",
  sections: "data/site-sections.json",
};

async function handleGetData(key, env) {
  const path = DATA_FILES[key];
  if (!path) return json({ error: "not found" }, 404);
  const file = await ghGet(env, path);
  if (!file) return json({ error: "not found" }, 404);
  const content = atob(file.content.replace(/\n/g, ""));
  return new Response(content, {
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

async function handlePutData(key, request, env) {
  const path = DATA_FILES[key];
  if (!path) return json({ error: "not found" }, 404);
  let body;
  try {
    body = await request.text();
    JSON.parse(body);
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  await ghPut(env, path, body, `update: ${path}`);
  return json({ ok: true });
}

// ── router ───────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const { pathname } = new URL(request.url);
    const method = request.method;

    // Public: login
    if (method === "POST" && pathname === "/auth/login") {
      return handleLogin(request, env);
    }

    // Auth check for all other routes
    const token = bearerToken(request);
    const ok = await verifyToken(env, token);
    if (!ok) return json({ error: "unauthorized" }, 401);

    if (method === "POST" && pathname === "/upload") return handleUpload(request, env);
    if (method === "DELETE" && pathname === "/delete") return handleDelete(request, env);

    // Data CRUD
    const dataMatch = pathname.match(/^\/data\/(\w+)$/);
    if (dataMatch) {
      const key = dataMatch[1];
      if (method === "GET") return handleGetData(key, env);
      if (method === "PUT") return handlePutData(key, request, env);
    }

    return json({ error: "not found" }, 404);
  },
};
