-- =====================================================================
-- VideoMind AI — Learning profiles (run once in Supabase → SQL Editor)
-- Students choose a level (beginner / intermediate / advanced) at sign-up;
-- teachers choose "teacher". Every AI feature adapts to it.
-- =====================================================================

alter table public.profiles add column if not exists level text not null default 'intermediate'
  check (level in ('beginner', 'intermediate', 'advanced'));
alter table public.profiles add column if not exists onboarded boolean not null default false;

-- Sign-up sends role and level in the user metadata; copy them into the profile
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r text := new.raw_user_meta_data->>'role';
  l text := new.raw_user_meta_data->>'level';
begin
  insert into public.profiles (id, full_name, avatar_url, role, level, onboarded)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    case when r in ('student', 'teacher') then r::user_role else 'student'::user_role end,
    case when l in ('beginner', 'intermediate', 'advanced') then l else 'intermediate' end,
    coalesce(r in ('student', 'teacher'), false)
  );
  return new;
end; $$;

-- Summaries rewritten for a learner's level are cached next to the study materials
alter type material_type add value if not exists 'summary';
