-- Add is_assessment column to topics table
alter table public.topics 
add column if not exists is_assessment boolean not null default false;
