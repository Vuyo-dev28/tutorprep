import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import { 
  TrendingUp, 
  Calendar,
  Target,
  Award,
  Clock,
  Flame,
  Zap,
  Download,
  Printer
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/lib/supabaseClient';
import { Leaderboard } from '@/app/components/Leaderboard';

type SubjectRow = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
};

type TopicRow = {
  id: string;
  subject_id: string;
};

type TopicProgressRow = {
  topic_id: string;
  completed: boolean;
};

type QuizAttemptRow = {
  id: string;
  topic_id: string;
  score: number;
  total_questions: number;
  percentage: number;
  created_at: string;
};

type StudySessionRow = {
  minutes: number;
  created_at: string;
};

function isoDateOnly(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfDay(d: Date) {
  const next = new Date(d);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(d: Date, days: number) {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function getHeatColor(minutes: number) {
  // GitHub-ish 5 levels
  if (minutes <= 0) return 'bg-gray-100';
  if (minutes < 15) return 'bg-green-100';
  if (minutes < 45) return 'bg-green-300';
  if (minutes < 90) return 'bg-green-500';
  return 'bg-green-700';
}

export function ProgressScreen() {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [topicProgress, setTopicProgress] = useState<TopicProgressRow[]>([]);
  const [quizAttempts, setQuizAttempts] = useState<QuizAttemptRow[]>([]);
  const [studySessions, setStudySessions] = useState<StudySessionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

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
          setErrorMessage('Please sign in to view progress.');
          setIsLoading(false);
        }
        return;
      }

      const [
        { data: subjectRows },
        { data: topicRows },
        { data: progressRows },
        { data: quizRows },
        { data: sessionRows },
      ] = await Promise.all([
        supabase.from('subjects').select('id,name,icon,color').order('sort_order'),
        supabase.from('topics').select('id,subject_id,name'),
        supabase.from('user_topic_progress').select('topic_id,completed').eq('user_id', userId),
        supabase
          .from('quiz_attempts')
          .select('id,topic_id,score,total_questions,percentage,created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        (() => {
          // Load enough sessions to draw a GitHub-style heatmap (last 52 weeks)
          const start = startOfDay(addDays(new Date(), -7 * 52));
          return supabase
            .from('study_sessions')
            .select('minutes,created_at')
            .eq('user_id', userId)
            .gte('created_at', start.toISOString())
            .order('created_at', { ascending: false });
        })(),
      ]);

      if (isActive) {
        setSubjects(subjectRows ?? []);
        setTopics(topicRows ?? []);
        setTopicProgress(progressRows ?? []);
        setQuizAttempts(quizRows ?? []);
        setStudySessions(sessionRows ?? []);
        setIsLoading(false);
      }
    };

    loadData();

    return () => {
      isActive = false;
    };
  }, []);

  const chartData = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const totals = days.reduce<Record<string, number>>((acc, day) => {
      acc[day] = 0;
      return acc;
    }, {});

    studySessions.forEach((session) => {
      const date = new Date(session.created_at);
      const day = days[date.getDay() === 0 ? 6 : date.getDay() - 1];
      totals[day] += session.minutes / 60;
    });

    return days.map((day) => ({ day, hours: Number(totals[day].toFixed(1)) }));
  }, [studySessions]);

  const completedTopics = useMemo(() => {
    return topicProgress.filter((row) => row.completed).length;
  }, [topicProgress]);

  const averageScore = useMemo(() => {
    if (!quizAttempts.length) {
      return 0;
    }
    const total = quizAttempts.reduce((sum, attempt) => sum + attempt.percentage, 0);
    return Math.round(total / quizAttempts.length);
  }, [quizAttempts]);

  const totalTimeHours = useMemo(() => {
    const minutes = studySessions.reduce((sum, session) => sum + session.minutes, 0);
    return Math.round((minutes / 60) * 10) / 10;
  }, [studySessions]);

  const streakDays = useMemo(() => {
    const uniqueDays = new Set(
      studySessions.map((session) => new Date(session.created_at).toDateString())
    );
    return uniqueDays.size;
  }, [studySessions]);

  const heatmap = useMemo(() => {
    // Build a 52-week grid (weeks x 7 days), ending today.
    const end = startOfDay(new Date());
    const start = startOfDay(addDays(end, -(7 * 52) + 1));

    const totalsByDay = new Map<string, number>();
    for (const session of studySessions) {
      const key = isoDateOnly(new Date(session.created_at));
      totalsByDay.set(key, (totalsByDay.get(key) ?? 0) + session.minutes);
    }

    const days: { date: Date; minutes: number }[] = [];
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      const key = isoDateOnly(d);
      days.push({ date: new Date(d), minutes: totalsByDay.get(key) ?? 0 });
    }

    // Align to Sunday-start grid like GitHub (Sun..Sat)
    const startDow = days[0]?.date.getDay() ?? 0; // 0=Sun
    const padded: { date: Date | null; minutes: number }[] = [];
    for (let i = 0; i < startDow; i++) padded.push({ date: null, minutes: 0 });
    padded.push(...days.map((x) => ({ date: x.date, minutes: x.minutes })));

    const weeks: { date: Date | null; minutes: number }[][] = [];
    for (let i = 0; i < padded.length; i += 7) {
      weeks.push(padded.slice(i, i + 7));
    }

    // Month labels (first week that contains a day in that month)
    const monthLabels: { weekIndex: number; label: string }[] = [];
    const seen = new Set<string>();
    weeks.forEach((week, idx) => {
      const firstReal = week.find((d) => d.date);
      if (!firstReal?.date) return;
      const m = firstReal.date.toLocaleString(undefined, { month: 'short' });
      const key = `${firstReal.date.getFullYear()}-${firstReal.date.getMonth()}`;
      if (!seen.has(key)) {
        seen.add(key);
        monthLabels.push({ weekIndex: idx, label: m });
      }
    });

    return { weeks, monthLabels };
  }, [studySessions]);

  const stats = [
    { 
      label: 'Study Streak', 
      value: String(streakDays), 
      unit: 'days',
      icon: Flame, 
      gradient: 'from-orange-400 to-orange-600'
    },
    { 
      label: 'Total Time', 
      value: String(totalTimeHours), 
      unit: 'hours',
      icon: Clock, 
      gradient: 'from-blue-400 to-blue-600'
    },
    { 
      label: 'Topics Done', 
      value: `${completedTopics}/${topics.length}`, 
      unit: '',
      icon: Target, 
      gradient: 'from-green-400 to-green-600'
    },
    { 
      label: 'Avg. Score', 
      value: String(averageScore), 
      unit: '%',
      icon: Award, 
      gradient: 'from-purple-400 to-purple-600'
    },
  ];

  const exportToCSV = () => {
    const csvRows: string[] = [];
    
    // Header
    csvRows.push('Progress Report');
    csvRows.push(`Generated: ${new Date().toLocaleDateString()}`);
    csvRows.push('');
    
    // Stats
    csvRows.push('Statistics');
    csvRows.push('Metric,Value');
    csvRows.push(`Study Streak,${streakDays} days`);
    csvRows.push(`Total Time,${totalTimeHours} hours`);
    csvRows.push(`Topics Completed,${completedTopics}/${topics.length}`);
    csvRows.push(`Average Quiz Score,${averageScore}%`);
    csvRows.push('');
    
    // Quiz Attempts
    csvRows.push('Quiz Attempts');
    csvRows.push('Date,Topic,Score,Percentage,Total Questions');
    quizAttempts.forEach(attempt => {
      const topic = topics.find(t => t.id === attempt.topic_id);
      const date = new Date(attempt.created_at).toLocaleDateString();
      csvRows.push(`${date},"${topic?.name || 'Unknown'}",${attempt.score},${attempt.percentage}%,${attempt.total_questions}`);
    });
    csvRows.push('');
    
    // Subject Progress
    csvRows.push('Subject Progress');
    csvRows.push('Subject,Completed Topics,Total Topics,Progress %');
    subjects.forEach(subject => {
      const subjectTopics = topics.filter(t => t.subject_id === subject.id);
      const completedSubjectTopics = topicProgress.filter(
        (row) => subjectTopics.some((topic) => topic.id === row.topic_id) && row.completed
      ).length;
      const progressPercent = subjectTopics.length
        ? (completedSubjectTopics / subjectTopics.length) * 100
        : 0;
      csvRows.push(`"${subject.name}",${completedSubjectTopics},${subjectTopics.length},${Math.round(progressPercent)}%`);
    });
    
    // Create and download
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `progress-report-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading progress...</div>
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl sm:rounded-3xl px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <div>
              <h1 className="font-semibold text-base sm:text-lg">Your Progress</h1>
              <p className="text-xs text-gray-500">Track your learning journey</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToCSV()}
                className="rounded-full flex-1 sm:flex-none text-xs sm:text-sm"
              >
                <Download className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Export CSV</span>
                <span className="sm:hidden">Export</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="rounded-full flex-1 sm:flex-none text-xs sm:text-sm"
              >
                <Printer className="w-4 h-4 mr-1 sm:mr-2" />
                Print
              </Button>
            </div>
          </div>
        </div>

        {/* GitHub-style activity heatmap */}
        <div className="mt-4 sm:mt-6 bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-500" />
                <h2 className="font-semibold">Activity</h2>
              </div>
              <p className="text-xs text-gray-500 mt-1">Green squares mean you studied that day</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>Less</span>
              <div className="w-3 h-3 rounded bg-gray-100" />
              <div className="w-3 h-3 rounded bg-green-100" />
              <div className="w-3 h-3 rounded bg-green-300" />
              <div className="w-3 h-3 rounded bg-green-500" />
              <div className="w-3 h-3 rounded bg-green-700" />
              <span>More</span>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <div className="min-w-[900px]">
              {/* Month labels */}
              <div className="flex gap-1 ml-10 mb-2 text-[11px] text-gray-400">
                {Array.from({ length: heatmap.weeks.length }).map((_, idx) => {
                  const label = heatmap.monthLabels.find((m) => m.weekIndex === idx)?.label;
                  return (
                    <div key={idx} className="w-3">
                      {label ? label : ''}
                    </div>
                  );
                })}
              </div>

              <div className="flex">
                {/* Day labels */}
                <div className="w-10 pr-2 text-[11px] text-gray-400 leading-3">
                  <div className="h-3" />
                  <div className="h-3 mt-1">Mon</div>
                  <div className="h-3 mt-1" />
                  <div className="h-3 mt-1">Wed</div>
                  <div className="h-3 mt-1" />
                  <div className="h-3 mt-1">Fri</div>
                  <div className="h-3 mt-1" />
                </div>

                {/* Grid */}
                <div className="flex gap-1">
                  {heatmap.weeks.map((week, wIdx) => (
                    <div key={wIdx} className="flex flex-col gap-1">
                      {week.map((cell, dIdx) => {
                        const label = cell.date
                          ? `${cell.minutes} min on ${cell.date.toLocaleDateString()}`
                          : '';
                        return (
                          <div
                            key={`${wIdx}-${dIdx}`}
                            title={label}
                            className={[
                              'w-3 h-3 rounded-sm',
                              cell.date ? getHeatColor(cell.minutes) : 'bg-transparent',
                              cell.date ? 'ring-1 ring-black/5' : '',
                            ].join(' ')}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-20 sm:pb-24">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4 sm:mb-6">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1, type: 'spring' }}
              >
                <div className="bg-white rounded-2xl sm:rounded-[28px] p-4 sm:p-5 shadow-sm">
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br ${stat.gradient} rounded-xl sm:rounded-[18px] flex items-center justify-center mb-2 sm:mb-3 shadow-lg`}>
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
                  <p className="text-2xl sm:text-3xl font-semibold">
                    {stat.value}
                    <span className="text-xs sm:text-sm text-gray-400 ml-1">{stat.unit}</span>
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Weekly Activity Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-6"
        >
          <div className="bg-white rounded-[32px] p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-semibold">Weekly Activity</h3>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: 'none',
                    borderRadius: '16px',
                    boxShadow: '0 10px 40px -10px rgba(0,0,0,0.2)'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="hours" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorHours)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Subject Progress */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold">Subject Progress</h3>
          </div>

          <div className="space-y-3">
            {subjects.map((subject, index) => {
              const subjectTopics = topics.filter(t => t.subject_id === subject.id);
              const completedSubjectTopics = topicProgress.filter(
                (row) => subjectTopics.some((topic) => topic.id === row.topic_id) && row.completed
              ).length;
              const progressPercent = subjectTopics.length
                ? (completedSubjectTopics / subjectTopics.length) * 100
                : 0;

              return (
                <motion.div
                  key={subject.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + index * 0.1 }}
                >
                  <div className="bg-white rounded-[28px] p-5 shadow-sm">
                    <div className="flex items-center gap-4 mb-3">
                      <div className={`w-14 h-14 bg-gradient-to-br ${subject.color ?? 'from-blue-500 to-purple-500'} rounded-[20px] flex items-center justify-center text-2xl shadow-lg flex-shrink-0`}>
                        {subject.icon ?? '📚'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold mb-1">{subject.name}</h4>
                        <p className="text-sm text-gray-500">
                          {completedSubjectTopics} of {subjectTopics.length} topics completed
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-2xl font-bold bg-gradient-to-br from-blue-500 to-purple-600 bg-clip-text text-transparent">
                          {Math.round(progressPercent)}%
                        </p>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ delay: 0.8 + index * 0.1, duration: 1 }}
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"
                      ></motion.div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold">Recent Activity</h3>
          </div>
          <div className="space-y-3">
            {quizAttempts.slice(0, 3).map((attempt, index) => {
              const topic = topics.find((row) => row.id === attempt.topic_id);
              const subject = subjects.find((row) => row.id === topic?.subject_id);
              const timestamp = new Date(attempt.created_at);
              const timeLabel = timestamp.toLocaleDateString();
              return (
              <motion.div
                key={attempt.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.9 + index * 0.1 }}
              >
                <div className="bg-white rounded-[24px] p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mt-2 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium mb-1">Completed quiz</p>
                      <p className="text-sm text-gray-500">
                        {subject?.name ?? 'Subject'} • {topic?.name ?? 'Topic'}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <p className="text-xs text-gray-400">{timeLabel}</p>
                            <span className="text-xs text-gray-300">•</span>
                        <p className="text-xs text-green-600 font-medium">{attempt.percentage}%</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
            })}
            {!quizAttempts.length && (
              <div className="bg-white rounded-[24px] p-4 shadow-sm text-sm text-gray-500">
                No recent activity yet.
              </div>
            )}
          </div>
        </motion.div>

        {/* Leaderboard Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="mt-6"
        >
          <Leaderboard metric="topics" limit={10} showCurrentUser={true} />
        </motion.div>
      </div>
    </div>
  );
}
