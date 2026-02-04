-- Create user_messages table for user-admin messaging
create table if not exists public.user_messages (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  admin_id uuid references public.profiles(id) on delete set null,
  subject text not null,
  message text not null,
  is_from_user boolean not null default true,
  is_read boolean not null default false,
  parent_message_id uuid references public.user_messages(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_messages enable row level security;

-- Users can view their own messages
create policy "Users can view their own messages"
  on public.user_messages
  for select
  using (auth.uid() = user_id);

-- Users can insert messages to admin
create policy "Users can send messages"
  on public.user_messages
  for insert
  with check (auth.uid() = user_id and is_from_user = true);

-- Admins can view all messages
create policy "Admins can view all messages"
  on public.user_messages
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Admins can insert replies
create policy "Admins can reply to messages"
  on public.user_messages
  for insert
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    ) and is_from_user = false
  );

-- Admins can update message status (mark as read)
create policy "Admins can update messages"
  on public.user_messages
  for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Users can update their own messages (mark as read)
create policy "Users can update their own messages"
  on public.user_messages
  for update
  using (auth.uid() = user_id);

-- Create indexes for faster queries
create index if not exists user_messages_user_id_idx on public.user_messages(user_id);
create index if not exists user_messages_parent_message_id_idx on public.user_messages(parent_message_id);
create index if not exists user_messages_created_at_idx on public.user_messages(created_at desc);
create index if not exists user_messages_is_read_idx on public.user_messages(is_read) where is_read = false;
