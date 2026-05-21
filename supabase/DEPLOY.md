# Публикация сайта из админки (Edge Function)

Кнопка **«Опубликовать сайт»** вызывает Edge Function `publish-site`: она создаёт commit в GitHub, GitHub Pages обновляется за 1–2 минуты.

## 1. Токен GitHub

1. GitHub → **Settings** → **Developer settings** → **Fine-grained tokens** → **Generate**
2. Repository: `ystas97/my-site`
3. Permissions: **Contents** — Read and write, **Metadata** — Read
4. Скопируйте токен (показывается один раз)

## 2. Секреты в Supabase

Dashboard → **Project Settings** → **Edge Functions** → **Secrets** (или CLI):

| Secret | Значение |
|--------|----------|
| `GITHUB_PAT` | токен GitHub |
| `GITHUB_OWNER` | `ystas97` (опционально) |
| `GITHUB_REPO` | `my-site` (опционально) |
| `GITHUB_BRANCH` | `main` (опционально) |
| `ADMIN_EMAIL` | email админа, например `ystas97@gmail.com` |
| `SITE_URL` | `https://ystas97.github.io/my-site/` (опционально) |

`SUPABASE_URL` и `SUPABASE_ANON_KEY` подставляются автоматически.

## 3. Деплой функции (один раз)

Установите [Supabase CLI](https://supabase.com/docs/guides/cli), войдите в аккаунт:

```bash
cd /Users/allogalochka/my-site
supabase login
supabase link --project-ref hnrjxjeuxtmqdfowwkec
supabase secrets set GITHUB_PAT="ghp_..." ADMIN_EMAIL="ystas97@gmail.com"
supabase functions deploy publish-site --no-verify-jwt=false
```

## 4. Как пользоваться

1. Запустите локальный сервер: `python3 -m http.server 8080`
2. Откройте админку: `http://127.0.0.1:8080/admin/`
3. Войдите → **Опубликовать сайт**

Файлы берутся **с того сервера, с которого открыта админка** (список в `deploy/manifest.json`).

## Важно

- **`js/supabase-config.js`** при публикации подхватывается с локального сервера (в git не коммитится, но на Pages **обязателен**). Без него сайт показывает старый `projects.js`, а не Supabase.
- В config только **publishable / anon** ключ — это нормально для статического сайта.
- **Проекты и фото** в Supabase обновляются кнопкой **«Сохранить»** в карточке проекта, без публикации на GitHub.
- Если функция не задеплоена, кнопка покажет ошибку в toast.
