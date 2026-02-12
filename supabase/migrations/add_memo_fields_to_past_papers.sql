-- Add memo fields for past papers
alter table if exists past_papers
  add column if not exists memo_file_url text,
  add column if not exists memo_file_name text,
  add column if not exists memo_file_size bigint;
