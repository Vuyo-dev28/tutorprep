import { useEffect, useMemo, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import { Lock, Sparkles, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { checkAndAwardAchievements } from '@/lib/achievementService';

type AchievementRow = {
  id: string;
  title: string;
  description: string;
  icon: string | null;
};

type UserAchievementRow = {
  achievement_id: string;
  unlocked: boolean;
  unlocked_at: string | null;
};

export function AchievementsScreen() {
  const navigate = useNavigate();
  const [achievements, setAchievements] = useState<AchievementRow[]>([]);
  const [userAchievements, setUserAchievements] = useState<UserAchievementRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [newAchievementNotification, setNewAchievementNotification] = useState<{ title: string; icon: string | null } | null>(null);
  const previousUnlockedCountRef = useRef<number>(0);

  useEffect(() => {
    let isActive = true;

    const loadData = async () => {
      if (!supabase) {
        if (isActive) {
          setErrorMessage('Supabase is not configured.');
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setErrorMessage('');

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      if (!userId) {
        if (isActive) {
          setErrorMessage('Please sign in to view achievements.');
          setIsLoading(false);
        }
        return;
      }

      const [{ data: achievementRows }, { data: userRows }] = await Promise.all([
        supabase.from('achievements').select('id,title,description,icon'),
        supabase
          .from('user_achievements')
          .select('achievement_id,unlocked,unlocked_at')
          .eq('user_id', userId),
      ]);

      if (isActive) {
        setAchievements(achievementRows ?? []);
        setUserAchievements(userRows ?? []);
        setIsLoading(false);
      }
    };

    loadData();

    return () => {
      isActive = false;
    };
  }, []);

  // Check for new achievements and show notifications
  useEffect(() => {
    let isActive = true;
    let checkInterval: NodeJS.Timeout;

    const checkForNewAchievements = async () => {
      if (!supabase || isLoading) return;

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      if (!userId) return;

      // Check and award achievements
      const newlyUnlocked = await checkAndAwardAchievements(userId);

      if (newlyUnlocked.length > 0 && isActive) {
        // Reload user achievements to get the latest data
        const { data: userRows } = await supabase
          .from('user_achievements')
          .select('achievement_id, unlocked, unlocked_at')
          .eq('user_id', userId);

        if (isActive && userRows) {
          setUserAchievements(userRows);

          // Show notification for the first newly unlocked achievement
          const firstNewAchievement = achievements.find(a => newlyUnlocked.includes(a.title));
          if (firstNewAchievement) {
            setNewAchievementNotification({
              title: firstNewAchievement.title,
              icon: firstNewAchievement.icon,
            });

            // Auto-hide after 5 seconds
            setTimeout(() => {
              if (isActive) {
                setNewAchievementNotification(null);
              }
            }, 5000);
          }
        }
      }
    };

    // Check immediately on mount, then periodically
    if (!isLoading) {
      checkForNewAchievements();
      checkInterval = setInterval(checkForNewAchievements, 10000); // Check every 10 seconds
    }

    return () => {
      isActive = false;
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [isLoading, achievements]);

  const achievementMap = useMemo(() => {
    return userAchievements.reduce<Record<string, UserAchievementRow>>((acc, row) => {
      acc[row.achievement_id] = row;
      return acc;
    }, {});
  }, [userAchievements]);

  // Sort achievements: unlocked first, then locked
  const sortedAchievements = useMemo(() => {
    const unlocked = achievements.filter((achievement) => achievementMap[achievement.id]?.unlocked);
    const locked = achievements.filter((achievement) => !achievementMap[achievement.id]?.unlocked);
    
    // Sort unlocked by unlock date (most recent first)
    unlocked.sort((a, b) => {
      const aDate = achievementMap[a.id]?.unlocked_at;
      const bDate = achievementMap[b.id]?.unlocked_at;
      if (!aDate && !bDate) return 0;
      if (!aDate) return 1;
      if (!bDate) return -1;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });
    
    return [...unlocked, ...locked];
  }, [achievements, achievementMap]);

  const unlockedCount = sortedAchievements.filter(a => achievementMap[a.id]?.unlocked).length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading achievements...</div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="text-sm text-rose-500">{errorMessage}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <div className="max-w-6xl mx-auto px-6 pt-6">
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-3xl px-6 py-4">
          <div>
            <h1 className="font-semibold text-lg">Achievements</h1>
            <p className="text-xs text-gray-500">
              {unlockedCount} of {achievements.length} unlocked
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 pb-24">
        {/* Achievement Unlock Notification */}
        <AnimatePresence>
          {newAchievementNotification && (
            <motion.div
              initial={{ opacity: 0, y: -100, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -100, scale: 0.8 }}
              className="fixed top-24 left-1/2 transform -translate-x-1/2 z-50"
            >
              <div className="bg-gradient-to-br from-yellow-400 via-orange-400 to-red-400 rounded-3xl p-6 shadow-2xl text-white relative overflow-hidden min-w-[320px]">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full blur-2xl"></div>
                <div className="relative flex items-center gap-4">
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                    transition={{ duration: 0.5, repeat: 2 }}
                    className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-4xl shadow-lg flex-shrink-0"
                  >
                    {newAchievementNotification.icon ?? '🏆'}
                  </motion.div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-1">Achievement Unlocked!</h3>
                    <p className="text-white/90 text-sm">{newAchievementNotification.title}</p>
                  </div>
                  <button
                    onClick={() => setNewAchievementNotification(null)}
                    className="text-white/80 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header Card */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="bg-gradient-to-br from-yellow-400 via-orange-400 to-red-400 rounded-[32px] p-6 shadow-2xl text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
            <div className="relative flex items-center gap-4">
              <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-[26px] flex items-center justify-center text-4xl shadow-lg">
                🏆
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-semibold mb-1">Achievement Hunter</h2>
                <p className="text-white/90">
                  Complete challenges to unlock badges
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Achievements Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {sortedAchievements.map((achievement, index) => {
            const isUnlocked = achievementMap[achievement.id]?.unlocked;
            return (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.03 }}
                className="relative"
              >
                <div
                  className={`rounded-2xl p-4 shadow-lg transition-all ${
                    isUnlocked
                      ? 'bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-300'
                      : 'bg-gray-100 border-2 border-gray-200'
                  }`}
                >
                  <div className="flex flex-col items-center text-center">
                    <motion.div
                      className={`w-16 h-16 rounded-xl flex items-center justify-center text-3xl mb-3 ${
                        isUnlocked
                          ? 'bg-gradient-to-br from-yellow-400 to-orange-400 shadow-lg'
                          : 'bg-gray-200 grayscale opacity-50 relative'
                      }`}
                      animate={isUnlocked ? { rotate: [0, 5, -5, 0] } : {}}
                      transition={isUnlocked ? { duration: 2, repeat: Infinity, repeatDelay: 3 } : {}}
                    >
                      {achievement.icon ?? '🏆'}
                      {!isUnlocked && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Lock className="w-5 h-5 text-gray-400" />
                        </div>
                      )}
                    </motion.div>
                    <h4
                      className={`font-semibold text-sm mb-1 ${
                        isUnlocked ? 'text-gray-900' : 'text-gray-500'
                      }`}
                    >
                      {achievement.title}
                    </h4>
                    <p
                      className={`text-xs ${
                        isUnlocked ? 'text-gray-600' : 'text-gray-400'
                      }`}
                    >
                      {achievement.description}
                    </p>
                    {isUnlocked && achievementMap[achievement.id]?.unlocked_at && (
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(achievementMap[achievement.id].unlocked_at as string).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Motivational Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mt-8"
        >
          <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-[32px] p-6 shadow-2xl text-white text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
            <div className="relative">
              <p className="text-xl font-semibold mb-2">Keep Learning!</p>
              <p className="text-white/90">
                Complete more lessons to unlock new achievements
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
