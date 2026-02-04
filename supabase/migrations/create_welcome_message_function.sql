-- Create a function to send welcome messages to users
-- This function runs with elevated privileges to bypass RLS
create or replace function public.send_welcome_message(target_user_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  admin_user_id uuid;
begin
  -- Get the first admin user
  select id into admin_user_id
  from public.profiles
  where role = 'admin'
  limit 1;

  -- Insert welcome message
  insert into public.tutor_chat_messages (
    user_id,
    admin_id,
    message,
    is_from_user,
    is_read
  ) values (
    target_user_id,
    admin_user_id,
    '👋 Welcome back! A tutor is always ready to help if you need any assistance. Feel free to ask questions anytime!',
    false,
    false
  );
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.send_welcome_message(uuid) to authenticated;
