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

    const allowedEmail = Deno.env.get("ADMIN_EMAIL");
    if (allowedEmail && user.email !== allowedEmail) {
      return json({ error: "Нет прав на публикацию сайта" }, 403);
    }

    const body = (await req.json()) as { files?: DeployFile[]; message?: string };
    const files = body.files ?? [];
    if (!files.length) {
      return json({ error: "Нет файлов для публикации" }, 400);
    }

    const commitMessage =
      body.message?.trim() || `Публикация из админки (${user.email ?? "admin"})`;

    const result = await publishToGitHub(files, commitMessage);
    return json({ ok: true, ...result });
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

async function publishToGitHub(files: DeployFile[], message: string) {
  const token = Deno.env.get("GITHUB_PAT");
  if (!token) {
    throw new Error(
      "Секрет GITHUB_PAT не настроен (Supabase → Edge Functions → Secrets)",
    );
  }

  const owner = Deno.env.get("GITHUB_OWNER") ?? "ystas97";
  const repo = Deno.env.get("GITHUB_REPO") ?? "my-site";
  const branch = Deno.env.get("GITHUB_BRANCH") ?? "main";

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
    siteUrl: Deno.env.get("SITE_URL") ?? "https://ystas97.github.io/my-site/",
  };
}
