const GITHUB_OWNER = "ystas97";
const GITHUB_REPO = "my-site";
const GITHUB_BRANCH = "main";
const GITHUB_API = "https://api.github.com";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

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

async function getFileSha(env, path) {
  const res = await ghRequest(env, "GET", path);
  if (!res.ok) return null;
  const data = await res.json();
  return data.sha || null;
}

function isValidPath(path) {
  return (
    typeof path === "string" &&
    path.startsWith("assets/images/") &&
    !path.includes("..") &&
    path.length < 512
  );
}

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
  if (!isValidPath(path)) return json({ error: "invalid path" }, 400);

  const buffer = await file.arrayBuffer();
  const content = toBase64(buffer);
  const sha = await getFileSha(env, path);

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

  const paths = Array.isArray(body.paths) ? body.paths.filter(isValidPath) : [];
  if (!paths.length) return json({ ok: true });

  const results = await Promise.allSettled(
    paths.map(async (path) => {
      const sha = await getFileSha(env, path);
      if (!sha) return;
      const res = await ghRequest(env, "DELETE", path, {
        message: `delete: ${path}`,
        sha,
        branch: GITHUB_BRANCH,
      });
      if (!res.ok) throw new Error(`GitHub DELETE failed for ${path}: ${res.status}`);
    }),
  );

  const errors = results
    .filter((r) => r.status === "rejected")
    .map((r) => r.reason?.message || String(r.reason));

  if (errors.length) return json({ ok: false, errors }, 502);
  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const auth = request.headers.get("Authorization") || "";
    if (!env.WORKER_SECRET || auth !== `Bearer ${env.WORKER_SECRET}`) {
      return json({ error: "unauthorized" }, 401);
    }

    const { pathname } = new URL(request.url);

    if (request.method === "POST" && pathname === "/upload") {
      return handleUpload(request, env);
    }
    if (request.method === "DELETE" && pathname === "/delete") {
      return handleDelete(request, env);
    }

    return json({ error: "not found" }, 404);
  },
};
