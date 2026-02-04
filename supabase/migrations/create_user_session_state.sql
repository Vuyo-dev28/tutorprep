-- Create table to store user session state (current position in lessons/quizzes)
create table if not exists public.user_session_state (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  current_lesson_id uuid references public.lessons(id) on delete set null,
  current_question_index int default 0,
  quiz_answers jsonb default '{}'::jsonb, -- Store answers as {questionId: {answer, workingOut}}
  quiz_score int default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, topic_id)
);

-- Create index for faster lookups
create index if not exists idx_user_session_state_user_topic on public.user_session_state(user_id, topic_id);

-- RLS Policies
alter table public.user_session_state enable row level security;

-- Users can view their own session state
create policy "Users can view own session state"
  on public.user_session_state
  for select
  using (auth.uid() = user_id);

-- Users can insert their own session state
create policy "Users can insert own session state"
  on public.user_session_state
  for insert
  with check (auth.uid() = user_id);

-- Users can update their own session state
create policy "Users can update own session state"
  on public.user_session_state
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can delete their own session state
create policy "Users can delete own session state"
  on public.user_session_state
  for delete
  using (auth.uid() = user_id);
