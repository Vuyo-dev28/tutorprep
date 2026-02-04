import { useEffect, useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Trophy, Medal, Award, TrendingUp, Clock, BookOpen } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

type LeaderboardEntry = {
  userId: string;
  userName: string;
  rank: number;
  streak: number;
  totalHours: number;
  topicsCompleted: number;
  totalScore: number;
};

type LeaderboardProps = {
  metric: 'streak' | 'time' | 'topics' | 'score';
  limit?: number;
  showCurrentUser?: boolean;
};

export function Leaderboard({ metric = 'topics', limit = 10, showCurrentUser = true }: LeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [currentUserEntry, setCurrentUserEntry] = useState<LeaderboardEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const loadLeaderboard = async () => {
      if (!supabase) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        // Get current user
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;
        setCurrentUserId(userId);

        // Fetch all users' study data
        const [
          { data: allStudySessions, error: studyError },
          { data: allTopicProgress, error: topicError },
          { data: allQuizAttempts, error: quizError },
          { data: allProfiles, error: profileError },
        ] = await Promise.all([
          supabase.from('study_sessions').select('user_id,created_at,minutes'),
          supabase.from('user_topic_progress').select('user_id,completed').eq('completed', true),
          supabase.from('quiz_attempts').select('user_id,percentage'),
          supabase.from('profiles').select('id,full_name'),
        ]);

        // Log errors for debugging
        if (studyError) console.error('Error fetching study sessions:', studyError);
        if (topicError) console.error('Error fetching topic progress:', topicError);
        if (quizError) console.error('Error fetching quiz attempts:', quizError);
        if (profileError) console.error('Error fetching profiles:', profileError);

        // Calculate stats for each user
        const userStatsMap = new Map<string, {
          streak: number;
          totalMinutes: number;
          topicsCompleted: number;
          totalScore: number;
          userName: string;
        }>();

        // Initialize all users
        (allProfiles ?? []).forEach(profile => {
          userStatsMap.set(profile.id, {
            streak: 0,
            totalMinutes: 0,
            topicsCompleted: 0,
            totalScore: 0,
            userName: profile.full_name || 'Student',
          });
        });

        // Calculate streaks for each user
        const userStudyDates = new Map<string, string[]>();
        (allStudySessions ?? []).forEach(session => {
          if (!userStudyDates.has(session.user_id)) {
            userStudyDates.set(session.user_id, []);
          }
          const dateStr = new Date(session.created_at).toDateString();
          userStudyDates.get(session.user_id)!.push(dateStr);
        });

        userStudyDates.forEach((dates, userId) => {
          const uniqueDates = [...new Set(dates)]
            .map(d => new Date(d))
            .sort((a, b) => b.getTime() - a.getTime());

          let streak = 0;
          if (uniqueDates.length > 0) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            const mostRecentDate = new Date(uniqueDates[0]);
            mostRecentDate.setHours(0, 0, 0, 0);

            if (mostRecentDate.getTime() === today.getTime() || mostRecentDate.getTime() === yesterday.getTime()) {
              streak = 1;
              let checkDate = new Date(mostRecentDate);
              for (let i = 0; i < uniqueDates.length; i++) {
                const studyDate = new Date(uniqueDates[i]);
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

          const stats = userStatsMap.get(userId);
          if (stats) {
            stats.streak = streak;
          }
        });

        // Calculate total minutes for each user
        (allStudySessions ?? []).forEach(session => {
          const stats = userStatsMap.get(session.user_id);
          if (stats) {
            stats.totalMinutes += session.minutes;
          }
        });

        // Calculate topics completed
        (allTopicProgress ?? []).forEach(progress => {
          const stats = userStatsMap.get(progress.user_id);
          if (stats) {
            stats.topicsCompleted += 1;
          }
        });

        // Calculate average quiz score
        const userQuizScores = new Map<string, { total: number; count: number }>();
        (allQuizAttempts ?? []).forEach(attempt => {
          if (!userQuizScores.has(attempt.user_id)) {
            userQuizScores.set(attempt.user_id, { total: 0, count: 0 });
          }
          const scoreData = userQuizScores.get(attempt.user_id)!;
          scoreData.total += attempt.percentage;
          scoreData.count += 1;
        });

        userQuizScores.forEach((scoreData, userId) => {
          const stats = userStatsMap.get(userId);
          if (stats) {
            stats.totalScore = scoreData.count > 0 ? Math.round(scoreData.total / scoreData.count) : 0;
          }
        });

        // Convert to array and sort by selected metric
        const entries: LeaderboardEntry[] = Array.from(userStatsMap.entries()).map(([userId, stats]) => ({
          userId,
          userName: stats.userName,
          rank: 0, // Will be set after sorting
          streak: stats.streak,
          totalHours: Math.round((stats.totalMinutes / 60) * 10) / 10,
          topicsCompleted: stats.topicsCompleted,
          totalScore: stats.totalScore,
        }));

        // Sort by selected metric
        entries.sort((a, b) => {
          switch (metric) {
            case 'streak':
              return b.streak - a.streak;
            case 'time':
              return b.totalHours - a.totalHours;
            case 'topics':
              return b.topicsCompleted - a.topicsCompleted;
            case 'score':
              return b.totalScore - a.totalScore;
            default:
              return 0;
          }
        });

        // Assign ranks
        entries.forEach((entry, index) => {
          entry.rank = index + 1;
        });

        // Find current user's entry
        let userEntry: LeaderboardEntry | null = null;
        if (userId && showCurrentUser) {
          userEntry = entries.find(e => e.userId === userId) || null;
          setCurrentUserEntry(userEntry);
        }

        // Show only top 10 (limit) - always show top 10, regardless of current user
        const topEntries = entries.slice(0, limit);
        setLeaderboard(topEntries);
      } catch (error) {
        console.error('Error loading leaderboard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadLeaderboard();
  }, [metric, limit, showCurrentUser]);

  const getMetricLabel = () => {
    switch (metric) {
      case 'streak':
        return 'Streak';
      case 'time':
        return 'Study Time';
      case 'topics':
        return 'Topics Completed';
      case 'score':
        return 'Average Score';
      default:
        return '';
    }
  };

  const getMetricValue = (entry: LeaderboardEntry) => {
    switch (metric) {
      case 'streak':
        return `${entry.streak}d`;
      case 'time':
        return `${entry.totalHours.toFixed(1)}h`;
      case 'topics':
        return `${entry.topicsCompleted}`;
      case 'score':
        return `${entry.totalScore}%`;
      default:
        return '';
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Award className="w-5 h-5 text-amber-600" />;
    return <span className="w-6 h-6 flex items-center justify-center text-sm font-semibold text-gray-400">#{rank}</span>;
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'bg-gradient-to-br from-yellow-400 to-yellow-600';
    if (rank === 2) return 'bg-gradient-to-br from-gray-300 to-gray-500';
    if (rank === 3) return 'bg-gradient-to-br from-amber-400 to-amber-600';
    return 'bg-gray-100';
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-3xl p-6 shadow-sm">
        <div className="text-sm text-gray-500 text-center py-8">Loading leaderboard...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Leaderboard - {getMetricLabel()}
        </h3>
      </div>

      <div className="space-y-2">
        {leaderboard.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            No leaderboard data available yet. Start studying to climb the ranks!
          </div>
        ) : (
          leaderboard.map((entry, index) => {
            const isCurrentUser = entry.userId === currentUserId;
            return (
              <motion.div
                key={entry.userId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex items-center gap-4 p-4 rounded-2xl transition-all ${
                  isCurrentUser
                    ? 'bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200'
                    : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${getRankColor(entry.rank)}`}>
                  {getRankIcon(entry.rank)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`font-semibold ${isCurrentUser ? 'text-blue-700' : 'text-gray-900'}`}>
                      {entry.userName}
                      {isCurrentUser && <span className="ml-2 text-xs text-blue-600">(You)</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {entry.streak}d streak
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {entry.totalHours.toFixed(1)}h
                    </span>
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3 h-3" />
                      {entry.topicsCompleted} topics
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold text-gray-900">{getMetricValue(entry)}</p>
                  <p className="text-xs text-gray-500">{getMetricLabel()}</p>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Show current user's ranking separately if they're not in top 10 */}
      {currentUserEntry && 
       currentUserEntry.rank > limit && 
       !leaderboard.some(e => e.userId === currentUserEntry!.userId) &&
       showCurrentUser && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-sm font-medium text-gray-600 mb-3">Your Ranking</p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200"
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-100">
              <span className="w-6 h-6 flex items-center justify-center text-sm font-semibold text-gray-600">
                #{currentUserEntry.rank}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-blue-700">
                  {currentUserEntry.userName}
                  <span className="ml-2 text-xs text-blue-600">(You)</span>
                </p>
              </div>
              <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  {currentUserEntry.streak}d streak
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {currentUserEntry.totalHours.toFixed(1)}h
                </span>
                <span className="flex items-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  {currentUserEntry.topicsCompleted} topics
                </span>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-lg font-bold text-gray-900">{getMetricValue(currentUserEntry)}</p>
              <p className="text-xs text-gray-500">{getMetricLabel()}</p>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
