# Админ-панель

Страница: **/admin.html** (локально или на GitHub Pages).

## 0. URL для локальной разработки (важно для входа)

Auth → [URL Configuration](https://supabase.com/dashboard/project/hnrjxjeuxtmqdfowwkec/auth/url-configuration):

- **Site URL:** `http://127.0.0.1:8080`
- **Redirect URLs:** `http://127.0.0.1:8080/**`

Без этого сессия после входа может не сохраняться.

## 1. Пользователь для входа

1. [Supabase Dashboard](https://supabase.com/dashboard/project/hnrjxjeuxtmqdfowwkec/auth/users)
2. **Add user** → email + пароль
3. Обязательно включите **Auto Confirm User** (галочка при создании)
4. Или отключите подтверждение: Auth → Providers → Email → **Confirm email** = off

## 2. Политики (если черновики не видны)

В SQL Editor выполните `policies-admin.sql`.

## 3. Как пользоваться

1. Войти по email и паролю
2. Вкладки в шапке: **Проекты** | **О бюро**
3. **Проекты:** выбрать слева или **+ Новый проект**, обложка и галерея, **Сохранить**
4. **О бюро:** слева **О бюро** или **Контакты**, править текст и **Сохранить** — сразу на сайте

На сайте отображаются только проекты с `published = true`.

Изменения HTML/CSS/JS на GitHub Pages — через **`git push`** в репозиторий `ystas97/my-site`.

### Разделы «О бюро» и «Контакты»

Один раз в SQL Editor выполните `migrate-site-sections.sql` (таблица `site_sections` и начальные тексты).

## 4. Фото

Файлы попадают в Storage `project-images`:

- обложка: `projects/{id}/cover.jpg`
- галерея: `projects/{id}/gallery/…`

Пути записываются в `projects.cover_path` и `project_images.storage_path`.
