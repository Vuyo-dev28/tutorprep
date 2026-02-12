-- Update past_papers table to support the new past papers management system
-- This migration works with the existing schema and adds missing columns

-- Add missing columns if they don't exist
do $$
begin
  -- Add year column if missing
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'past_papers' 
    and column_name = 'year'
  ) then
    alter table public.past_papers add column year integer;
  end if;

  -- Add exam_type column if missing
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'past_papers' 
    and column_name = 'exam_type'
  ) then
    alter table public.past_papers add column exam_type text;
  end if;

  -- Add file_name column if missing
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'past_papers' 
    and column_name = 'file_name'
  ) then
    alter table public.past_papers add column file_name text;
  end if;

  -- Add file_size column if missing
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'past_papers' 
    and column_name = 'file_size'
  ) then
    alter table public.past_papers add column file_size bigint;
  end if;

  -- Add created_by column if missing
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'past_papers' 
    and column_name = 'created_by'
  ) then
    alter table public.past_papers add column created_by uuid references public.profiles(id);
  end if;

  -- Add updated_at column if missing
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'past_papers' 
    and column_name = 'updated_at'
  ) then
    alter table public.past_papers add column updated_at timestamptz not null default now();
  end if;

  -- Ensure subject column exists (use subject_name if subject doesn't exist)
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'past_papers' 
    and column_name = 'subject'
  ) then
    -- If subject_name exists, we can use it, but add subject for consistency
    alter table public.past_papers add column subject text;
    -- Copy data from subject_name to subject if subject_name exists
    if exists (
      select 1 from information_schema.columns 
      where table_schema = 'public' 
      and table_name = 'past_papers' 
      and column_name = 'subject_name'
    ) then
      update public.past_papers set subject = subject_name where subject is null;
    end if;
  end if;

  -- Add grade column if missing (for single grade, use grade_from if available)
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'past_papers' 
    and column_name = 'grade'
  ) then
    alter table public.past_papers add column grade integer;
    -- Copy from grade_from if it exists
    if exists (
      select 1 from information_schema.columns 
      where table_schema = 'public' 
      and table_name = 'past_papers' 
      and column_name = 'grade_from'
    ) then
      update public.past_papers set grade = grade_from where grade is null;
    end if;
  end if;

  -- Add term column if missing (extract from term_id relationship)
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'past_papers' 
    and column_name = 'term'
  ) then
    alter table public.past_papers add column term integer check (term in (1, 2, 3, 4));
    -- Copy from past_paper_terms if relationship exists
    if exists (
      select 1 from information_schema.columns 
      where table_schema = 'public' 
      and table_name = 'past_papers' 
      and column_name = 'term_id'
    ) then
      update public.past_papers pp
      set term = ppt.term_number
      from public.past_paper_terms ppt
      where pp.term_id = ppt.id and pp.term is null;
    end if;
  end if;
end $$;

-- Create indexes if they don't exist
create index if not exists past_papers_subject_idx on public.past_papers(subject) where subject is not null;
create index if not exists past_papers_grade_idx on public.past_papers(grade) where grade is not null;
create index if not exists past_papers_curriculum_idx on public.past_papers(curriculum);
create index if not exists past_papers_term_idx on public.past_papers(term) where term is not null;
create index if not exists past_papers_year_idx on public.past_papers(year) where year is not null;
create index if not exists past_papers_created_at_idx on public.past_papers(created_at desc);

-- Ensure storage bucket exists
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'past-papers', 
  'past-papers', 
  false,
  52428800, -- 50MB limit
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
)
on conflict (id) do update
set 
  name = 'past-papers',
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];

-- Drop existing policies if they exist (to avoid conflicts)
drop policy if exists "Admins can upload past papers" on storage.objects;
drop policy if exists "Admins can manage past papers files" on storage.objects;
drop policy if exists "Users can view past papers files" on storage.objects;

-- Storage policies for past papers
create policy "Admins can upload past papers"
  on storage.objects
  for insert
  with check (
    bucket_id = 'past-papers' and
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can manage past papers files"
  on storage.objects
  for all
  using (
    bucket_id = 'past-papers' and
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  )
  with check (
    bucket_id = 'past-papers' and
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Users can view past papers (but not download - this will be handled by signed URLs)
create policy "Users can view past papers files"
  on storage.objects
  for select
  using (
    bucket_id = 'past-papers'
  );
