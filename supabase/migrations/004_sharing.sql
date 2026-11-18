-- =====================================================================
-- VideoMind AI — Class links for courses (run once in Supabase → SQL Editor)
-- Lessons already have is_public / share_slug (schema.sql); this adds them to courses.
-- =====================================================================

alter table public.courses add column if not exists is_public  boolean not null default false;
alter table public.courses add column if not exists share_slug text unique;

drop policy if exists "public courses readable" on public.courses;
create policy "public courses readable" on public.courses
  for select using (is_public = true);
