import { supabase } from './supabaseClient';

/**
 * Achievement Service
 * Automatically checks and awards achievements based on user activity
 */

export async function checkAndAwardAchievements(userId: string): Promise<string[]> {
  if (!supabase || !userId) return [];

  const newlyUnlocked: string[] = [];

  try {
    // Get all achievements
    const { data: allAchievements } = await supabase
      .from('achievements')
      .select('id, title, description');

    if (!allAchievements || allAchievements.length === 0) return [];

    // Get user's current achievements
    const { data: userAchievements } = await supabase
      .from('user_achievements')
      .select('achievement_id, unlocked')
      .eq('user_id', userId);

    const unlockedIds = new Set(
      (userAchievements || [])
        .filter(ua => ua.unlocked)
        .map(ua => ua.achievement_id)
    );

    // Get user's progress data
    const [
      { data: lessonProgress },
      { data: topicProgress },
      { data: quizAttempts },
      { data: studySessions },
      { data: topics },
      { data: subjects },
    ] = await Promise.all([
      supabase
        .from('user_lesson_progress')
        .select('lesson_id, completed')
        .eq('user_id', userId)
        .eq('completed', true),
      supabase
        .from('user_topic_progress')
        .select('topic_id, completed, progress')
        .eq('user_id', userId),
      supabase
        .from('quiz_attempts')
        .select('topic_id, percentage, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('study_sessions')
        .select('created_at, minutes')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('topics')
        .select('id, subject_id, grade, is_assessment'),
      supabase
        .from('subjects')
        .select('id, name'),
    ]);

    const completedLessons = lessonProgress?.length || 0;
    const completedTopics = topicProgress?.filter(tp => tp.completed).length || 0;
    const totalTopics = topics?.length || 0;
    const totalSubjects = subjects?.length || 0;

    // Calculate streak
    const studyDates = (studySessions || [])
      .map(s => new Date(s.created_at).toDateString())
      .filter((date, index, self) => self.indexOf(date) === index)
      .map(dateStr => new Date(dateStr))
      .sort((a, b) => b.getTime() - a.getTime());

    let streak = 0;
    if (studyDates.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const mostRecentDate = new Date(studyDates[0]);
      mostRecentDate.setHours(0, 0, 0, 0);
      
      if (mostRecentDate.getTime() === today.getTime() || mostRecentDate.getTime() === yesterday.getTime()) {
        streak = 1;
        let checkDate = new Date(mostRecentDate);
        for (let i = 0; i < studyDates.length; i++) {
          const studyDate = new Date(studyDates[i]);
          studyDate.setHours(0, 0, 0, 0);
          if (studyDate.getTime() === checkDate.getTime()) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else if (studyDate.getTime() < checkDate.getTime()) {
            break;
          }
        }
        streak = Math.max(0, streak - 1);
      }
    }

    // Calculate total study time
    const totalMinutes = (studySessions || []).reduce((sum, s) => sum + s.minutes, 0);
    const totalHours = totalMinutes / 60;

    // Get quiz statistics
    const perfectScores = (quizAttempts || []).filter(q => q.percentage === 100).length;
    const highScores = (quizAttempts || []).filter(q => q.percentage >= 90).length;
    const assessmentQuizzes = (quizAttempts || []).filter(q => {
      const topic = topics?.find(t => t.id === q.topic_id);
      return topic?.is_assessment;
    });

    // Check for time-based achievements (Night Owl, Early Bird, Marathon Learner)
    const today = new Date();
    const todaySessions = (studySessions || []).filter(s => {
      const sessionDate = new Date(s.created_at);
      return sessionDate.toDateString() === today.toDateString();
    });
    const todayTotalMinutes = todaySessions.reduce((sum, s) => sum + s.minutes, 0);
    const hasNightStudy = todaySessions.some(s => {
      const hour = new Date(s.created_at).getHours();
      return hour >= 20; // 8 PM or later
    });
    const hasEarlyStudy = todaySessions.some(s => {
      const hour = new Date(s.created_at).getHours();
      return hour < 8; // Before 8 AM
    });

    // Check for weekend study
    const weekendSessions = (studySessions || []).filter(s => {
      const day = new Date(s.created_at).getDay();
      return day === 0 || day === 6; // Sunday or Saturday
    });
    const hasWeekendStudy = weekendSessions.length > 0;
    const hasBothWeekendDays = new Set(weekendSessions.map(s => new Date(s.created_at).getDay())).size >= 2;

    // Check for multi-subject study in one day
    const todayTopics = new Set(
      (lessonProgress || [])
        .map(lp => {
          // Would need to join with lessons to get topic_id, simplified for now
          return null;
        })
        .filter(Boolean)
    );

    // Check completed topics by grade
    const completedTopicsByGrade: Record<number, number> = {};
    (topicProgress || [])
      .filter(tp => tp.completed)
      .forEach(tp => {
        const topic = topics?.find(t => t.id === tp.topic_id);
        if (topic?.grade) {
          completedTopicsByGrade[topic.grade] = (completedTopicsByGrade[topic.grade] || 0) + 1;
        }
      });

    // Check completed topics by subject
    const completedTopicsBySubject: Record<string, number> = {};
    const totalTopicsBySubject: Record<string, number> = {};
    (topicProgress || [])
      .filter(tp => tp.completed)
      .forEach(tp => {
        const topic = topics?.find(t => t.id === tp.topic_id);
        if (topic?.subject_id) {
          completedTopicsBySubject[topic.subject_id] = (completedTopicsBySubject[topic.subject_id] || 0) + 1;
        }
      });
    (topics || []).forEach(topic => {
      if (topic.subject_id) {
        totalTopicsBySubject[topic.subject_id] = (totalTopicsBySubject[topic.subject_id] || 0) + 1;
      }
    });

    // Check achievements by title/description pattern
    for (const achievement of allAchievements) {
      if (unlockedIds.has(achievement.id)) continue;

      let shouldUnlock = false;

      // Learning Milestones
      if (achievement.title === 'First Steps' && completedLessons >= 1) {
        shouldUnlock = true;
      } else if (achievement.title === 'Lesson Learner' && completedLessons >= 10) {
        shouldUnlock = true;
      } else if (achievement.title === 'Lesson Master' && completedLessons >= 50) {
        shouldUnlock = true;
      } else if (achievement.title === 'Lesson Legend' && completedLessons >= 100) {
        shouldUnlock = true;
      } else if (achievement.title === 'Topic Explorer' && completedTopics >= 1) {
        shouldUnlock = true;
      } else if (achievement.title === 'Topic Champion' && completedTopics >= 5) {
        shouldUnlock = true;
      } else if (achievement.title === 'Topic Master' && completedTopics >= 10) {
        shouldUnlock = true;
      }

      // Quiz Achievements
      else if (achievement.title === 'Quiz Starter' && (quizAttempts?.length || 0) >= 1) {
        shouldUnlock = true;
      } else if (achievement.title === 'Perfect Score' && perfectScores >= 1) {
        shouldUnlock = true;
      } else if (achievement.title === 'Quiz Ace' && highScores >= 5) {
        shouldUnlock = true;
      } else if (achievement.title === 'Quiz Master' && highScores >= 10) {
        shouldUnlock = true;
      } else if (achievement.title === 'Quiz Champion' && highScores >= 20) {
        shouldUnlock = true;
      } else if (achievement.title === 'Assessment Expert' && assessmentQuizzes.length >= 1) {
        shouldUnlock = true;
      } else if (achievement.title === 'Perfect Assessment' && assessmentQuizzes.some(aq => aq.percentage === 100)) {
        shouldUnlock = true;
      }

      // Streak Achievements
      else if (achievement.title === 'Getting Started' && streak >= 1) {
        shouldUnlock = true;
      } else if (achievement.title === 'Week Warrior' && streak >= 7) {
        shouldUnlock = true;
      } else if (achievement.title === 'Fortnight Fighter' && streak >= 14) {
        shouldUnlock = true;
      } else if (achievement.title === 'Monthly Master' && streak >= 30) {
        shouldUnlock = true;
      } else if (achievement.title === 'Consistency King' && streak >= 60) {
        shouldUnlock = true;
      } else if (achievement.title === 'Dedication Deity' && streak >= 100) {
        shouldUnlock = true;
      }

      // Time-Based Achievements
      else if (achievement.title === 'Time Keeper' && totalHours >= 1) {
        shouldUnlock = true;
      } else if (achievement.title === 'Time Master' && totalHours >= 10) {
        shouldUnlock = true;
      } else if (achievement.title === 'Time Legend' && totalHours >= 50) {
        shouldUnlock = true;
      } else if (achievement.title === 'Time Champion' && totalHours >= 100) {
        shouldUnlock = true;
      }

      // Progress Achievements
      else if (achievement.title === 'Progress Maker' && topicProgress?.some(tp => tp.progress >= 25 && tp.progress < 50)) {
        shouldUnlock = true;
      } else if (achievement.title === 'Halfway Hero' && topicProgress?.some(tp => tp.progress >= 50 && tp.progress < 75)) {
        shouldUnlock = true;
      } else if (achievement.title === 'Almost There' && topicProgress?.some(tp => tp.progress >= 75 && tp.progress < 100)) {
        shouldUnlock = true;
      } else if (achievement.title === 'Completionist' && topicProgress?.filter(tp => tp.progress === 100).length >= 5) {
        shouldUnlock = true;
      } else if (achievement.title === 'Perfectionist' && topicProgress?.filter(tp => tp.progress === 100).length >= 10) {
        shouldUnlock = true;
      }

      // Time-Based Special Achievements
      else if (achievement.title === 'Marathon Learner' && todayTotalMinutes >= 120) {
        shouldUnlock = true;
      } else if (achievement.title === 'Night Owl' && hasNightStudy) {
        shouldUnlock = true;
      } else if (achievement.title === 'Early Bird' && hasEarlyStudy) {
        shouldUnlock = true;
      }

      // Special Achievements
      else if (achievement.title === 'Weekend Warrior' && hasBothWeekendDays) {
        shouldUnlock = true;
      } else if (achievement.title === 'Subject Specialist') {
        // Check if user completed all topics in any subject
        const hasCompletedSubject = Object.keys(completedTopicsBySubject).some(subjectId => {
          return completedTopicsBySubject[subjectId] >= (totalTopicsBySubject[subjectId] || 0);
        });
        if (hasCompletedSubject) {
          shouldUnlock = true;
        }
      } else if (achievement.title.startsWith('Grade ') && achievement.title.endsWith(' Graduate')) {
        // Grade-specific achievements
        const gradeMatch = achievement.title.match(/Grade (\d+)/);
        if (gradeMatch) {
          const grade = parseInt(gradeMatch[1]);
          const totalGradeTopics = (topics || []).filter(t => t.grade === grade).length;
          const completedGradeTopics = completedTopicsByGrade[grade] || 0;
          if (totalGradeTopics > 0 && completedGradeTopics >= totalGradeTopics) {
            shouldUnlock = true;
          }
        }
      }

      // Speed Achievements (check today's activity)
      else if (achievement.title === 'Quick Quizzer') {
        const today = new Date().toISOString().split('T')[0];
        const todayQuizzes = quizAttempts?.filter(qa => qa.created_at?.startsWith(today)).length || 0;
        if (todayQuizzes >= 3) {
          shouldUnlock = true;
        }
      }

      if (shouldUnlock) {
        // Award the achievement
        await supabase
          .from('user_achievements')
          .upsert({
            user_id: userId,
            achievement_id: achievement.id,
            unlocked: true,
            unlocked_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,achievement_id'
          });

        newlyUnlocked.push(achievement.title);
        unlockedIds.add(achievement.id); // Add to set so count is accurate
      }
    }

    // Check special achievements that depend on total unlocked count
    let totalUnlocked = unlockedIds.size;
    for (const achievement of allAchievements) {
      if (unlockedIds.has(achievement.id)) continue;

      if (achievement.title === 'All-Star' && totalUnlocked >= 10) {
        await supabase
          .from('user_achievements')
          .upsert({
            user_id: userId,
            achievement_id: achievement.id,
            unlocked: true,
            unlocked_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,achievement_id'
          });
        newlyUnlocked.push(achievement.title);
        unlockedIds.add(achievement.id);
        totalUnlocked++;
      } else if (achievement.title === 'Hall of Fame' && totalUnlocked >= 25) {
        await supabase
          .from('user_achievements')
          .upsert({
            user_id: userId,
            achievement_id: achievement.id,
            unlocked: true,
            unlocked_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,achievement_id'
          });
        newlyUnlocked.push(achievement.title);
        unlockedIds.add(achievement.id);
        totalUnlocked++;
      } else if (achievement.title === 'Legendary' && totalUnlocked >= allAchievements.length - 1) {
        await supabase
          .from('user_achievements')
          .upsert({
            user_id: userId,
            achievement_id: achievement.id,
            unlocked: true,
            unlocked_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,achievement_id'
          });
        newlyUnlocked.push(achievement.title);
      }
    }

    return newlyUnlocked;
  } catch (error) {
    console.error('Error checking achievements:', error);
    return [];
  }
}
