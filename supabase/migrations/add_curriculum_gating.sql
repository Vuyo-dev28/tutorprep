-- Add curriculum columns and enforce curriculum-gated reads (CAPS vs IEB)

-- 1) Columns
alter table public.profiles
  add column if not exists curriculum text not null default 'CAPS'
  check (curriculum in ('CAPS', 'IEB'));

alter table public.topics
  add column if not exists curriculum text not null default 'CAPS'
  check (curriculum in ('CAPS', 'IEB'));

-- 2) Backfill (safe no-op with defaults, but explicit for older rows)
update public.profiles
set curriculum = 'CAPS'
where curriculum is null;

update public.topics
set curriculum = 'CAPS'
where curriculum is null;

-- 3) Tighten readable policies (remove public read of content tables)
drop policy if exists "Topics are readable" on public.topics;
drop policy if exists "Lessons are readable" on public.lessons;
drop policy if exists "Questions are readable" on public.questions;

create policy "Topics are readable by curriculum"
  on public.topics
  for select
  using (
    auth.uid() is not null
    and curriculum = (
      select p.curriculum from public.profiles p
      where p.id = auth.uid()
    )
  );

create policy "Lessons are readable by curriculum"
  on public.lessons
  for select
  using (
    auth.uid() is not null
    and exists (
      select 1
      from public.topics t
      join public.profiles p on p.id = auth.uid()
      where t.id = lessons.topic_id
        and t.curriculum = p.curriculum
    )
  );

create policy "Questions are readable by curriculum"
  on public.questions
  for select
  using (
    auth.uid() is not null
    and exists (
      select 1
      from public.topics t
      join public.profiles p on p.id = auth.uid()
      where t.id = questions.topic_id
        and t.curriculum = p.curriculum
    )
  );

-- 4) Ensure new users get curriculum in profiles from auth metadata
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, grade, school_name, curriculum)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    nullif(new.raw_user_meta_data->>'grade', ''),
    nullif(new.raw_user_meta_data->>'school_name', ''),
    coalesce(nullif(new.raw_user_meta_data->>'curriculum', ''), 'CAPS')
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    grade = excluded.grade,
    school_name = excluded.school_name,
    curriculum = excluded.curriculum,
    updated_at = now();
  return new;
end;
$$;

