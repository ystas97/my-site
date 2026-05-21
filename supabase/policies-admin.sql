-- Дополнительные политики для админки (если редактор не видит черновики)
-- Выполните в SQL Editor при необходимости

drop policy if exists "Authenticated read all projects" on public.projects;
create policy "Authenticated read all projects"
  on public.projects
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated read all project images" on public.project_images;
create policy "Authenticated read all project images"
  on public.project_images
  for select
  to authenticated
  using (true);
