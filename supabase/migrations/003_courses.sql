-- =====================================================================
-- VideoMind AI — Courses (run once in Supabase → SQL Editor)
-- A course is an ordered list of modules; each module is a lesson in
-- generated_videos. Also: a private Storage bucket for lesson files.
-- =====================================================================

create table if not exists public.courses (
  id          uuid primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  language    text not null default 'en',
  audience    text not null default 'student' check (audience in ('kids', 'student', 'teacher')),
  status      text not null default 'queued' check (status in ('queued', 'outlining', 'building', 'done', 'failed')),
  modules     jsonb not null default '[]',   -- [{index, title, goal, keyPoints, lessonId}]
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists courses_user_created on public.courses (user_id, created_at desc);

drop trigger if exists courses_touch on public.courses;
create trigger courses_touch
  before update on public.courses
  for each row execute function public.touch_updated_at();

alter table public.courses enable row level security;

drop policy if exists "own courses" on public.courses;
create policy "own courses" on public.courses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Lesson files (narration, pictures) survive server restarts on free hosts.
-- Private: only the backend (secret key) reads and writes it.
insert into storage.buckets (id, name, public)
values ('lessons', 'lessons', false)
on conflict (id) do nothing;
