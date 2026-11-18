-- =====================================================================
-- VideoMind AI — Supabase schema
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- =====================================================================

-- ---------- Enums ----------
create type user_role      as enum ('kid', 'student', 'teacher', 'other');
create type source_type    as enum ('youtube', 'upload', 'text');
create type material_type  as enum ('notes', 'quiz', 'flashcards', 'mindmap');
create type job_status     as enum ('queued', 'scripting', 'images', 'voice', 'rendering', 'done', 'failed');

-- ---------- 1. Profiles (one row per signed-up user) ----------
create table public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  full_name          text,
  avatar_url         text,
  role               user_role not null default 'student',
  preferred_language text not null default 'en',      -- e.g. 'en', 'hi', 'kn', 'ta'
  created_at         timestamptz not null default now()
);

-- Auto-create a profile when someone signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id,
          new.raw_user_meta_data->>'full_name',
          new.raw_user_meta_data->>'avatar_url');
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 2. Video analyses (shared cache — same video+language processed once) ----------
create table public.video_analyses (
  id             uuid primary key default gen_random_uuid(),
  source         source_type not null default 'youtube',
  youtube_id     text,                     -- null for uploads
  storage_path   text,                     -- for uploaded files (bucket: uploads)
  language       text not null default 'en',
  title          text not null,
  author         text,
  duration_sec   int,
  thumbnail_url  text,
  transcript     jsonb not null,           -- [{text, timestamp, seconds}]
  summary        text,
  key_takeaways  jsonb,                    -- ["...", "..."]
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (youtube_id, language)
);

-- ---------- 3. User library (which user saved which analysis) ----------
create table public.user_library (
  user_id      uuid not null references auth.users(id) on delete cascade,
  analysis_id  uuid not null references public.video_analyses(id) on delete cascade,
  is_favorite  boolean not null default false,
  added_at     timestamptz not null default now(),
  primary key (user_id, analysis_id)
);

-- ---------- 4. Chat ----------
create table public.chat_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  analysis_id  uuid not null references public.video_analyses(id) on delete cascade,
  title        text,
  created_at   timestamptz not null default now()
);

create table public.chat_messages (
  id          bigint generated always as identity primary key,
  session_id  uuid not null references public.chat_sessions(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  created_at  timestamptz not null default now()
);
create index on public.chat_messages (session_id, created_at);

-- ---------- 5. Study materials (notes / quiz / flashcards / mind map) ----------
create table public.study_materials (
  id           uuid primary key default gen_random_uuid(),
  analysis_id  uuid not null references public.video_analyses(id) on delete cascade,
  type         material_type not null,
  language     text not null default 'en',
  content      jsonb not null,
  created_at   timestamptz not null default now(),
  unique (analysis_id, type, language)
);

-- ---------- 6. Generated videos (text → video jobs) ----------
create table public.generated_videos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  source        source_type not null default 'text',
  analysis_id   uuid references public.video_analyses(id) on delete set null, -- if made from a YouTube video
  input_text    text,
  audience      user_role not null default 'student',
  language      text not null default 'en',
  status        job_status not null default 'queued',
  progress      int not null default 0 check (progress between 0 and 100),
  script        jsonb,                   -- [{scene, narration, image_prompt, on_screen_text}]
  quiz          jsonb,
  video_path    text,                    -- bucket: generated-videos
  subtitle_path text,                    -- .srt in same bucket
  thumbnail_path text,
  duration_sec  int,
  error         text,
  is_public     boolean not null default false,   -- teacher share link
  share_slug    text unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.generated_videos (user_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger generated_videos_touch
  before update on public.generated_videos
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- Row Level Security — users only see their own data.
-- The backend uses the SERVICE ROLE key, which bypasses RLS for writes
-- (caching analyses, updating job progress).
-- =====================================================================
alter table public.profiles         enable row level security;
alter table public.video_analyses   enable row level security;
alter table public.user_library     enable row level security;
alter table public.chat_sessions    enable row level security;
alter table public.chat_messages    enable row level security;
alter table public.study_materials  enable row level security;
alter table public.generated_videos enable row level security;

-- Profiles
create policy "own profile read"   on public.profiles for select using (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

-- Analyses & study materials: readable by any signed-in user (shared cache)
create policy "analyses readable"  on public.video_analyses  for select to authenticated using (true);
create policy "materials readable" on public.study_materials for select to authenticated using (true);

-- Library
create policy "own library" on public.user_library
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Chat
create policy "own sessions" on public.chat_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own messages" on public.chat_messages
  for all using (exists (select 1 from public.chat_sessions s
                         where s.id = session_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.chat_sessions s
                      where s.id = session_id and s.user_id = auth.uid()));

-- Generated videos: owner full access; anyone can view public (shared) ones
create policy "own generated videos" on public.generated_videos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "public shared videos" on public.generated_videos
  for select using (is_public = true);

-- Realtime: frontend subscribes to job progress instead of polling
alter publication supabase_realtime add table public.generated_videos;


create table if not exists public.quiz_attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  source        text not null check (source in ('study', 'lesson')),
  analysis_id   uuid,            -- no FK: lessons/videos made before signing in aren't in the DB
  lesson_id     uuid,
  video_id      text,
  title         text not null,
  kind          text not null check (kind in ('quiz', 'quick', 'test')),
  level         text,
  language      text not null default 'en',
  total         int  not null check (total between 1 and 50),
  correct       int  not null check (correct between 0 and total),
  score_pct     int  not null check (score_pct between 0 and 100),
  grade         text not null,
  duration_sec  int,
  answers       jsonb not null default '[]',   -- [{question, chosen, answer, correct, difficulty}]
  created_at    timestamptz not null default now()
);

create index if not exists quiz_attempts_user_created on public.quiz_attempts (user_id, created_at desc);

alter table public.quiz_attempts enable row level security;

drop policy if exists "own quiz attempts" on public.quiz_attempts;
create policy "own quiz attempts" on public.quiz_attempts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =====================================================================
-- Storage buckets (private; files served with signed URLs)
-- Path convention: <user_id>/<file>
-- =====================================================================
insert into storage.buckets (id, name, public) values
  ('uploads', 'uploads', false),
  ('generated-videos', 'generated-videos', false)
on conflict (id) do nothing;

create policy "users upload to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users read own files" on storage.objects
  for select to authenticated
  using (bucket_id in ('uploads', 'generated-videos')
         and (storage.foldername(name))[1] = auth.uid()::text);


-- ===== from migrations/003_courses.sql =====
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
