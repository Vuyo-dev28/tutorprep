-- Add parent_email column to profiles table
alter table public.profiles
  add column if not exists parent_email text;

-- Create index for faster lookups
create index if not exists profiles_parent_email_idx on public.profiles(parent_email) where parent_email is not null;

-- Create a function to automatically create parent-student links when parent_email is set
create or replace function public.auto_create_parent_link()
returns trigger
language plpgsql
security definer
as $$
declare
  new_access_code text;
begin
  -- Only create link if parent_email is provided and user is a student
  if new.parent_email is not null and new.parent_email != '' and coalesce(new.role, 'student') = 'student' then
    -- Generate access code using the function from parent portal migration
    -- If function doesn't exist yet, generate a simple code
    begin
      select public.generate_access_code() into new_access_code;
    exception when others then
      -- Fallback: generate a 6-digit code
      new_access_code := lpad(floor(random() * 1000000)::text, 6, '0');
    end;
    
    -- Create or update parent-student link
    insert into public.parent_student_links (
      parent_email,
      student_id,
      access_code,
      is_active
    )
    values (
      lower(trim(new.parent_email)),
      new.id,
      new_access_code,
      true
    )
    on conflict (parent_email, student_id) do update
    set
      access_code = excluded.access_code,
      is_active = true;
  end if;
  
  return new;
end;
$$;

-- Create trigger to auto-create parent links on profile insert/update
drop trigger if exists auto_create_parent_link_trigger on public.profiles;

create trigger auto_create_parent_link_trigger
after insert or update of parent_email on public.profiles
for each row
execute function public.auto_create_parent_link();
