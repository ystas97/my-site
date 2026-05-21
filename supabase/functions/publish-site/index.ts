import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DeployFile {
  path: string;
  content: string;
  encoding?: "utf-8" | "base64";
}

interface PublishBody {
  source?: "browser" | "repository";
  files?: DeployFile[];
  message?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("SUPABASE_URL / SUPABASE_ANON_KEY не заданы");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Требуется вход в админку" }, 401);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return json({ error: "Сессия недействительна. Войдите снова." }, 401);
    }

    const body = (await req.json()) as PublishBody;
    const commitMessage =
      body.message?.trim() || `Публикация из админки (${user.email ?? "admin"})`;

    const owner = Deno.env.get("GITHUB_OWNER") ?? "ystas97";
    const repo = Deno.env.get("GITHUB_REPO") ?? "my-site";
    const branch = Deno.env.get("GITHUB_BRANCH") ?? "main";
    const token = Deno.env.get("GITHUB_PAT");
    if (!token) {
      throw new Error(
        "Секрет GITHUB_PAT не настроен (Supabase → Edge Functions → Secrets)",
      );
    }

    let files: DeployFile[] = [];
    let source = body.source ?? "browser";

    if (source === "repository") {
      files = await loadFilesFromRepository(token, owner, repo, branch);
    } else {
      files = body.files ?? [];
      if (!files.length) {
        return json({ error: "Нет файлов для публикации" }, 400);
      }
    }

    const result = await publishToGitHub(token, owner, repo, branch, files, commitMessage);
    return json({ ok: true, source, fileCount: files.length, ...result });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Ошибка публикации";
    return json({ error: message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isBinaryPath(path: string) {
  return /\.(png|jpe?g|gif|webp|ico)$/i.test(path);
}

async function github(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

function decodeGitHubContent(base64Content: string, asBinary: boolean): string {
  const raw = base64Content.replace(/\n/g, "");
  if (asBinary) return raw;
  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

async function fetchRepoFile(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  path: string,
): Promise<DeployFile> {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const res = await github(
    token,
    `/repos/${owner}/${repo}/contents/${encoded}?ref=${encodeURIComponent(branch)}`,
  );

  if (!res.ok) {
    throw new Error(`Файл ${path} не найден в GitHub (${res.status})`);
  }

  const data = await res.json();
  if (Array.isArray(data) || !data.content) {
    throw new Error(`Путь ${path} — не файл в репозитории`);
  }

  const binary = isBinaryPath(path);
  return {
    path,
    content: decodeGitHubContent(data.content as string, binary),
    encoding: binary ? "base64" : "utf-8",
  };
}

async function loadManifestPaths(
  token: string,
  owner: string,
  repo: string,
  branch: string,
): Promise<string[]> {
  const manifestFile = await fetchRepoFile(
    token,
    owner,
    repo,
    branch,
    "deploy/manifest.json",
  );
  const manifest = JSON.parse(manifestFile.content) as { paths?: string[] };
  if (!Array.isArray(manifest.paths) || !manifest.paths.length) {
    throw new Error("deploy/manifest.json в репозитории пуст или неверен");
  }
  return manifest.paths;
}

async function loadFilesFromRepository(
  token: string,
  owner: string,
  repo: string,
  branch: string,
): Promise<DeployFile[]> {
  const paths = await loadManifestPaths(token, owner, repo, branch);
  const files: DeployFile[] = [];

  for (const path of paths) {
    files.push(await fetchRepoFile(token, owner, repo, branch, path));
  }

  const hasConfig = files.some((f) => f.path === "js/supabase-config.js");
  if (!hasConfig) {
    try {
      files.push(
        await fetchRepoFile(token, owner, repo, branch, "js/supabase-config.js"),
      );
    } catch {
      throw new Error(
        "В репозитории нет js/supabase-config.js. Сделайте git push с этим файлом или публикуйте с localhost.",
      );
    }
  }

  return files;
}

async function publishToGitHub(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  files: DeployFile[],
  message: string,
) {
  const refRes = await github(
    token,
    `/repos/${owner}/${repo}/git/ref/heads/${branch}`,
  );
  if (!refRes.ok) {
    throw new Error(`GitHub (ветка): ${await refRes.text()}`);
  }
  const refData = await refRes.json();
  const parentSha = refData.object.sha as string;

  const commitRes = await github(
    token,
    `/repos/${owner}/${repo}/git/commits/${parentSha}`,
  );
  if (!commitRes.ok) {
    throw new Error(`GitHub (commit): ${await commitRes.text()}`);
  }
  const parentCommit = await commitRes.json();
  const baseTreeSha = parentCommit.tree.sha as string;

  const treeEntries: { path: string; mode: string; type: string; sha: string }[] = [];

  for (const file of files) {
    const encoding =
      file.encoding ?? (isBinaryPath(file.path) ? "base64" : "utf-8");

    const blobRes = await github(token, `/repos/${owner}/${repo}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({ content: file.content, encoding }),
    });

    if (!blobRes.ok) {
      throw new Error(`GitHub (файл ${file.path}): ${await blobRes.text()}`);
    }

    const blob = await blobRes.json();
    treeEntries.push({
      path: file.path.replace(/^\//, ""),
      mode: "100644",
      type: "blob",
      sha: blob.sha,
    });
  }

  const treeRes = await github(token, `/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries }),
  });
  if (!treeRes.ok) {
    throw new Error(`GitHub (дерево): ${await treeRes.text()}`);
  }
  const tree = await treeRes.json();

  const newCommitRes = await github(token, `/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message,
      tree: tree.sha,
      parents: [parentSha],
    }),
  });
  if (!newCommitRes.ok) {
    throw new Error(`GitHub (новый commit): ${await newCommitRes.text()}`);
  }
  const newCommit = await newCommitRes.json();

  const updateRefRes = await github(
    token,
    `/repos/${owner}/${repo}/git/refs/heads/${branch}`,
    {
      method: "PATCH",
      body: JSON.stringify({ sha: newCommit.sha }),
    },
  );
  if (!updateRefRes.ok) {
    throw new Error(`GitHub (обновление ветки): ${await updateRefRes.text()}`);
  }

  return {
    commit: newCommit.sha as string,
    commitUrl: `https://github.com/${owner}/${repo}/commit/${newCommit.sha}`,
    siteUrl: Deno.env.get("SITE_URL") ?? "https://antonovka.studio/",
  };
}
