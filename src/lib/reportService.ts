import { supabase } from './supabaseClient';

export type StrugglingTopic = {
  topicId: string;
  topicName: string;
  subjectName: string;
  averageScore: number;
  attempts: number;
  lastAttemptDate: string;
};

export type NeedsWork = {
  topicId: string;
  topicName: string;
  subjectName: string;
  reason: 'incomplete' | 'low_score' | 'not_started' | 'stale_progress';
  progress?: number;
  lastActivity?: string;
};

export type DailyReport = {
  id: string;
  reportDate: string;
  strugglingTopics: StrugglingTopic[];
  needsWork: NeedsWork[];
  recommendations: string;
  overallPerformance: string;
  createdAt: string;
};

export async function generateDailyReport(userId: string): Promise<DailyReport | null> {
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  // Check if report exists and was created within the last 30 minutes
  const { data: existingReport } = await supabase
    .from('daily_reports')
    .select('*')
    .eq('user_id', userId)
    .eq('report_date', today)
    .gte('created_at', thirtyMinutesAgo)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingReport) {
    return existingReport as DailyReport;
  }

  // Delete old reports for today if they exist (older than 30 minutes)
  await supabase
    .from('daily_reports')
    .delete()
    .eq('user_id', userId)
    .eq('report_date', today)
    .lt('created_at', thirtyMinutesAgo);

  // Fetch all user data
  const [
    { data: quizAttempts },
    { data: topicProgress },
    { data: lessonProgress },
    { data: allTopics },
    { data: allSubjects },
  ] = await Promise.all([
    supabase
      .from('quiz_attempts')
      .select('topic_id,percentage,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('user_topic_progress')
      .select('topic_id,progress,completed,updated_at')
      .eq('user_id', userId),
    supabase
      .from('user_lesson_progress')
      .select('lesson_id,completed,updated_at')
      .eq('user_id', userId),
    supabase.from('topics').select('id,name,subject_id'),
    supabase.from('subjects').select('id,name'),
  ]);

  // Create maps for quick lookup
  const topicMap = new Map((allTopics || []).map(t => [t.id, t]));
  const subjectMap = new Map((allSubjects || []).map(s => [s.id, s]));
  const progressMap = new Map((topicProgress || []).map(p => [p.topic_id, p]));

  // Analyze struggling topics (quiz scores < 70%)
  const topicScores = new Map<string, { scores: number[]; attempts: number; lastAttempt: string }>();
  
  (quizAttempts || []).forEach(attempt => {
    if (!topicScores.has(attempt.topic_id)) {
      topicScores.set(attempt.topic_id, { scores: [], attempts: 0, lastAttempt: attempt.created_at });
    }
    const data = topicScores.get(attempt.topic_id)!;
    data.scores.push(attempt.percentage);
    data.attempts++;
    if (new Date(attempt.created_at) > new Date(data.lastAttempt)) {
      data.lastAttempt = attempt.created_at;
    }
  });

  const strugglingTopics: StrugglingTopic[] = [];
  topicScores.forEach((data, topicId) => {
    const averageScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
    if (averageScore < 70) {
      const topic = topicMap.get(topicId);
      const subject = topic ? subjectMap.get(topic.subject_id) : null;
      if (topic && subject) {
        strugglingTopics.push({
          topicId,
          topicName: topic.name,
          subjectName: subject.name,
          averageScore: Math.round(averageScore),
          attempts: data.attempts,
          lastAttemptDate: data.lastAttempt,
        });
      }
    }
  });

  // Sort by average score (lowest first)
  strugglingTopics.sort((a, b) => a.averageScore - b.averageScore);

  // Analyze topics that need work
  const needsWork: NeedsWork[] = [];
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Get all lessons per topic
  const { data: allLessons } = await supabase
    .from('lessons')
    .select('id,topic_id');

  const lessonsByTopic = new Map<string, string[]>();
  (allLessons || []).forEach(lesson => {
    if (!lessonsByTopic.has(lesson.topic_id)) {
      lessonsByTopic.set(lesson.topic_id, []);
    }
    lessonsByTopic.get(lesson.topic_id)!.push(lesson.id);
  });

  const completedLessons = new Set((lessonProgress || []).filter(l => l.completed).map(l => l.lesson_id));

  topicMap.forEach((topic, topicId) => {
    const progress = progressMap.get(topicId);
    const subject = subjectMap.get(topic.subject_id);
    if (!subject) return;

    const topicLessons = lessonsByTopic.get(topicId) || [];
    const completedTopicLessons = topicLessons.filter(lid => completedLessons.has(lid));
    const completionRate = topicLessons.length > 0 
      ? (completedTopicLessons.length / topicLessons.length) * 100 
      : 0;

    // Not started
    if (!progress || progress.progress === 0) {
      needsWork.push({
        topicId,
        topicName: topic.name,
        subjectName: subject.name,
        reason: 'not_started',
      });
    }
    // Incomplete (progress > 0 but < 100%)
    else if (progress.progress > 0 && progress.progress < 100 && !progress.completed) {
      const lastActivity = progress.updated_at ? new Date(progress.updated_at) : null;
      const isStale = lastActivity && lastActivity < sevenDaysAgo;
      
      needsWork.push({
        topicId,
        topicName: topic.name,
        subjectName: subject.name,
        reason: isStale ? 'stale_progress' : 'incomplete',
        progress: progress.progress,
        lastActivity: progress.updated_at,
      });
    }
    // Low completion rate (lessons not completed)
    else if (completionRate < 50 && topicLessons.length > 0) {
      needsWork.push({
        topicId,
        topicName: topic.name,
        subjectName: subject.name,
        reason: 'incomplete',
        progress: Math.round(completionRate),
      });
    }
  });

  // Remove duplicates and prioritize
  const uniqueNeedsWork = new Map<string, NeedsWork>();
  needsWork.forEach(item => {
    const existing = uniqueNeedsWork.get(item.topicId);
    if (!existing || 
        (item.reason === 'not_started' && existing.reason !== 'not_started') ||
        (item.reason === 'stale_progress' && existing.reason !== 'stale_progress')) {
      uniqueNeedsWork.set(item.topicId, item);
    }
  });

  const needsWorkList = Array.from(uniqueNeedsWork.values())
    .sort((a, b) => {
      const priority = { 'not_started': 1, 'stale_progress': 2, 'incomplete': 3, 'low_score': 4 };
      return (priority[a.reason] || 5) - (priority[b.reason] || 5);
    })
    .slice(0, 10); // Limit to top 10

  // Generate recommendations
  const recommendations: string[] = [];
  
  if (strugglingTopics.length > 0) {
    recommendations.push(
      `Focus on reviewing ${strugglingTopics[0].topicName} - your average score is ${strugglingTopics[0].averageScore}%. Consider re-reading the lessons and practicing more.`
    );
  }

  if (needsWorkList.filter(n => n.reason === 'not_started').length > 0) {
    const notStarted = needsWorkList.filter(n => n.reason === 'not_started').slice(0, 3);
    recommendations.push(
      `Start working on: ${notStarted.map(n => n.topicName).join(', ')}. These topics haven't been started yet.`
    );
  }

  if (needsWorkList.filter(n => n.reason === 'stale_progress').length > 0) {
    recommendations.push(
      `You haven't made progress on some topics in over a week. Consider revisiting them to maintain your learning momentum.`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push('Great job! Keep up the consistent studying. Consider exploring new topics or reviewing completed ones.');
  }

  // Overall performance summary
  const totalTopics = topicMap.size;
  const completedTopics = (topicProgress || []).filter(p => p.completed).length;
  const completionRate = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;
  
  const recentQuizScores = (quizAttempts || [])
    .slice(0, 10)
    .map(a => a.percentage);
  const recentAverage = recentQuizScores.length > 0
    ? Math.round(recentQuizScores.reduce((a, b) => a + b, 0) / recentQuizScores.length)
    : 0;

  let overallPerformance = '';
  if (completionRate >= 80 && recentAverage >= 80) {
    overallPerformance = 'Excellent! You\'re making great progress with high completion rates and strong quiz scores.';
  } else if (completionRate >= 60 && recentAverage >= 70) {
    overallPerformance = 'Good progress! You\'re on track, but there\'s room for improvement in some areas.';
  } else if (completionRate >= 40 || recentAverage >= 60) {
    overallPerformance = 'Steady progress. Focus on completing more topics and improving quiz scores.';
  } else {
    overallPerformance = 'Getting started! Focus on building consistent study habits and completing lessons.';
  }

  // Save report to database
  const reportData = {
    user_id: userId,
    report_date: today,
    struggling_topics: strugglingTopics,
    needs_work: needsWorkList,
    recommendations: recommendations.join(' '),
    overall_performance: overallPerformance,
  };

  const { data: savedReport, error } = await supabase
    .from('daily_reports')
    .upsert(reportData, {
      onConflict: 'user_id,report_date',
      ignoreDuplicates: false
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving daily report:', error);
    throw error;
  }

  return savedReport as DailyReport;
}

export async function getTodayReport(userId: string): Promise<DailyReport | null> {
  if (!supabase) {
    return null;
  }

  const today = new Date().toISOString().split('T')[0];
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  // Get the most recent report from today that's less than 30 minutes old
  const { data, error } = await supabase
    .from('daily_reports')
    .select('*')
    .eq('user_id', userId)
    .eq('report_date', today)
    .gte('created_at', thirtyMinutesAgo)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching daily report:', error);
    return null;
  }

  return data as DailyReport | null;
}
