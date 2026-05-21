-- Добавить поля, если проект создавали до обновления schema.sql
-- Выполните в SQL Editor один раз (Dashboard → SQL → New query)

alter table public.projects
  add column if not exists status text not null default 'Концепция';

alter table public.projects
  add column if not exists typology text not null default 'Общественное здание';

alter table public.projects
  add column if not exists description text;

-- Обновить кэш API после изменения схемы
notify pgrst, 'reload schema';
