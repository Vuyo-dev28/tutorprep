import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { 
  Play, 
  FileText, 
  Calculator, 
  CheckCircle2,
  ChevronRight,
  BookOpen,
  Video,
  ArrowLeft
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { MarkdownContent } from '@/app/components/MarkdownContent';

type SubjectRow = {
  id: string;
  name: string;
  color: string | null;
};

type TopicRow = {
  id: string;
  subject_id: string;
  name: string;
  description: string | null;
};

type LessonRow = {
  id: string;
  topic_id: string;
  title: string;
  type: 'video' | 'notes' | 'example';
  duration: string | null;
  content: string | null;
};

type LessonProgressRow = {
  lesson_id: string;
  completed: boolean;
};

export function LessonScreen() {
  const navigate = useNavigate();
  const { subjectId, topicId } = useParams();
  const [activeTab, setActiveTab] = useState('lessons');
  const [subject, setSubject] = useState<SubjectRow | null>(null);
  const [topic, setTopic] = useState<TopicRow | null>(null);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [lessonProgress, setLessonProgress] = useState<LessonProgressRow[]>([]);
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

      if (!subjectId || !topicId) {
        if (isActive) {
          setErrorMessage('Missing topic details.');
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setErrorMessage('');

      const [{ data: subjectRow }, { data: topicRow }, { data: lessonRows, error: lessonsError }] = await Promise.all([
        supabase.from('subjects').select('id,name,color').eq('id', subjectId).maybeSingle(),
        supabase.from('topics').select('id,subject_id,name,description').eq('id', topicId).maybeSingle(),
        supabase.from('lessons').select('id,topic_id,title,type,duration,content').eq('topic_id', topicId).order('sort_order'),
      ]);

      if (lessonsError) {
        console.error('Error loading lessons:', lessonsError);
      } else {
        console.log(`Loaded ${lessonRows?.length || 0} lessons for topic ${topicId}`);
      }

      const userResult = await supabase.auth.getUser();
      const userId = userResult.data?.user?.id;
      const progressRows = userId
        ? await supabase
            .from('user_lesson_progress')
            .select('lesson_id,completed')
            .eq('user_id', userId)
        : { data: [] as LessonProgressRow[] };

      if (isActive) {
        setSubject(subjectRow ?? null);
        setTopic(topicRow ?? null);
        setLessons(lessonRows ?? []);
        setLessonProgress(progressRows.data ?? []);
        setIsLoading(false);
      }
    };

    loadData();

    return () => {
      isActive = false;
    };
  }, [subjectId, topicId]);

  const lessonProgressMap = useMemo(() => {
    return lessonProgress.reduce<Record<string, LessonProgressRow>>((acc, row) => {
      acc[row.lesson_id] = row;
      return acc;
    }, {});
  }, [lessonProgress]);

  const topicLessons = lessons;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading lessons...</div>
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

  if (!subject || !topic) {
    return <div>Content not found</div>;
  }

  const getLessonIcon = (type: string) => {
    switch (type) {
      case 'video':
        return Video;
      case 'notes':
        return FileText;
      case 'example':
        return Calculator;
      default:
        return BookOpen;
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <div className="max-w-6xl mx-auto px-6 pt-6">
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-3xl px-6 py-4">
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate(`/subjects/${subjectId}`)}
              className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </motion.button>
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold text-lg truncate">{topic.name}</h1>
              <p className="text-xs text-gray-500 truncate">{subject.name}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 pb-24">
        {/* Topic Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className={`bg-gradient-to-br ${subject.color ?? 'from-blue-500 to-purple-500'} rounded-[32px] p-6 shadow-2xl text-white relative overflow-hidden`}>
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            <div className="relative">
              <h2 className="text-2xl font-semibold mb-2">{topic.name}</h2>
              <p className="text-white/80 mb-4">{topic.description}</p>
              <div className="flex items-center gap-4 text-sm text-white/90">
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  <span>{topicLessons.length} Lessons</span>
                </div>
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  <span>~30 min</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="bg-white/80 backdrop-blur-xl rounded-full p-1 shadow-sm">
            <TabsList className="grid w-full grid-cols-3 bg-transparent gap-1">
              <TabsTrigger 
                value="lessons"
                className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                <BookOpen className="w-4 h-4 mr-2" />
                Lessons
              </TabsTrigger>
              <TabsTrigger 
                value="practice"
                className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                <Calculator className="w-4 h-4 mr-2" />
                Practice
              </TabsTrigger>
              <TabsTrigger 
                value="notes"
                className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                <FileText className="w-4 h-4 mr-2" />
                Notes
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="lessons" className="space-y-3">
            {topicLessons.map((lesson, index) => {
              const Icon = getLessonIcon(lesson.type);
              const isCompleted = lessonProgressMap[lesson.id]?.completed;
              return (
                <motion.div
                  key={lesson.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => navigate(`/subjects/${subjectId}/${topicId}/lesson/${lesson.id}`)}
                  className="bg-white rounded-3xl p-5 shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-14 h-14 rounded-[18px] flex items-center justify-center flex-shrink-0 ${
                      isCompleted ? 'bg-green-100' : 'bg-blue-100'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle2 className="w-7 h-7 text-green-600" />
                      ) : (
                        <Icon className="w-7 h-7 text-blue-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-semibold text-lg">{lesson.title}</h4>
                        {lesson.duration && (
                          <span className="text-xs text-gray-400 flex-shrink-0 bg-gray-100 px-2 py-1 rounded-full">
                            {lesson.duration}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 mb-3">
                        <MarkdownContent content={lesson.content || ''} />
                      </div>
                      <div className="inline-flex items-center gap-2 text-blue-500 text-sm font-medium">
                        {isCompleted ? 'Review' : 'Start'}
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </TabsContent>

          <TabsContent value="practice">
            <div className="bg-white rounded-[32px] p-8 text-center shadow-sm">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-400 to-purple-600 rounded-[28px] flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Calculator className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-semibold mb-2">Ready to Practice?</h3>
              <p className="text-gray-500 mb-6">
                Test your knowledge with interactive questions
              </p>
              <Button 
                size="lg"
                onClick={() => navigate(`/quiz/${topicId}`)}
                className="h-14 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-lg shadow-purple-500/30"
              >
                <Play className="w-5 h-5 mr-2" />
                Start Practice Quiz
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="notes">
            <div className="bg-white rounded-[32px] p-6 shadow-sm">
              <h3 className="text-xl font-semibold mb-4">Key Concepts</h3>
              <div className="space-y-3">
                <div className="p-4 bg-blue-50 rounded-2xl border-l-4 border-blue-500">
                  <h4 className="font-semibold mb-2">Variables</h4>
                  <p className="text-sm text-gray-700">
                    A variable is a symbol (usually a letter) that represents an unknown value.
                    For example, in the equation x + 5 = 10, x is the variable.
                  </p>
                </div>
                <div className="p-4 bg-green-50 rounded-2xl border-l-4 border-green-500">
                  <h4 className="font-semibold mb-2">Solving Equations</h4>
                  <p className="text-sm text-gray-700">
                    To solve an equation, perform the same operation on both sides to isolate the variable.
                    Example: If 2x = 10, divide both sides by 2 to get x = 5.
                  </p>
                </div>
                <div className="p-4 bg-purple-50 rounded-2xl border-l-4 border-purple-500">
                  <h4 className="font-semibold mb-2">Practice Tip</h4>
                  <p className="text-sm text-gray-700">
                    Always check your answer by substituting it back into the original equation.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Continue Learning */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6"
        >
          <Button 
            className="w-full h-14 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg shadow-purple-500/30"
            size="lg"
            onClick={() => navigate(`/subjects/${subjectId}/${topicId}/lesson/${topicLessons[0]?.id}`)}
            disabled={!topicLessons.length}
          >
            Start First Lesson
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
