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
| `ADMIN_EMAIL` | опционально, не используется (публикация — любой вошедший в админку) |
| `SITE_URL` | `https://antonovka.studio/` (текст в toast после публикации) |

`SUPABASE_URL` и `SUPABASE_ANON_KEY` подставляются автоматически.

## 3. Деплой функции (один раз)

Установите [Supabase CLI](https://supabase.com/docs/guides/cli), войдите в аккаунт:

```bash
cd /Users/allogalochka/my-site
supabase login
supabase link --project-ref hnrjxjeuxtmqdfowwkec
supabase secrets set GITHUB_PAT="ghp_..."
supabase functions deploy publish-site --no-verify-jwt=false
```

## 4. Как пользоваться

1. Запустите локальный сервер: `python3 -m http.server 8080`
2. Откройте админку: `http://127.0.0.1:8080/admin/`
3. Войдите → **Опубликовать сайт**

## Откуда берутся файлы

| Где открыта админка | Что делает «Опубликовать» |
|---------------------|---------------------------|
| **http://127.0.0.1:8080/admin/** (локальный сервер) | Файлы с диска — как «ручной push», список в `deploy/manifest.json` |
| **https://antonovka.studio/admin/** | Файлы из **последнего git push** в GitHub (ветка main) |

**Изменения HTML/CSS/JS на компьютере** без git push на продакшене кнопкой **не попадут** — только `git push` или публикация с localhost.

После **git push** GitHub Pages обычно обновляется сам за 1–2 мин; кнопка нужна, если деплой «застрял» или публикуете с localhost без git.

## Важно

- **`js/supabase-config.js`** в git не коммитится (секреты). При публикации с localhost подхватывается с диска. В репозитории файл должен уже быть (один раз запушен), иначе режим «из GitHub» выдаст ошибку.
- **Проекты и фото** — только Supabase (кнопка «Сохранить»), не GitHub.
- Список файлов для деплоя: `deploy/manifest.json` — новые файлы добавляйте туда и делайте push.
