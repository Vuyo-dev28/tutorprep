-- Create tutor_chat_messages table for Ask A Tutor chat
create table if not exists public.tutor_chat_messages (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  admin_id uuid references public.profiles(id) on delete set null,
  message text,
  file_url text,
  file_name text,
  file_type text,
  is_from_user boolean not null default true,
  is_read boolean not null default false,
  parent_message_id uuid references public.tutor_chat_messages(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tutor_chat_messages enable row level security;

-- Users can view their own messages
create policy "Users can view their own chat messages"
  on public.tutor_chat_messages
  for select
  using (auth.uid() = user_id);

-- Users can insert messages
create policy "Users can send chat messages"
  on public.tutor_chat_messages
  for insert
  with check (auth.uid() = user_id and is_from_user = true);

-- Users can update their own messages (mark as read)
create policy "Users can update their own chat messages"
  on public.tutor_chat_messages
  for update
  using (auth.uid() = user_id);

-- Admins can view all messages
create policy "Admins can view all chat messages"
  on public.tutor_chat_messages
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Admins can insert replies
create policy "Admins can reply to chat messages"
  on public.tutor_chat_messages
  for insert
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    ) and is_from_user = false
  );

-- Admins can update messages
create policy "Admins can update chat messages"
  on public.tutor_chat_messages
  for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Create indexes for faster queries
create index if not exists tutor_chat_messages_user_id_idx on public.tutor_chat_messages(user_id);
create index if not exists tutor_chat_messages_parent_message_id_idx on public.tutor_chat_messages(parent_message_id);
create index if not exists tutor_chat_messages_created_at_idx on public.tutor_chat_messages(created_at desc);
create index if not exists tutor_chat_messages_is_read_idx on public.tutor_chat_messages(is_read) where is_read = false;

-- Create storage bucket for chat files
insert into storage.buckets (id, name, public)
values ('tutor-chat-files', 'tutor-chat-files', false)
on conflict (id) do nothing;

-- Storage policies for chat files
create policy "Users can upload chat files"
  on storage.objects
  for insert
  with check (
    bucket_id = 'tutor-chat-files' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can view their own chat files"
  on storage.objects
  for select
  using (
    bucket_id = 'tutor-chat-files' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Admins can view all chat files"
  on storage.objects
  for select
  using (
    bucket_id = 'tutor-chat-files' and
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
