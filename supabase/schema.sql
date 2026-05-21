-- Antonovka.studio — схема Supabase
-- Выполните целиком в SQL Editor (Dashboard → SQL → New query)

-- ---------------------------------------------------------------------------
-- Таблицы
-- ---------------------------------------------------------------------------

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  city text not null,
  year text not null,
  status text not null default 'Концепция',
  typology text not null default 'Общественное здание',
  description text,
  cover_path text not null,
  sort_order int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  storage_path text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists project_images_project_id_idx
  on public.project_images (project_id);

create index if not exists projects_sort_order_idx
  on public.projects (sort_order);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_set_updated_at on public.projects;

create trigger projects_set_updated_at
  before update on public.projects
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Storage: bucket project-images (публичное чтение для сайта)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-images',
  'project-images',
  true,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.projects enable row level security;
alter table public.project_images enable row level security;

drop policy if exists "Public read published projects" on public.projects;
create policy "Public read published projects"
  on public.projects
  for select
  to anon, authenticated
  using (published = true);

drop policy if exists "Authenticated manage projects" on public.projects;
create policy "Authenticated manage projects"
  on public.projects
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Public read images of published projects" on public.project_images;
create policy "Public read images of published projects"
  on public.project_images
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.published = true
    )
  );

drop policy if exists "Authenticated manage project images" on public.project_images;
create policy "Authenticated manage project images"
  on public.project_images
  for all
  to authenticated
  using (true)
  with check (true);

-- Storage policies
drop policy if exists "Public read project images" on storage.objects;
create policy "Public read project images"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'project-images');

drop policy if exists "Authenticated upload project images" on storage.objects;
create policy "Authenticated upload project images"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'project-images');

drop policy if exists "Authenticated update project images" on storage.objects;
create policy "Authenticated update project images"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'project-images')
  with check (bucket_id = 'project-images');

drop policy if exists "Authenticated delete project images" on storage.objects;
create policy "Authenticated delete project images"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'project-images');
