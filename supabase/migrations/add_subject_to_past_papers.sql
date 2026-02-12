-- Add subject column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'past_papers' 
    and column_name = 'subject'
  ) then
    alter table public.past_papers add column subject text;
  end if;
end $$;

-- Create index if it doesn't exist
create index if not exists past_papers_subject_idx on public.past_papers(subject) where subject is not null;
