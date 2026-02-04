import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import { Progress } from '@/app/components/ui/progress';
import { 
  BookOpen, 
  Trophy, 
  TrendingUp, 
  Clock, 
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { UserProfile } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { Leaderboard } from '@/app/components/Leaderboard';
import { DailyReport } from '@/app/components/DailyReport';

type SubjectRow = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
};

type TopicRow = {
  id: string;
  subject_id: string;
  name: string;
};

type LessonRow = {
  id: string;
  topic_id: string;
};

interface DashboardScreenProps {
  profile: UserProfile;
}

export function DashboardScreen({ profile }: DashboardScreenProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [streakDays, setStreakDays] = useState(0);
  const [totalHours, setTotalHours] = useState(0);
  const [awardsCount, setAwardsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [continueTopic, setContinueTopic] = useState<{ topicId: string; subjectId: string; lessonId: string; topicName: string; progress: number } | null>(null);

  const stats = [
    { label: 'Topics', value: String(topics.length), icon: BookOpen, gradient: 'from-blue-400 to-blue-600' },
    { label: 'Streak', value: `${streakDays}d`, icon: TrendingUp, gradient: 'from-green-400 to-green-600' },
    { label: 'Time', value: `${totalHours > 0 ? totalHours.toFixed(1) : '0'}h`, icon: Clock, gradient: 'from-purple-400 to-purple-600' },
    { label: 'Awards', value: String(awardsCount), icon: Trophy, gradient: 'from-yellow-400 to-yellow-600' },
  ];

  useEffect(() => {
    let isActive = true;

    const loadData = async () => {
      if (!supabase) {
        if (isActive) {
          setIsLoading(false);
        }
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      const [
        { data: subjectRows },
        { data: topicRows },
        { data: lessonRows },
        { data: studyRows },
        { count: achievementCount },
        { data: sessionStateRows },
        { data: lessonProgressRows },
      ] = await Promise.all([
        supabase.from('subjects').select('id,name,description,icon,color').order('sort_order'),
        supabase.from('topics').select('id,subject_id,name').order('sort_order'),
        supabase.from('lessons').select('id,topic_id').order('sort_order'),
        userId
          ? supabase
              .from('study_sessions')
              .select('created_at,minutes')
              .eq('user_id', userId)
          : Promise.resolve({ data: [] as { created_at: string; minutes: number }[] }),
        userId
          ? supabase
              .from('user_achievements')
              .select('achievement_id', { count: 'exact', head: true })
              .eq('user_id', userId)
              .eq('unlocked', true)
          : Promise.resolve({ count: 0 }),
        userId
          ? supabase
              .from('user_session_state')
              .select('topic_id,current_lesson_id')
              .eq('user_id', userId)
              .order('updated_at', { ascending: false })
              .limit(1)
          : Promise.resolve({ data: null }),
        userId
          ? supabase
              .from('user_lesson_progress')
              .select('lesson_id,completed')
              .eq('user_id', userId)
              .eq('completed', true)
          : Promise.resolve({ data: [] }),
      ]);

      // Calculate consecutive streak days
      const studyDates = (studyRows ?? [])
        .map((row) => new Date(row.created_at).toDateString())
        .filter((date, index, self) => self.indexOf(date) === index) // Get unique dates
        .map((dateStr) => new Date(dateStr))
        .sort((a, b) => b.getTime() - a.getTime()); // Sort descending (most recent first)
      
      let streak = 0;
      if (studyDates.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        // Check if user studied today or yesterday (allows for current day streak)
        const mostRecentDate = new Date(studyDates[0]);
        mostRecentDate.setHours(0, 0, 0, 0);
        
        if (mostRecentDate.getTime() === today.getTime() || mostRecentDate.getTime() === yesterday.getTime()) {
          streak = 1;
          // Count consecutive days going backwards
          let checkDate = new Date(mostRecentDate);
          for (let i = 0; i < studyDates.length; i++) {
            const studyDate = new Date(studyDates[i]);
            studyDate.setHours(0, 0, 0, 0);
            
            if (studyDate.getTime() === checkDate.getTime()) {
              streak++;
              checkDate.setDate(checkDate.getDate() - 1);
            } else if (studyDate.getTime() < checkDate.getTime()) {
              // Gap found, break streak
              break;
            }
          }
          // Subtract 1 because we started at 1
          streak = Math.max(0, streak - 1);
        }
      }
      
      const minutesTotal = (studyRows ?? []).reduce((sum, row) => sum + row.minutes, 0);
      // Calculate total hours with one decimal place
      const hoursTotal = Math.round((minutesTotal / 60) * 10) / 10;

      // Find the topic to continue learning from
      let continueData: { topicId: string; subjectId: string; lessonId: string; topicName: string; progress: number } | null = null;
      
      if (sessionStateRows && sessionStateRows.length > 0 && userId) {
        const sessionState = sessionStateRows[0];
        const topic = topicRows?.find(t => t.id === sessionState.topic_id);
        
        if (topic && sessionState.current_lesson_id) {
          // Get all lessons for this topic
          const topicLessons = lessonRows?.filter(l => l.topic_id === topic.id) || [];
          const completedLessons = lessonProgressRows?.filter(lp => 
            topicLessons.some(l => l.id === lp.lesson_id)
          ) || [];
          
          const progress = topicLessons.length > 0 
            ? Math.round((completedLessons.length / topicLessons.length) * 100)
            : 0;
          
          continueData = {
            topicId: topic.id,
            subjectId: topic.subject_id,
            lessonId: sessionState.current_lesson_id,
            topicName: topic.name,
            progress,
          };
        }
      }
      
      // If no session state, find first incomplete topic
      if (!continueData && topicRows && lessonRows && userId) {
        for (const topic of topicRows) {
          const topicLessons = lessonRows.filter(l => l.topic_id === topic.id);
          if (topicLessons.length > 0) {
            const completedLessons = lessonProgressRows?.filter(lp => 
              topicLessons.some(l => l.id === lp.lesson_id)
            ) || [];
            
            // If not all lessons are completed, use this topic
            if (completedLessons.length < topicLessons.length) {
              // Find first incomplete lesson or use first lesson
              const incompleteLesson = topicLessons.find(l => 
                !lessonProgressRows?.some(lp => lp.lesson_id === l.id && lp.completed)
              ) || topicLessons[0];
              
              const progress = Math.round((completedLessons.length / topicLessons.length) * 100);
              
              continueData = {
                topicId: topic.id,
                subjectId: topic.subject_id,
                lessonId: incompleteLesson.id,
                topicName: topic.name,
                progress,
              };
              break;
            }
          }
        }
      }

      if (isActive) {
        setSubjects(subjectRows ?? []);
        setTopics(topicRows ?? []);
        setLessons(lessonRows ?? []);
        setStreakDays(streak);
        setTotalHours(hoursTotal);
        setAwardsCount(achievementCount ?? 0);
        setContinueTopic(continueData);
        setIsLoading(false);
      }
    };

    loadData();

    return () => {
      isActive = false;
    };
  }, [location.pathname]); // Refresh when navigating to dashboard

  // Refresh stats when component mounts or when user returns to this page
  useEffect(() => {
    const refreshStats = async () => {
      if (!supabase) return;

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      if (!userId) return;

      const [
        { data: studyRows },
        { count: achievementCount },
      ] = await Promise.all([
        supabase
          .from('study_sessions')
          .select('created_at,minutes')
          .eq('user_id', userId),
        supabase
          .from('user_achievements')
          .select('achievement_id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('unlocked', true),
      ]);

      // Recalculate streak
      const studyDates = (studyRows ?? [])
        .map((row) => new Date(row.created_at).toDateString())
        .filter((date, index, self) => self.indexOf(date) === index)
        .map((dateStr) => new Date(dateStr))
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

      const minutesTotal = (studyRows ?? []).reduce((sum, row) => sum + row.minutes, 0);
      const hoursTotal = Math.round((minutesTotal / 60) * 10) / 10;

      setStreakDays(streak);
      setTotalHours(hoursTotal);
      setAwardsCount(achievementCount ?? 0);
    };

    // Refresh when component becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshStats();
      }
    };

    // Refresh on focus (when user navigates back to tab)
    const handleFocus = () => {
      refreshStats();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Refresh data when component becomes visible (user navigates back to dashboard)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Reload data when page becomes visible
        const loadData = async () => {
          if (!supabase) return;

          const { data: userData } = await supabase.auth.getUser();
          const userId = userData?.user?.id;

          if (!userId) return;

          const [
            { data: studyRows },
            { count: achievementCount },
          ] = await Promise.all([
            supabase
              .from('study_sessions')
              .select('created_at,minutes')
              .eq('user_id', userId),
            supabase
              .from('user_achievements')
              .select('achievement_id', { count: 'exact', head: true })
              .eq('user_id', userId)
              .eq('unlocked', true),
          ]);

          // Recalculate streak
          const studyDates = (studyRows ?? [])
            .map((row) => new Date(row.created_at).toDateString())
            .filter((date, index, self) => self.indexOf(date) === index)
            .map((dateStr) => new Date(dateStr))
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

          const minutesTotal = (studyRows ?? []).reduce((sum, row) => sum + row.minutes, 0);

          setStreakDays(streak);
          setTotalHours(Math.round((minutesTotal / 60) * 10) / 10);
          setAwardsCount(achievementCount ?? 0);
        };

        loadData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const continueLessonLink = useMemo(() => {
    if (continueTopic) {
      return `/subjects/${continueTopic.subjectId}/${continueTopic.topicId}/lesson/${continueTopic.lessonId}`;
    }
    // Fallback to first lesson if no continue topic
    const firstTopic = topics[0];
    const firstLesson = lessons.find((lesson) => lesson.topic_id === firstTopic?.id);
    if (!firstTopic || !firstLesson) {
      return null;
    }
    return `/subjects/${firstTopic.subject_id}/${firstTopic.id}/lesson/${firstLesson.id}`;
  }, [continueTopic, topics, lessons]);

  return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 md:py-8 pb-10">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 sm:mb-6"
        >
          <h2 className="text-2xl sm:text-3xl font-semibold mb-1">
            Hey {profile.name}! 👋
          </h2>
          <p className="text-sm sm:text-base text-gray-500">Ready to learn something new?</p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1, type: 'spring' }}
              >
                <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-sm">
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br ${stat.gradient} rounded-xl sm:rounded-2xl flex items-center justify-center mb-2 sm:mb-3 shadow-lg`}>
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <p className="text-xl sm:text-2xl font-semibold mb-0.5">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Continue Learning Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              Continue Learning
            </h3>
          </div>
          <div className="bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-2xl sm:rounded-[32px] p-4 sm:p-6 shadow-2xl shadow-purple-500/20 relative overflow-hidden">
            {/* Decorative Elements */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
            
            <div className="relative">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="inline-block px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white text-xs mb-3">
                    {continueTopic?.topicName ?? topics[0]?.name ?? 'Subject'}
                  </div>
                  <h4 className="text-xl sm:text-2xl font-semibold text-white mb-2">Continue learning</h4>
                  <p className="text-white/80 text-xs sm:text-sm mb-3 sm:mb-4">Pick up where you left off.</p>
                </div>
              </div>
              <div className="mb-4">
                <div className="h-2 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${continueTopic?.progress ?? 0}%` }}
                    transition={{ delay: 0.5, duration: 1 }}
                    className="h-full bg-white rounded-full"
                  ></motion.div>
                </div>
                <p className="text-white/70 text-xs mt-2">{continueTopic?.progress ?? 0}% Complete</p>
              </div>
              <Button 
                onClick={() => continueLessonLink && navigate(continueLessonLink)}
                className="w-full h-12 sm:h-14 rounded-full bg-white hover:bg-gray-100 text-purple-600 font-semibold shadow-xl text-sm sm:text-base"
                disabled={!continueLessonLink}
              >
                Continue Lesson
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Subjects Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Your Subjects</h3>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/subjects')}
              className="text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-full"
            >
              View All
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          <div className="space-y-3">
            {isLoading && (
              <div className="bg-white rounded-3xl p-5 shadow-sm text-sm text-gray-500">
                Loading subjects...
              </div>
            )}
            {!isLoading && subjects.map((subject, index) => (
              <motion.div
                key={subject.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                onClick={() => navigate(`/subjects/${subject.id}`)}
                className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className={`w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br ${subject.color ?? 'from-blue-500 to-purple-500'} rounded-xl sm:rounded-[20px] flex items-center justify-center text-2xl sm:text-3xl shadow-lg flex-shrink-0`}>
                    {subject.icon ?? '📚'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-base sm:text-lg mb-1">
                      {subject.name}
                    </h4>
                    <p className="text-xs sm:text-sm text-gray-500 mb-1 sm:mb-2 line-clamp-2">{subject.description}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span>{topics.filter((topic) => topic.subject_id === subject.id).length} Topics</span>
                      <span>•</span>
                      <span>{lessons.filter((lesson) => {
                        const topic = topics.find((row) => row.id === lesson.topic_id);
                        return topic?.subject_id === subject.id;
                      }).length} Lessons</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Daily Report Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-6"
        >
          <DailyReport />
        </motion.div>

        {/* Leaderboard Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-6"
        >
          <Leaderboard metric="topics" limit={10} showCurrentUser={true} />
        </motion.div>
      </div>
  );
}
