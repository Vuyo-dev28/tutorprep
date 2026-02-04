import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import { 
  Play, 
  CheckCircle2, 
  ChevronRight,
  Volume2,
  Maximize
} from 'lucide-react';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { supabase } from '@/lib/supabaseClient';
import { MarkdownContent } from '@/app/components/MarkdownContent';
import { checkAndAwardAchievements } from '@/lib/achievementService';

type LessonRow = {
  id: string;
  topic_id: string;
  title: string;
  type: 'video' | 'notes' | 'example';
  duration: string | null;
  content: string | null;
};

type TopicRow = {
  id: string;
  subject_id: string;
  name: string;
};

type SubjectRow = {
  id: string;
  name: string;
};

export function LessonDetailScreen() {
  const navigate = useNavigate();
  const { subjectId, topicId, lessonId } = useParams();

  const [lesson, setLesson] = useState<LessonRow | null>(null);
  const [topic, setTopic] = useState<TopicRow | null>(null);
  const [subject, setSubject] = useState<SubjectRow | null>(null);
  const [allLessons, setAllLessons] = useState<LessonRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [timeSpent, setTimeSpent] = useState(0);
  const [canProceed, setCanProceed] = useState(false);
  const [showTimeWarning, setShowTimeWarning] = useState(false);

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

      if (!subjectId || !topicId || !lessonId) {
        if (isActive) {
          setErrorMessage('Missing lesson details.');
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setErrorMessage('');

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      const [{ data: lessonRow }, { data: topicRow }, { data: subjectRow }, { data: lessonsRows }, { data: sessionState }] =
        await Promise.all([
          supabase.from('lessons').select('id,topic_id,title,type,duration,content').eq('id', lessonId).maybeSingle(),
          supabase.from('topics').select('id,subject_id,name').eq('id', topicId).maybeSingle(),
          supabase.from('subjects').select('id,name').eq('id', subjectId).maybeSingle(),
          supabase.from('lessons').select('id,topic_id,title,type,duration,content').eq('topic_id', topicId).order('sort_order'),
          userId ? supabase.from('user_session_state').select('current_lesson_id').eq('user_id', userId).eq('topic_id', topicId).maybeSingle() : Promise.resolve({ data: null }),
        ]);

      if (isActive) {
        setLesson(lessonRow ?? null);
        setTopic(topicRow ?? null);
        setSubject(subjectRow ?? null);
        setAllLessons(lessonsRows ?? []);
        
        // If there's a saved session state and it points to a different lesson, navigate to it
        if (sessionState?.current_lesson_id && sessionState.current_lesson_id !== lessonId) {
          const savedLesson = lessonsRows?.find(l => l.id === sessionState.current_lesson_id);
          if (savedLesson) {
            navigate(`/subjects/${subjectId}/${topicId}/lesson/${sessionState.current_lesson_id}`, { replace: true });
            return;
          }
        }
        
        setIsLoading(false);
      }
    };

    loadData();

    return () => {
      isActive = false;
    };
  }, [subjectId, topicId, lessonId, navigate]);

  const currentIndex = useMemo(() => {
    return allLessons.findIndex((item) => item.id === lessonId);
  }, [allLessons, lessonId]);

  const nextLesson = useMemo(() => {
    return currentIndex >= 0 ? allLessons[currentIndex + 1] : undefined;
  }, [allLessons, currentIndex]);

  // Timer to track time spent on lesson
  useEffect(() => {
    if (!lesson || isLoading) {
      setTimeSpent(0);
      setCanProceed(false);
      setShowTimeWarning(false);
      return;
    }

    // Reset timer when lesson changes
    setTimeSpent(0);
    setCanProceed(false);
    setShowTimeWarning(false);

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setTimeSpent(elapsed);
      
      if (elapsed >= 10) {
        setCanProceed(true);
        setShowTimeWarning(false);
      }
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [lessonId, lesson, isLoading]);

  // Save session state
  const saveSessionState = async () => {
    if (!supabase || !topicId || !lessonId) return;
    
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    
    if (userId) {
      await supabase
        .from('user_session_state')
        .upsert({
          user_id: userId,
          topic_id: topicId,
          current_lesson_id: lessonId,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,topic_id'
        });
    }
  };

  // Save session state when lesson changes
  useEffect(() => {
    if (lessonId && topicId) {
      saveSessionState();
    }
  }, [lessonId, topicId]);

  // Save session state before page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveSessionState();
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        saveSessionState();
      }
    });
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [lessonId, topicId]);

  // Function to mark lesson as complete and navigate
  const handleNextLesson = async () => {
    if (!canProceed || !supabase || !lessonId) {
      setShowTimeWarning(true);
      setTimeout(() => setShowTimeWarning(false), 3000);
      return;
    }

    // Mark lesson as complete
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    if (userId) {
      // Mark lesson as complete
      await supabase
        .from('user_lesson_progress')
        .upsert({
          user_id: userId,
          lesson_id: lessonId,
          completed: true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,lesson_id'
        });
      
      // Check if all lessons in the topic are completed
      if (topicId && allLessons.length > 0) {
        // Get all completed lessons for this topic
        const { data: completedLessons } = await supabase
          .from('user_lesson_progress')
          .select('lesson_id')
          .eq('user_id', userId)
          .eq('completed', true)
          .in('lesson_id', allLessons.map(l => l.id));

        const completedCount = completedLessons?.length || 0;
        const totalLessons = allLessons.length;
        const progressPercentage = Math.round((completedCount / totalLessons) * 100);
        const allLessonsCompleted = completedCount >= totalLessons;

        // Update topic progress
        await supabase
          .from('user_topic_progress')
          .upsert({
            user_id: userId,
            topic_id: topicId,
            progress: progressPercentage,
            completed: allLessonsCompleted,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,topic_id'
          });
      }
      
      // Record study session - use actual time spent, minimum 1 minute
      // Convert seconds to minutes, rounding up to ensure we capture all study time
      const studyMinutes = Math.max(1, Math.ceil(timeSpent / 60));
      await supabase
        .from('study_sessions')
        .insert({
          user_id: userId,
          minutes: studyMinutes,
        });
      
      // Update session state to next lesson
      if (nextLesson) {
        await supabase
          .from('user_session_state')
          .upsert({
            user_id: userId,
            topic_id: topicId,
            current_lesson_id: nextLesson.id,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,topic_id'
          });
      }

      // Check and award achievements
      await checkAndAwardAchievements(userId);
    }

    // Navigate to next lesson
    if (nextLesson) {
      navigate(`/subjects/${subjectId}/${topicId}/lesson/${nextLesson.id}`);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading lesson...</div>
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

  if (!lesson || !topic || !subject) {
    return <div>Lesson not found</div>;
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl sm:rounded-3xl px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-base sm:text-lg truncate">{lesson.title}</h1>
            <p className="text-xs text-gray-500 truncate">{topic.name}</p>
          </div>
          {lesson.duration && (
            <span className="text-xs text-gray-500 flex-shrink-0 bg-gray-100 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full">
              {lesson.duration}
            </span>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-20 sm:pb-24">
        {/* Video Player (for video lessons) */}
        {lesson.type === 'video' && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="bg-white rounded-[32px] overflow-hidden shadow-sm">
              <div className="relative aspect-video bg-gradient-to-br from-gray-800 to-gray-900">
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1666280963024-5da21c9be270?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdHVkZW50JTIwbGVhcm5pbmclMjBtYXRoZW1hdGljc3xlbnwxfHx8fDE3Njk5NzcxMTB8MA&ixlib=rb-4.1.0&q=80&w=1080"
                  alt="Lesson video"
                  className="w-full h-full object-cover opacity-60"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl"
                  >
                    <Play className="w-10 h-10 text-blue-600 ml-1" />
                  </motion.button>
                </div>
                <div className="absolute bottom-4 right-4 flex gap-2">
                  <button className="w-10 h-10 bg-white/20 backdrop-blur-xl hover:bg-white/30 rounded-full flex items-center justify-center transition-colors">
                    <Volume2 className="w-5 h-5 text-white" />
                  </button>
                  <button className="w-10 h-10 bg-white/20 backdrop-blur-xl hover:bg-white/30 rounded-full flex items-center justify-center transition-colors">
                    <Maximize className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Lesson Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <div className="bg-white rounded-2xl sm:rounded-[32px] p-4 sm:p-6 shadow-sm">
            <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">{lesson.title}</h2>
            <div className="prose max-w-none">
              <div className="text-gray-700 leading-relaxed mb-6">
                <MarkdownContent content={lesson.content || ''} />
              </div>

              {/* Example content based on lesson type */}
              {lesson.type === 'notes' && (
                <div className="space-y-3">
                  <div className="p-4 bg-blue-50 rounded-2xl border-l-4 border-blue-500">
                    <h3 className="font-semibold mb-2 text-blue-900">Key Point 1</h3>
                    <p className="text-sm text-gray-700">
                      Variables can represent any number, which makes them incredibly useful for solving problems where we don't know the exact value yet.
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-2xl border-l-4 border-green-500">
                    <h3 className="font-semibold mb-2 text-green-900">Key Point 2</h3>
                    <p className="text-sm text-gray-700">
                      When solving equations, always perform the same operation on both sides to maintain equality.
                    </p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-2xl border-l-4 border-purple-500">
                    <h3 className="font-semibold mb-2 text-purple-900">Remember</h3>
                    <p className="text-sm text-gray-700">
                      Check your work by substituting your answer back into the original equation.
                    </p>
                  </div>
                </div>
              )}

              {lesson.type === 'example' && lesson.content && (
                <div className="space-y-4">
                  <div className="p-5 bg-gray-50 rounded-2xl">
                    <div className="space-y-6 text-gray-700">
                      {(() => {
                        // Split content by Example/Problem markers
                        const exampleBlocks = lesson.content.split(/\n(?=Example|Problem)/i);
                        
                        return exampleBlocks.map((exampleBlock, blockIndex) => {
                          if (!exampleBlock.trim()) return null;
                          
                          const lines = exampleBlock.trim().split('\n');
                          const elements: JSX.Element[] = [];
                          let exampleTitle = '';
                          let solveProblem = '';
                          let lastStepIndex = -1;
                          
                          lines.forEach((line, lineIndex) => {
                            const trimmed = line.trim();
                            if (!trimmed) return;
                            
                            // Example/Problem title
                            const titleMatch = trimmed.match(/^(Example|Problem)\s+\d+:\s*(.+)/i);
                            if (titleMatch) {
                              exampleTitle = trimmed;
                              return;
                            }
                            
                            // Solve line
                            if (trimmed.startsWith('Solve:')) {
                              solveProblem = trimmed.replace(/^Solve:\s*/i, '').trim();
                              return;
                            }
                            
                                // Step line
                                const stepMatch = trimmed.match(/^Step\s+(\d+):\s*(.+)/i);
                                if (stepMatch) {
                                  lastStepIndex = lineIndex;
                                  // Check if next line is an equation (starts with ** or is indented)
                                  const nextLine = lines[lineIndex + 1]?.trim();
                                  const isNextLineEquation = nextLine && (
                                    nextLine.startsWith('**') || 
                                    nextLine.match(/^[a-zA-Z0-9\s+\-×÷=<>≤≥()]+$/) ||
                                    lines[lineIndex + 1]?.startsWith('  ')
                                  );
                                  
                                  if (isNextLineEquation) {
                                    // Combine step and equation
                                    const combined = `${trimmed}\n\n${nextLine}`;
                                    elements.push(
                                      <div key={`step-${lineIndex}`} className="text-sm mb-2">
                                        <MarkdownContent content={combined} />
                                      </div>
                                    );
                                    // Skip the next line since we've processed it
                                    return 'skip-next';
                                  } else {
                                    elements.push(
                                      <div key={`step-${lineIndex}`} className="text-sm mb-1">
                                        <MarkdownContent content={trimmed} />
                                      </div>
                                    );
                                    return;
                                  }
                                }
                                
                                // Answer line
                                if (trimmed.startsWith('✓') || trimmed.match(/^Answer:/i)) {
                                  elements.push(
                                    <div key={`answer-${lineIndex}`} className="text-sm mt-3 text-green-700 font-medium">
                                      <MarkdownContent content={trimmed} />
                                    </div>
                                  );
                                  return;
                                }
                                
                                // Equation/calculation (indented, appears after a step)
                                // Check if this line comes after a step and looks like an equation
                                if (lastStepIndex >= 0 && lineIndex > lastStepIndex) {
                                  // Check if next line is not a step or answer (meaning this is the equation for the step)
                                  const nextNonEmpty = lines.slice(lineIndex + 1).find(l => l.trim());
                                  if (!nextNonEmpty || (!nextNonEmpty.match(/^Step\s+\d+:/i) && !nextNonEmpty.match(/^Answer:/i) && !nextNonEmpty.startsWith('✓'))) {
                                    elements.push(
                                      <div key={`eq-${lineIndex}`} className="text-sm ml-4 mb-2">
                                        <MarkdownContent content={trimmed} />
                                      </div>
                                    );
                                    return;
                                  }
                                }
                                
                                // Regular text (fallback)
                                elements.push(
                                  <div key={`text-${lineIndex}`} className="text-sm">
                                    <MarkdownContent content={trimmed} />
                                  </div>
                                );
                          });
                          
                          return (
                            <div key={blockIndex} className={blockIndex > 0 ? 'mt-6 pt-6 border-t border-gray-300' : ''}>
                              {exampleTitle && (
                                <h3 className="font-semibold mb-3 text-base">{exampleTitle}</h3>
                              )}
                              
                              {solveProblem && (
                                <div className="mb-4">
                                  Solve: <code className="px-3 py-1.5 bg-white rounded-xl font-mono text-sm">
                                    <MarkdownContent content={solveProblem} />
                                  </code>
                                </div>
                              )}
                              
                              <div className="space-y-2">
                                {elements}
                    </div>
                  </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Navigation Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col sm:flex-row gap-3 mb-6"
        >
          <Button 
            variant="outline" 
            className="flex-1 h-12 sm:h-14 rounded-full border-2 text-sm sm:text-base"
            onClick={() => navigate(`/subjects/${subjectId}/${topicId}`)}
          >
            Back to Topic
          </Button>
          {nextLesson ? (
            <div className="flex-1 relative">
            <Button 
                className={`w-full h-12 sm:h-14 rounded-full text-sm sm:text-base ${
                  canProceed 
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg shadow-purple-500/30' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                onClick={handleNextLesson}
                disabled={!canProceed}
              >
                {canProceed ? (
                  <>
              Next Lesson
              <ChevronRight className="w-4 h-4 ml-2" />
                  </>
                ) : (
                  `Wait ${10 - timeSpent}s`
                )}
            </Button>
              {showTimeWarning && (
                <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg text-sm whitespace-nowrap shadow-lg animate-pulse">
                  Please spend at least 10 seconds on this lesson
                </div>
              )}
            </div>
          ) : (
            <Button 
              className={`flex-1 h-12 sm:h-14 rounded-full text-sm sm:text-base ${
                canProceed 
                  ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg shadow-green-500/30' 
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
              onClick={async () => {
                if (!canProceed || !supabase || !lessonId) {
                  setShowTimeWarning(true);
                  setTimeout(() => setShowTimeWarning(false), 3000);
                  return;
                }

                // Mark lesson as complete before going to quiz
                const { data: userData } = await supabase.auth.getUser();
                const userId = userData?.user?.id;

                if (userId) {
                  await supabase
                    .from('user_lesson_progress')
                    .upsert({
                      user_id: userId,
                      lesson_id: lessonId,
                      completed: true,
                      updated_at: new Date().toISOString(),
                    }, {
                      onConflict: 'user_id,lesson_id'
                    });
                  
                  // Check if all lessons in the topic are completed
                  if (topicId && allLessons.length > 0) {
                    // Get all completed lessons for this topic
                    const { data: completedLessons } = await supabase
                      .from('user_lesson_progress')
                      .select('lesson_id')
                      .eq('user_id', userId)
                      .eq('completed', true)
                      .in('lesson_id', allLessons.map(l => l.id));

                    const completedCount = completedLessons?.length || 0;
                    const totalLessons = allLessons.length;
                    const progressPercentage = Math.round((completedCount / totalLessons) * 100);
                    const allLessonsCompleted = completedCount >= totalLessons;

                    // Update topic progress
                    await supabase
                      .from('user_topic_progress')
                      .upsert({
                        user_id: userId,
                        topic_id: topicId,
                        progress: progressPercentage,
                        completed: allLessonsCompleted,
                        updated_at: new Date().toISOString(),
                      }, {
                        onConflict: 'user_id,topic_id'
                      });
                  }
                  
                  // Record study session - use actual time spent, minimum 1 minute
                  const studyMinutes = Math.max(1, Math.ceil(timeSpent / 60));
                  await supabase
                    .from('study_sessions')
                    .insert({
                      user_id: userId,
                      minutes: studyMinutes,
                    });

                  // Check and award achievements
                  await checkAndAwardAchievements(userId);
                }

                navigate(`/quiz/${topicId}`);
              }}
              disabled={!canProceed}
            >
              {canProceed ? (
                <>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Take Quiz
                </>
              ) : (
                `Wait ${10 - timeSpent}s`
              )}
            </Button>
          )}
        </motion.div>

        {/* Progress Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-sm">
            <div className="flex gap-1">
              {allLessons.map((_, index) => (
                <div
                  key={index}
                  className={`h-1.5 rounded-full transition-all ${
                    index === currentIndex ? 'w-6 bg-blue-500' : 'w-1.5 bg-gray-300'
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-gray-500">
              {currentIndex + 1} of {allLessons.length}
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
