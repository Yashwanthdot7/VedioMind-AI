-- =====================================================================
-- VideoMind AI — Quiz analytics (run once in Supabase → SQL Editor)
-- Stores every quiz / test a signed-in user completes.
-- =====================================================================

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
