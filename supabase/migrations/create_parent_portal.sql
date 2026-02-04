-- Create parent_student_links table to link parents to their children
create table if not exists public.parent_student_links (
  id uuid primary key default uuid_generate_v4(),
  parent_email text not null,
  student_id uuid not null references public.profiles(id) on delete cascade,
  access_code text not null unique, -- Unique access code for this parent-student link
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(parent_email, student_id)
);

-- Create index for faster lookups
create index if not exists parent_student_links_parent_email_idx on public.parent_student_links(parent_email);
create index if not exists parent_student_links_access_code_idx on public.parent_student_links(access_code);
create index if not exists parent_student_links_student_id_idx on public.parent_student_links(student_id);

-- Enable RLS
alter table public.parent_student_links enable row level security;

-- Anyone can view parent-student links (needed for access code lookup)
-- But we'll restrict sensitive data access
create policy "Anyone can view parent links for access code lookup"
  on public.parent_student_links
  for select
  using (true);

-- Admins can manage all parent links
create policy "Admins can manage parent links"
  on public.parent_student_links
  for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Create a function to generate unique access codes
create or replace function public.generate_access_code()
returns text
language plpgsql
as $$
declare
  code text;
  exists_check boolean;
begin
  loop
    -- Generate a 6-character alphanumeric code
    code := upper(
      substring(
        md5(random()::text || clock_timestamp()::text)
        from 1 for 6
      )
    );
    
    -- Check if code already exists
    select exists(
      select 1 from public.parent_student_links
      where access_code = code
    ) into exists_check;
    
    -- Exit loop if code is unique
    exit when not exists_check;
  end loop;
  
  return code;
end;
$$;

-- Grant execute permission
grant execute on function public.generate_access_code() to authenticated;

-- Ensure curriculum column exists in profiles table
alter table public.profiles
  add column if not exists curriculum text not null default 'CAPS'
  check (curriculum in ('CAPS', 'IEB'));

-- Create a view for parent portal data (student progress summary)
create or replace view public.parent_student_progress as
select
  psl.id as link_id,
  psl.parent_email,
  psl.access_code,
  psl.student_id,
  p.full_name as student_name,
  p.grade as student_grade,
  coalesce(p.curriculum, 'CAPS') as student_curriculum,
  count(distinct utp.topic_id) filter (where utp.completed = true) as topics_completed,
  count(distinct t.id) as total_topics,
  count(distinct ulp.lesson_id) filter (where ulp.completed = true) as lessons_completed,
  count(distinct l.id) as total_lessons,
  count(distinct qa.id) as quiz_attempts,
  coalesce(avg(qa.percentage), 0) as average_quiz_score,
  sum(ss.minutes) as total_study_minutes,
  max(ss.created_at) as last_study_date,
  -- Calculate streak
  (
    select count(distinct date_trunc('day', created_at))
    from public.study_sessions
    where user_id = psl.student_id
    and created_at >= current_date - interval '30 days'
  ) as study_days_last_30
from public.parent_student_links psl
join public.profiles p on p.id = psl.student_id
left join public.user_topic_progress utp on utp.user_id = psl.student_id
left join public.topics t on t.id = utp.topic_id
left join public.user_lesson_progress ulp on ulp.user_id = psl.student_id
left join public.lessons l on l.id = ulp.lesson_id
left join public.quiz_attempts qa on qa.user_id = psl.student_id
left join public.study_sessions ss on ss.user_id = psl.student_id
where psl.is_active = true
group by psl.id, psl.parent_email, psl.access_code, psl.student_id, p.full_name, p.grade, p.curriculum;

-- Grant access to the view
grant select on public.parent_student_progress to anon, authenticated;

-- Create a function to get struggling areas for a student
create or replace function public.get_student_struggling_areas(student_uuid uuid)
returns table (
  topic_name text,
  subject_name text,
  difficulty text,
  quiz_attempts bigint,
  average_score numeric,
  lowest_score numeric,
  last_attempt_date timestamptz,
  lessons_completed bigint,
  total_lessons bigint,
  completion_rate numeric
)
language plpgsql
security definer
as $$
begin
  return query
  select
    t.name as topic_name,
    s.name as subject_name,
    t.difficulty,
    count(qa.id) as quiz_attempts,
    coalesce(avg(qa.percentage), 0) as average_score,
    coalesce(min(qa.percentage), 0) as lowest_score,
    max(qa.created_at) as last_attempt_date,
    count(distinct ulp.lesson_id) filter (where ulp.completed = true) as lessons_completed,
    count(distinct l.id) as total_lessons,
    case
      when count(distinct l.id) > 0 then
        (count(distinct ulp.lesson_id) filter (where ulp.completed = true)::numeric / count(distinct l.id)::numeric * 100)
      else 0
    end as completion_rate
  from public.topics t
  join public.subjects s on s.id = t.subject_id
  left join public.quiz_attempts qa on qa.topic_id = t.id and qa.user_id = student_uuid
  left join public.lessons l on l.topic_id = t.id
  left join public.user_lesson_progress ulp on ulp.lesson_id = l.id and ulp.user_id = student_uuid
  where exists (
    select 1 from public.parent_student_links psl
    where psl.student_id = student_uuid
  )
  group by t.id, t.name, s.name, t.difficulty
  having (
    -- Struggling criteria: low quiz scores OR low completion rate
    (coalesce(avg(qa.percentage), 0) < 70 and count(qa.id) > 0)
    or
    (count(distinct l.id) > 0 and (count(distinct ulp.lesson_id) filter (where ulp.completed = true)::numeric / count(distinct l.id)::numeric * 100) < 50)
  )
  order by average_score asc nulls last, completion_rate asc nulls last;
end;
$$;

-- Grant execute permission
grant execute on function public.get_student_struggling_areas(uuid) to anon, authenticated;
