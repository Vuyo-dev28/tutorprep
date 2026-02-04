-- Add more diverse achievements for users to unlock

-- Learning Milestones
insert into public.achievements (title, description, icon) values
  ('First Steps', 'Complete your first lesson', '🎯'),
  ('Lesson Learner', 'Complete 10 lessons', '📚'),
  ('Lesson Master', 'Complete 50 lessons', '📖'),
  ('Lesson Legend', 'Complete 100 lessons', '📕'),
  ('Topic Explorer', 'Complete your first topic', '🗺️'),
  ('Topic Champion', 'Complete 5 topics', '⭐'),
  ('Topic Master', 'Complete 10 topics', '🌟'),
  ('Subject Specialist', 'Complete all topics in a subject', '🎓');

-- Quiz Achievements
insert into public.achievements (title, description, icon) values
  ('Quiz Starter', 'Complete your first quiz', '📝'),
  ('Perfect Score', 'Score 100% on a quiz', '💯'),
  ('Quiz Ace', 'Score 90% or higher on 5 quizzes', '🎯'),
  ('Quiz Master', 'Score 90% or higher on 10 quizzes', '🏆'),
  ('Quiz Champion', 'Score 90% or higher on 20 quizzes', '👑'),
  ('Assessment Expert', 'Complete an assessment quiz', '📊'),
  ('Perfect Assessment', 'Score 100% on an assessment quiz', '💎');

-- Streak Achievements
insert into public.achievements (title, description, icon) values
  ('Getting Started', 'Study for 1 day in a row', '🌱'),
  ('Week Warrior', 'Study for 7 days in a row', '🔥'),
  ('Fortnight Fighter', 'Study for 14 days in a row', '⚡'),
  ('Monthly Master', 'Study for 30 days in a row', '💪'),
  ('Consistency King', 'Study for 60 days in a row', '👑'),
  ('Dedication Deity', 'Study for 100 days in a row', '🌟');

-- Time-Based Achievements
insert into public.achievements (title, description, icon) values
  ('Time Keeper', 'Study for 1 hour total', '⏰'),
  ('Time Master', 'Study for 10 hours total', '⏱️'),
  ('Time Legend', 'Study for 50 hours total', '🕐'),
  ('Time Champion', 'Study for 100 hours total', '🕰️'),
  ('Marathon Learner', 'Study for 2 hours in one day', '🏃'),
  ('Night Owl', 'Study after 8 PM', '🦉'),
  ('Early Bird', 'Study before 8 AM', '🐦');

-- Progress Achievements
insert into public.achievements (title, description, icon) values
  ('Progress Maker', 'Complete 25% of a topic', '📈'),
  ('Halfway Hero', 'Complete 50% of a topic', '🎯'),
  ('Almost There', 'Complete 75% of a topic', '🎪'),
  ('Completionist', 'Complete 5 topics at 100%', '✅'),
  ('Perfectionist', 'Complete 10 topics at 100%', '💎');

-- Speed Achievements
insert into public.achievements (title, description, icon) values
  ('Speed Learner', 'Complete 5 lessons in one day', '⚡'),
  ('Rapid Reader', 'Complete 10 lessons in one day', '🚀'),
  ('Quick Quizzer', 'Complete 3 quizzes in one day', '🎯'),
  ('Fast Finisher', 'Complete a topic in one day', '🏁');

-- Special Achievements
insert into public.achievements (title, description, icon) values
  ('Comeback Kid', 'Return after 7 days away', '🔄'),
  ('Weekend Warrior', 'Study on both Saturday and Sunday', '🎮'),
  ('Multi-Tasker', 'Study multiple subjects in one day', '🎭'),
  ('Explorer', 'Start lessons in 5 different topics', '🧭'),
  ('Scholar', 'Complete lessons in all subjects', '🎓'),
  ('All-Star', 'Unlock 10 achievements', '⭐'),
  ('Hall of Fame', 'Unlock 25 achievements', '🏛️'),
  ('Legendary', 'Unlock all achievements', '👑');

-- Grade-Specific Achievements
insert into public.achievements (title, description, icon) values
  ('Grade 8 Graduate', 'Complete all Grade 8 topics', '🎓'),
  ('Grade 9 Graduate', 'Complete all Grade 9 topics', '🎓'),
  ('Grade 10 Graduate', 'Complete all Grade 10 topics', '🎓'),
  ('Grade 11 Graduate', 'Complete all Grade 11 topics', '🎓'),
  ('Grade 12 Graduate', 'Complete all Grade 12 topics', '🎓');

on conflict do nothing;
