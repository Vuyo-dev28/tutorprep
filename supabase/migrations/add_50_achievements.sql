-- Add 50 comprehensive achievements and trophies for students
-- This migration adds exactly 50 NEW achievements

-- First, ensure title uniqueness constraint exists
do $$
begin
  if not exists (
    select 1 from pg_constraint 
    where conname = 'achievements_title_unique'
  ) then
    alter table public.achievements 
    add constraint achievements_title_unique unique (title);
  end if;
end $$;

-- Learning Milestones (8 achievements)
insert into public.achievements (title, description, icon)
select * from (values
  ('Lesson Hero', 'Complete 200 lessons', '📗'),
  ('Lesson Champion', 'Complete 300 lessons', '📘'),
  ('Lesson Titan', 'Complete 400 lessons', '📙'),
  ('Lesson God', 'Complete 500 lessons', '📔'),
  ('Topic Expert', 'Complete 15 topics', '⭐'),
  ('Topic Grandmaster', 'Complete 20 topics', '🌟'),
  ('Subject Master', 'Complete all topics in 2 subjects', '🎓'),
  ('Ultimate Scholar', 'Complete all topics in all subjects', '👑')
) as v(title, description, icon)
where not exists (select 1 from public.achievements where achievements.title = v.title);

-- Quiz Achievements (8 achievements)
insert into public.achievements (title, description, icon)
select * from (values
  ('Quiz Legend', 'Score 90% or higher on 50 quizzes', '💎'),
  ('Quiz Warrior', 'Complete 25 quizzes', '⚔️'),
  ('Quiz Titan', 'Complete 50 quizzes', '🔱'),
  ('Quiz God', 'Complete 100 quizzes', '⚡'),
  ('Perfect Streak', 'Score 100% on 5 consecutive quizzes', '💯'),
  ('Quiz Perfectionist', 'Score 100% on 10 quizzes', '⭐'),
  ('Assessment Master', 'Score 90%+ on 5 assessment quizzes', '📊'),
  ('Quiz Marathon', 'Complete 10 quizzes in one week', '🏃')
) as v(title, description, icon)
where not exists (select 1 from public.achievements where achievements.title = v.title);

-- Streak Achievements (6 achievements)
insert into public.achievements (title, description, icon)
select * from (values
  ('Unstoppable', 'Study for 180 days in a row', '🚀'),
  ('Year Warrior', 'Study for 365 days in a row', '🏅'),
  ('Streak Champion', 'Maintain a 75-day streak', '⚡'),
  ('Streak Legend', 'Maintain a 150-day streak', '💪'),
  ('Streak God', 'Maintain a 200-day streak', '👑'),
  ('Streak Immortal', 'Maintain a 300-day streak', '🏆')
) as v(title, description, icon)
where not exists (select 1 from public.achievements where achievements.title = v.title);

-- Time-Based Achievements (6 achievements)
insert into public.achievements (title, description, icon)
select * from (values
  ('Time Starter', 'Study for 1 hour total', '⏰'),
  ('Time Titan', 'Study for 200 hours total', '⏳'),
  ('Time Immortal', 'Study for 300 hours total', '⏰'),
  ('Time Deity', 'Study for 500 hours total', '🕐'),
  ('Study Marathon', 'Study for 3 hours in one day', '🏃'),
  ('Study Champion', 'Study for 5 hours in one day', '💪')
) as v(title, description, icon)
where not exists (select 1 from public.achievements where achievements.title = v.title);

-- Progress Achievements (4 achievements)
insert into public.achievements (title, description, icon)
select * from (values
  ('Master Completer', 'Complete 20 topics at 100%', '🏆'),
  ('Ultimate Completer', 'Complete 30 topics at 100%', '💎'),
  ('Progress Master', 'Complete 75% of 10 topics', '🎯'),
  ('Total Completion', 'Complete 100% of all available topics', '✅')
) as v(title, description, icon)
where not exists (select 1 from public.achievements where achievements.title = v.title);

-- Speed Achievements (3 achievements)
insert into public.achievements (title, description, icon)
select * from (values
  ('Lightning Fast', 'Complete 15 lessons in one day', '⚡'),
  ('Speed Demon', 'Complete 20 lessons in one day', '🚀'),
  ('Speed Champion', 'Complete 2 topics in one day', '🏁')
) as v(title, description, icon)
where not exists (select 1 from public.achievements where achievements.title = v.title);

-- Special Achievements (5 achievements)
insert into public.achievements (title, description, icon)
select * from (values
  ('Comeback Champion', 'Return after 30 days away', '🔄'),
  ('Weekend Master', 'Study every weekend for a month', '🎮'),
  ('Multi-Subject Master', 'Study 3 subjects in one day', '🎭'),
  ('Achievement Master', 'Unlock 30 achievements', '🏛️'),
  ('Achievement Legend', 'Unlock 40 achievements', '👑')
) as v(title, description, icon)
where not exists (select 1 from public.achievements where achievements.title = v.title);

-- Grade-Specific Achievements (5 achievements)
insert into public.achievements (title, description, icon)
select * from (values
  ('Grade 8 Master', 'Score 90%+ on all Grade 8 quizzes', '🎓'),
  ('Grade 9 Master', 'Score 90%+ on all Grade 9 quizzes', '🎓'),
  ('Grade 10 Master', 'Score 90%+ on all Grade 10 quizzes', '🎓'),
  ('Grade 11 Master', 'Score 90%+ on all Grade 11 quizzes', '🎓'),
  ('Grade 12 Master', 'Score 90%+ on all Grade 12 quizzes', '🎓')
) as v(title, description, icon)
where not exists (select 1 from public.achievements where achievements.title = v.title);

-- Excellence Achievements (5 achievements)
insert into public.achievements (title, description, icon)
select * from (values
  ('Straight A Student', 'Score 90%+ on 10 consecutive quizzes', '📊'),
  ('Excellence Award', 'Maintain 90%+ average across all quizzes', '🏅'),
  ('Perfect Week', 'Score 100% on all quizzes in a week', '💯'),
  ('Perfect Month', 'Score 100% on all quizzes in a month', '⭐'),
  ('Academic Excellence', 'Score 95%+ on 20 quizzes', '🎖️')
) as v(title, description, icon)
where not exists (select 1 from public.achievements where achievements.title = v.title);
