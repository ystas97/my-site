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
2. Выбрать проект слева или **+ Новый проект**
3. Заполнить поля, загрузить обложку и фото галереи
4. **Сохранить** — данные и файлы в Supabase (черновик, если снята галочка «Опубликован»)
5. **Опубликовать** — сохранить и показать на главном сайте

На сайте отображаются только проекты с `published = true`.

## 4. Фото

Файлы попадают в Storage `project-images`:

- обложка: `projects/{id}/cover.jpg`
- галерея: `projects/{id}/gallery/…`

Пути записываются в `projects.cover_path` и `project_images.storage_path`.
