import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Badge } from '@/app/components/ui/badge';
import { Progress } from '@/app/components/ui/progress';
import { CheckCircle2, XCircle, Clock, Award } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

type TopicProgress = {
  topic_id: string;
  topic_name: string;
  subject_name: string;
  difficulty: string;
  lessons_completed: number;
  total_lessons: number;
  quiz_attempts: number;
  best_quiz_score: number;
  last_activity: string | null;
  is_completed: boolean;
};

interface StudentProgressReportProps {
  studentId: string;
}

export function StudentProgressReport({ studentId }: StudentProgressReportProps) {
  const [topics, setTopics] = useState<TopicProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadProgress = async () => {
      if (!supabase) return;

      try {
        // Get all topics with progress data
        const { data: allTopics, error: topicsError } = await supabase
          .from('topics')
          .select('id, name, difficulty, subject_id, subjects(name)')
          .order('name');

        if (topicsError) throw topicsError;

        // Get lesson progress
        const { data: lessonProgress, error: lessonError } = await supabase
          .from('user_lesson_progress')
          .select('lesson_id, completed, lessons(topic_id)')
          .eq('user_id', studentId);

        if (lessonError) throw lessonError;

        // Get quiz attempts
        const { data: quizAttempts, error: quizError } = await supabase
          .from('quiz_attempts')
          .select('topic_id, percentage, created_at')
          .eq('user_id', studentId)
          .order('created_at', { ascending: false });

        if (quizError) throw quizError;

        // Get topic completion status
        const { data: topicProgress, error: topicError } = await supabase
          .from('user_topic_progress')
          .select('topic_id, completed')
          .eq('user_id', studentId);

        if (topicError) throw topicError;

        // Get lessons count per topic
        const { data: lessons, error: lessonsError } = await supabase
          .from('lessons')
          .select('id, topic_id');

        if (lessonsError) throw lessonsError;

        // Process data
        const topicsData: TopicProgress[] = (allTopics || []).map((topic: any) => {
          const topicLessons = (lessons || []).filter((l: any) => l.topic_id === topic.id);
          const completedLessons = (lessonProgress || []).filter(
            (lp: any) => lp.lessons?.topic_id === topic.id && lp.completed
          ).length;
          const topicQuizAttempts = (quizAttempts || []).filter((qa: any) => qa.topic_id === topic.id);
          const bestScore = topicQuizAttempts.length > 0
            ? Math.max(...topicQuizAttempts.map((qa: any) => qa.percentage))
            : 0;
          const lastQuiz = topicQuizAttempts.length > 0
            ? topicQuizAttempts[0].created_at
            : null;
          const isCompleted = (topicProgress || []).some(
            (tp: any) => tp.topic_id === topic.id && tp.completed
          );

          return {
            topic_id: topic.id,
            topic_name: topic.name,
            subject_name: topic.subjects?.name || 'Unknown',
            difficulty: topic.difficulty || 'medium',
            lessons_completed: completedLessons,
            total_lessons: topicLessons.length,
            quiz_attempts: topicQuizAttempts.length,
            best_quiz_score: bestScore,
            last_activity: lastQuiz,
            is_completed: isCompleted,
          };
        });

        setTopics(topicsData);
      } catch (error: any) {
        console.error('Error loading progress:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProgress();
  }, [studentId]);

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 mt-2">Loading progress...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Topic-by-Topic Progress</h3>
        <p className="text-sm text-gray-600">
          Detailed breakdown of your child's progress across all topics
        </p>
      </div>

      {topics.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No progress data available yet.
        </div>
      ) : (
        <div className="space-y-3">
          {topics.map((topic, index) => (
            <motion.div
              key={topic.topic_id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="border rounded-xl p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-gray-900">{topic.topic_name}</h4>
                    {topic.is_completed && (
                      <Badge className="bg-green-100 text-green-700">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Completed
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {topic.difficulty}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">{topic.subject_name}</p>
                </div>
                {topic.best_quiz_score > 0 && (
                  <div className="flex items-center gap-1 text-yellow-600">
                    <Award className="w-4 h-4" />
                    <span className="font-semibold">{topic.best_quiz_score.toFixed(0)}%</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">Lessons</span>
                    <span className="font-medium">
                      {topic.lessons_completed} / {topic.total_lessons}
                    </span>
                  </div>
                  <Progress
                    value={
                      topic.total_lessons > 0
                        ? (topic.lessons_completed / topic.total_lessons) * 100
                        : 0
                    }
                    className="h-2"
                  />
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {topic.quiz_attempts} quiz attempt{topic.quiz_attempts !== 1 ? 's' : ''}
                  </div>
                  {topic.last_activity && (
                    <span>
                      Last activity: {new Date(topic.last_activity).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
