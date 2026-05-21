# Supabase — antonovka.studio

## 1. Создайте проект

1. [supabase.com](https://supabase.com) → New project  
2. Запомните **Project URL** и **anon public** key (Settings → API)

## 2. SQL

В **SQL Editor** по порядку:

1. `schema.sql` — таблицы, storage, RLS  
2. `migrate-add-status-typology-description.sql` — **если проект уже был создан раньше** (добавляет статус, типологию, описание)  
3. `seed.sql` — 16 проектов и галереи (только при первой заливке)  

## 3. Фото в Storage

1. Storage → bucket **project-images** (создаётся из `schema.sql`)  
2. Создайте папку `legacy`  
3. Загрузите из `assets/images/` файлы:
   - `project-01.jpg` … `project-08.jpg`
   - `project-09.png`, `project-10.png`  

Пути в БД: `legacy/project-01.jpg` и т.д.

## 4. Ключи на сайте

Project URL уже указан в `js/supabase-config.js`:

`https://hnrjxjeuxtmqdfowwkec.supabase.co`

В `js/supabase-config.js` укажите **publishable** key (`sb_publishable_…`) или **anon public** (`eyJ…`).

**Не вставляйте** `sb_secret_…` в сайт — только для сервера.

Не используйте URL вида `…/rest/v1/` — это адрес API, не настройка сайта.

## Таблицы

| Таблица | Назначение |
|---------|------------|
| `projects` | Название, город, год, статус, типология, описание, обложка, порядок, `published` |
| `project_images` | Фото галереи (`storage_path`, `sort_order`) |

Bucket **project-images** — все изображения проектов.

## Поведение сайта

- Если `supabase-config.js` настроен → проекты с Supabase  
- Иначе → fallback на `js/projects.js` + локальные `assets/images/`

## Админка

RLS уже разрешает `authenticated` полный доступ к таблицам и загрузку в Storage.

Публикация HTML/CSS/JS на GitHub Pages из админки: см. **[DEPLOY.md](./DEPLOY.md)** (Edge Function `publish-site`).
