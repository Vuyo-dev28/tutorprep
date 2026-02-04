import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Progress } from '@/app/components/ui/progress';
import { BookOpen, Play, CheckCircle2, Lock, ArrowLeft, Search, X } from 'lucide-react';
import { Input } from '@/app/components/ui/input';
import { supabase } from '@/lib/supabaseClient';

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
  description: string | null;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
};

type TopicProgressRow = {
  topic_id: string;
  progress: number;
  completed: boolean;
};

type LessonProgressRow = {
  lesson_id: string;
  completed: boolean;
};

type QuizAttemptRow = {
  topic_id: string;
  percentage: number;
  score: number;
  total_questions: number;
};

export function SubjectsScreen() {
  const navigate = useNavigate();
  const { subjectId } = useParams();
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [topicProgress, setTopicProgress] = useState<TopicProgressRow[]>([]);
  const [lessonProgress, setLessonProgress] = useState<LessonProgressRow[]>([]);
  const [quizAttempts, setQuizAttempts] = useState<QuizAttemptRow[]>([]);
  const [lessonsByTopic, setLessonsByTopic] = useState<Record<string, number>>({});
  const [completedLessonsByTopic, setCompletedLessonsByTopic] = useState<Record<string, number>>({});
  const [lessonsCountBySubject, setLessonsCountBySubject] = useState<Record<string, number>>({});
  const [questionsCountBySubject, setQuestionsCountBySubject] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const topicProgressMap = useMemo(() => {
    return topicProgress.reduce<Record<string, TopicProgressRow>>((acc, row) => {
      acc[row.topic_id] = row;
      return acc;
    }, {});
  }, [topicProgress]);

  // Calculate lesson progress per topic
  const lessonProgressByTopic = useMemo(() => {
    const progressMap: Record<string, { completed: number; total: number }> = {};
    
    topics.forEach(topic => {
      const totalLessons = lessonsByTopic[topic.id] || 0;
      const completed = completedLessonsByTopic[topic.id] || 0;
      progressMap[topic.id] = { completed, total: totalLessons };
    });
    
    return progressMap;
  }, [lessonsByTopic, completedLessonsByTopic, topics]);

  // Get best quiz score per topic
  const bestQuizScoreByTopic = useMemo(() => {
    const scoreMap: Record<string, number> = {};
    quizAttempts.forEach(attempt => {
      if (!scoreMap[attempt.topic_id] || attempt.percentage > scoreMap[attempt.topic_id]) {
        scoreMap[attempt.topic_id] = attempt.percentage;
      }
    });
    return scoreMap;
  }, [quizAttempts]);

  // Filter subjects and topics based on search query - MUST be before any early returns
  const filteredSubjects = useMemo(() => {
    if (!searchQuery.trim()) return subjects;
    const query = searchQuery.toLowerCase();
    return subjects.filter(subject => 
      subject.name.toLowerCase().includes(query) ||
      subject.description?.toLowerCase().includes(query) ||
      topics.some(t => t.subject_id === subject.id && (
        t.name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query)
      ))
    );
  }, [subjects, topics, searchQuery]);

  const filteredTopics = useMemo(() => {
    if (!subjectId) return [];
    if (!searchQuery.trim()) {
      return topics.filter((t) => t.subject_id === subjectId);
    }
    const query = searchQuery.toLowerCase();
    return topics.filter(topic =>
      topic.subject_id === subjectId && (
        topic.name.toLowerCase().includes(query) ||
        topic.description?.toLowerCase().includes(query)
      )
    );
  }, [subjectId, topics, searchQuery]);

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

      // Only load topics for the selected subject if subjectId is provided
      const [{ data: subjectsData, error: subjectsError }, { data: topicsData, error: topicsError }] =
        await Promise.all([
          supabase.from('subjects').select('id,name,description,icon,color').order('sort_order'),
          subjectId
            ? supabase.from('topics').select('id,subject_id,name,description,difficulty').eq('subject_id', subjectId).order('sort_order')
            : supabase.from('topics').select('id,subject_id,name,description,difficulty').order('sort_order'),
        ]);

      if (subjectsError || topicsError) {
        if (isActive) {
          setErrorMessage(subjectsError?.message || topicsError?.message || 'Unable to load subjects.');
          setIsLoading(false);
        }
        return;
      }

      // Only load data for topics in the selected subject (or all if no subject selected)
      const relevantTopics = subjectId 
        ? (topicsData ?? []).filter(t => t.subject_id === subjectId)
        : (topicsData ?? []);
      const topicIds = relevantTopics.map((topic) => topic.id);

      const userResult = await supabase.auth.getUser();
      const userId = userResult.data?.user?.id;
      
      // Only fetch data if we have topics to work with
      const [{ data: progressRows }, { data: lessonsRows }, { data: questionRows }, { data: lessonProgressRows }, { data: quizAttemptRows }] = await Promise.all([
        userId && topicIds.length > 0
          ? supabase
              .from('user_topic_progress')
              .select('topic_id,progress,completed')
              .eq('user_id', userId)
              .in('topic_id', topicIds) // Only fetch progress for relevant topics
          : Promise.resolve({ data: [] as TopicProgressRow[] }),
        topicIds.length > 0
          ? supabase.from('lessons').select('id,topic_id').in('topic_id', topicIds) // Only fetch lessons for relevant topics
          : Promise.resolve({ data: [] as { id: string; topic_id: string }[] }),
        topicIds.length > 0
          ? supabase.from('questions').select('id,topic_id').in('topic_id', topicIds) // Only fetch questions for relevant topics
          : Promise.resolve({ data: [] as { id: string; topic_id: string }[] }),
        userId && topicIds.length > 0
          ? supabase
              .from('user_lesson_progress')
              .select('lesson_id,completed')
              .eq('user_id', userId)
          : Promise.resolve({ data: [] as LessonProgressRow[] }),
        userId && topicIds.length > 0
          ? supabase
              .from('quiz_attempts')
              .select('topic_id,percentage,score,total_questions')
              .eq('user_id', userId)
              .in('topic_id', topicIds)
              .order('percentage', { ascending: false })
          : Promise.resolve({ data: [] as QuizAttemptRow[] }),
      ]);

      // Use topicsData for counting (it's already filtered if subjectId is set)
      const lessonCountBySubject = (lessonsRows ?? []).reduce<Record<string, number>>((acc, row) => {
        const topic = (topicsData ?? []).find((item) => item.id === row.topic_id);
        if (!topic) {
          return acc;
        }
        acc[topic.subject_id] = (acc[topic.subject_id] || 0) + 1;
        return acc;
      }, {});

      const questionCountBySubject = (questionRows ?? []).reduce<Record<string, number>>((acc, row) => {
        const topic = (topicsData ?? []).find((item) => item.id === row.topic_id);
        if (!topic) {
          return acc;
        }
        acc[topic.subject_id] = (acc[topic.subject_id] || 0) + 1;
        return acc;
      }, {});

      // Count lessons per topic
      const lessonsByTopicCount = (lessonsRows ?? []).reduce<Record<string, number>>((acc, row) => {
        acc[row.topic_id] = (acc[row.topic_id] || 0) + 1;
        return acc;
      }, {});

      // Calculate completed lessons per topic
      const completedLessonsByTopicCount: Record<string, number> = {};
      (lessonsRows ?? []).forEach(lesson => {
        const isCompleted = (lessonProgressRows ?? []).some(lp => lp.lesson_id === lesson.id && lp.completed);
        if (isCompleted) {
          completedLessonsByTopicCount[lesson.topic_id] = (completedLessonsByTopicCount[lesson.topic_id] || 0) + 1;
        }
      });

      if (isActive) {
        setSubjects(subjectsData ?? []);
        setTopics(topicsData ?? []);
        setTopicProgress(progressRows ?? []);
        setLessonProgress(lessonProgressRows ?? []);
        setQuizAttempts(quizAttemptRows ?? []);
        setLessonsByTopic(lessonsByTopicCount);
        setLessonsCountBySubject(lessonCountBySubject);
        setQuestionsCountBySubject(questionCountBySubject);
        // Store completed lessons count
        setCompletedLessonsByTopic(completedLessonsByTopicCount);
        setIsLoading(false);
      }
    };

    loadData();

    return () => {
      isActive = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading subjects...</div>
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

  // If no subjectId, show all subjects
  if (!subjectId) {
    return (
      <div className="min-h-screen bg-[#f5f5f7]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
          <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl sm:rounded-3xl px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <div>
                <h1 className="font-semibold text-base sm:text-lg">All Subjects</h1>
                <p className="text-xs text-gray-500">Choose a subject to explore</p>
              </div>
              <div className="w-full sm:flex-1 sm:max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search subjects and topics..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-10 h-10 sm:h-11 rounded-xl bg-gray-50 border-0 focus:bg-white focus:ring-2 focus:ring-blue-600 text-sm sm:text-base"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          {filteredSubjects.length === 0 ? (
            <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-center">
              <p className="text-sm sm:text-base text-gray-500">No subjects found matching "{searchQuery}"</p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {filteredSubjects.map((subject, index) => (
                <motion.div
                  key={subject.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => navigate(`/subjects/${subject.id}`)}
                  className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
                >
                  <div className="flex items-start gap-3 sm:gap-4 mb-3 sm:mb-4">
                    <div className={`w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br ${subject.color ?? 'from-blue-500 to-purple-500'} rounded-2xl sm:rounded-[24px] flex items-center justify-center text-3xl sm:text-4xl shadow-lg flex-shrink-0`}>
                      {subject.icon ?? '📚'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl sm:text-2xl font-semibold mb-1 sm:mb-2">{subject.name}</h3>
                      <p className="text-xs sm:text-sm text-gray-500 line-clamp-2">{subject.description}</p>
                    </div>
                  </div>
                <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-400 flex-wrap">
                  <span>{topics.filter((topic) => topic.subject_id === subject.id).length} Topics</span>
                  <span>•</span>
                  <span>{lessonsCountBySubject[subject.id] ?? 0} Lessons</span>
                  <span>•</span>
                  <span>{questionsCountBySubject[subject.id] ?? 0} Questions</span>
                </div>
              </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show specific subject with topics
  const subject = subjects.find((s) => s.id === subjectId);
  const subjectTopics = topics.filter((t) => t.subject_id === subjectId);

  if (!subject) {
    return <div>Subject not found</div>;
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-100 text-green-700';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-700';
      case 'advanced':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl sm:rounded-3xl px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/subjects')}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
            </motion.button>
            <div className={`w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br ${subject.color ?? 'from-blue-500 to-purple-500'} rounded-xl sm:rounded-2xl flex items-center justify-center text-xl sm:text-2xl shadow-lg flex-shrink-0`}>
              {subject.icon ?? '📚'}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold text-base sm:text-lg truncate">{subject.name}</h1>
              <p className="text-xs text-gray-500">{subjectTopics.length} topics available</p>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10 h-10 sm:h-11 rounded-xl bg-gray-50 border-0 focus:bg-white focus:ring-2 focus:ring-blue-600 text-sm sm:text-base"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-20 sm:pb-24">
        {/* Subject Overview */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 sm:mb-6"
        >
          <div className={`bg-gradient-to-br ${subject.color ?? 'from-blue-500 to-purple-500'} rounded-2xl sm:rounded-[32px] p-4 sm:p-6 shadow-2xl text-white relative overflow-hidden`}>
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            <div className="relative">
              <h2 className="text-xl sm:text-2xl font-semibold mb-2">Master {subject.name}</h2>
              <p className="text-white/80 text-sm sm:text-base mb-3 sm:mb-4">{subject.description}</p>
              <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm text-white/90 flex-wrap">
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  <BookOpen className="w-4 h-4" />
                  <span>{subjectTopics.length} Topics</span>
                </div>
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  <Play className="w-4 h-4" />
                  <span>{lessonsCountBySubject[subject.id] ?? 0} Lessons</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Topics List */}
        <div className="space-y-2 sm:space-y-3">
          {filteredTopics.length === 0 ? (
            <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-center">
              <p className="text-sm sm:text-base text-gray-500">No topics found matching "{searchQuery}"</p>
            </div>
          ) : (
            filteredTopics.map((topic, index) => (
            <motion.div
              key={topic.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => navigate(`/subjects/${subjectId}/${topic.id}`)}
              className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
            >
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gray-100 rounded-xl sm:rounded-[18px] flex items-center justify-center flex-shrink-0">
                  {topicProgressMap[topic.id]?.completed ? (
                    <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 text-green-500" />
                  ) : (topicProgressMap[topic.id]?.progress ?? 0) > 0 ? (
                    <Play className="w-6 h-6 sm:w-7 sm:h-7 text-blue-500" />
                  ) : (
                    <Lock className="w-6 h-6 sm:w-7 sm:h-7 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1 sm:mb-2">
                    <h4 className="font-semibold text-base sm:text-lg truncate">
                      {topic.name}
                    </h4>
                    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 flex-wrap">
                    <Badge className={`${getDifficultyColor(topic.difficulty)} rounded-full px-2 sm:px-3 text-xs`}>
                      {topic.difficulty}
                    </Badge>
                      {topicProgressMap[topic.id]?.completed ? (
                        <Badge className="bg-green-100 text-green-700 rounded-full px-2 sm:px-3 text-xs">
                          Complete
                        </Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-600 rounded-full px-2 sm:px-3 text-xs">
                          Incomplete
                        </Badge>
                      )}
                      {bestQuizScoreByTopic[topic.id] !== undefined && (
                        <Badge className="bg-purple-100 text-purple-700 rounded-full px-2 sm:px-3 text-xs">
                          {bestQuizScoreByTopic[topic.id]}%
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-500 mb-2 sm:mb-3 line-clamp-2">{topic.description}</p>
                  {(() => {
                    const lessonProgress = lessonProgressByTopic[topic.id];
                    const hasLessonProgress = lessonProgress && lessonProgress.total > 0;
                    const hasTopicProgress = (topicProgressMap[topic.id]?.progress ?? 0) > 0;
                    
                    if (hasLessonProgress || hasTopicProgress) {
                      return (
                        <div className="space-y-2">
                          {hasLessonProgress && (
                    <div>
                              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                <span>Lessons: {lessonProgress.completed}/{lessonProgress.total}</span>
                                <span>{Math.round((lessonProgress.completed / lessonProgress.total) * 100)}%</span>
                              </div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                                  animate={{ width: `${(lessonProgress.completed / lessonProgress.total) * 100}%` }}
                          transition={{ delay: 0.3 + index * 0.1, duration: 0.8 }}
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                        ></motion.div>
                      </div>
                    </div>
                  )}
                          {hasTopicProgress && (
                            <div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-1">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${topicProgressMap[topic.id]?.progress ?? 0}%` }}
                                  transition={{ delay: 0.3 + index * 0.1, duration: 0.8 }}
                                  className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full"
                                ></motion.div>
                              </div>
                              <p className="text-xs text-gray-400">{topicProgressMap[topic.id]?.progress ?? 0}% Complete</p>
                            </div>
                          )}
                        </div>
                      );
                    }
                    return <p className="text-xs text-gray-400">Tap to start</p>;
                  })()}
                </div>
              </div>
            </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
