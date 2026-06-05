-- Миграция путей к картинкам: Supabase Storage → GitHub Pages (assets/images/)
--
-- Запускать ПОСЛЕ того как файлы уже скопированы в репо (git push).
--
-- Что делает:
--   1. Пути legacy/project-XX.jpg → assets/images/project-XX.jpg
--      (файлы уже лежат в assets/images/ в репо)
--   2. Пути projects/{id}/... → assets/images/projects/{id}/...
--      (файлы нужно предварительно скачать из Supabase Storage и загрузить в репо)

-- 1. Обложки проектов: legacy-пути
update public.projects
set cover_path = 'assets/images/' || replace(cover_path, 'legacy/', '')
where cover_path like 'legacy/%';

-- 2. Галереи: legacy-пути
update public.project_images
set storage_path = 'assets/images/' || replace(storage_path, 'legacy/', '')
where storage_path like 'legacy/%';

-- 3. Обложки: пути вида projects/{id}/...  (загружены через старую админку)
update public.projects
set cover_path = 'assets/images/' || cover_path
where cover_path like 'projects/%';

-- 4. Галереи: пути вида projects/{id}/...
update public.project_images
set storage_path = 'assets/images/' || storage_path
where storage_path like 'projects/%';

-- 5. Фото персон: site/about/...
-- (обновляется через поле content в site_sections — править вручную в Supabase Dashboard
--  или через admin-panel после повторной загрузки фото)
