import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import { Textarea } from '@/app/components/ui/textarea';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { 
  CheckCircle2, 
  XCircle, 
  Trophy,
  RotateCcw,
  Home,
  Sparkles,
  Star,
  ArrowLeft
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { MarkdownContent } from '@/app/components/MarkdownContent';
import { checkAndAwardAchievements } from '@/lib/achievementService';

type QuestionRow = {
  id: string;
  topic_id: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string | null;
  correctAnswerText?: string; // Extracted from explanation
  explanationText?: string; // Extracted from explanation
};

type TopicRow = {
  id: string;
  subject_id: string;
  name: string;
};

type SubjectRow = {
  id: string;
  name: string;
  color: string | null;
};

export function QuizScreen() {
  const navigate = useNavigate();
  const { topicId } = useParams();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [workingOut, setWorkingOut] = useState<string>('');
  const [answerText, setAnswerText] = useState<string>('');
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [quizComplete, setQuizComplete] = useState(false);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [topic, setTopic] = useState<TopicRow | null>(null);
  const [subject, setSubject] = useState<SubjectRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);

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

      if (!topicId) {
        if (isActive) {
          setErrorMessage('Missing quiz topic.');
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setErrorMessage('');

      const { data: topicRow } = await supabase
        .from('topics')
        .select('id,subject_id,name')
        .eq('id', topicId)
        .maybeSingle();

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      const [{ data: questionRows }, { data: subjectRow }, { data: sessionState }] = await Promise.all([
        supabase
          .from('questions')
          .select('id,topic_id,question,options,correct_answer,explanation')
          .eq('topic_id', topicId)
          .order('created_at', { ascending: true }), // Order by creation time (which should match difficulty order)
        topicRow
          ? supabase.from('subjects').select('id,name,color').eq('id', topicRow.subject_id).maybeSingle()
          : Promise.resolve({ data: null }),
        userId ? supabase.from('user_session_state').select('current_question_index,quiz_answers,quiz_score').eq('user_id', userId).eq('topic_id', topicId).maybeSingle() : Promise.resolve({ data: null }),
      ]);

      if (isActive) {
        setTopic(topicRow ?? null);
        setSubject(subjectRow ?? null);
        const loadedQuestions = (questionRows ?? []).map((row) => {
          // Parse explanation to extract correct answer and explanation text
          let correctAnswerText = '';
          let explanationText = '';
          if (row.explanation) {
            const parts = row.explanation.split('|');
            if (parts.length >= 2) {
              correctAnswerText = parts[0];
              explanationText = parts.slice(1).join('|');
            } else {
              explanationText = row.explanation;
            }
          }
          
          return {
            ...row,
            options: Array.isArray(row.options) ? row.options : [],
            correctAnswerText,
            explanationText,
          };
        });
        
        setQuestions(loadedQuestions);
        
        // Restore saved quiz state if it exists and quiz is not complete
        if (sessionState && !sessionState.quiz_answers || typeof sessionState.quiz_answers === 'object') {
          const savedAnswers = sessionState.quiz_answers as Record<string, { answer: string; workingOut: string }> || {};
          const savedQuestionIndex = sessionState.current_question_index ?? 0;
          const savedScore = sessionState.quiz_score ?? 0;
          
          // Only restore if we have valid saved state and haven't completed the quiz
          if (savedQuestionIndex >= 0 && savedQuestionIndex < loadedQuestions.length) {
            setCurrentQuestion(savedQuestionIndex);
            setScore(savedScore);
            
            // Restore answer for current question if it exists
            const currentQId = loadedQuestions[savedQuestionIndex]?.id;
            if (currentQId && savedAnswers[currentQId]) {
              setAnswerText(savedAnswers[currentQId].answer || '');
              setWorkingOut(savedAnswers[currentQId].workingOut || '');
            }
          }
        }
        
        setIsLoading(false);
      }
    };

    loadData();

    return () => {
      isActive = false;
    };
  }, [topicId]);

  const topicQuestions = useMemo(() => questions, [questions]);

  // Save quiz session state function
  const saveQuizState = async () => {
    if (!supabase || !topicId || quizComplete || topicQuestions.length === 0) return;
    
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    
    if (userId) {
      // Build answers object - save all answers so far
      const answers: Record<string, { answer: string; workingOut: string }> = {};
      const currentQId = topicQuestions[currentQuestion]?.id;
      if (currentQId) {
        answers[currentQId] = {
          answer: answerText,
          workingOut: workingOut,
        };
      }
      
      await supabase
        .from('user_session_state')
        .upsert({
          user_id: userId,
          topic_id: topicId,
          current_question_index: currentQuestion,
          quiz_answers: answers,
          quiz_score: score,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,topic_id'
        });
    }
  };

  // This useEffect must be called before any early returns to follow Rules of Hooks
  useEffect(() => {
    const persistAttempt = async () => {
      if (!quizComplete || !supabase || !topicId || topicQuestions.length === 0) {
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      if (!userId) {
        return;
      }

      const percentage = Math.round((score / topicQuestions.length) * 100);

      // Save quiz attempt
      await supabase.from('quiz_attempts').insert({
        user_id: userId,
        topic_id: topicId,
        score,
        total_questions: topicQuestions.length,
        percentage,
      });

      // If quiz score is 90% or higher, mark topic as complete
      if (percentage >= 90) {
        await supabase
          .from('user_topic_progress')
          .upsert({
            user_id: userId,
            topic_id: topicId,
            progress: 100,
            completed: true,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,topic_id'
          });
      }

      // Record study session for completing quiz (estimate 5-10 minutes per quiz)
      const quizMinutes = Math.max(5, Math.min(10, Math.round(topicQuestions.length * 1.5)));
      await supabase
        .from('study_sessions')
        .insert({
          user_id: userId,
          minutes: quizMinutes,
        });

      // Check and award achievements
      await checkAndAwardAchievements(userId);
    };

    persistAttempt();
  }, [quizComplete, score, topicQuestions.length, topicId, supabase]);

  // Save state when question, answer, or score changes
  // MUST be before early returns to follow Rules of Hooks
  useEffect(() => {
    if (topicId && topicQuestions.length > 0 && !quizComplete && !isLoading) {
      saveQuizState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion, answerText, workingOut, score, topicId, quizComplete]);

  // Save state before page unload
  // MUST be before early returns to follow Rules of Hooks
  useEffect(() => {
    if (!topicId || quizComplete) return;
    
    const handleBeforeUnload = () => {
      saveQuizState();
    };
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveQuizState();
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId, quizComplete]);

  // Normalize answer for comparison - handles spacing, commas, and case differences
  const normalizeAnswer = (answer: string | null | undefined): string => {
    if (!answer || typeof answer !== 'string') return '';
    return answer
      .toLowerCase()
      .trim()
      // Remove all whitespace (spaces, tabs, newlines)
      .replace(/\s+/g, '')
      // Normalize commas (remove spaces around commas)
      .replace(/\s*,\s*/g, ',')
      // Remove any trailing/leading commas
      .replace(/^,+|,+$/g, '');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading quiz...</div>
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

  if (!topic || !subject || topicQuestions.length === 0) {
    return <div>Quiz not available</div>;
  }

  // Get current question - must be after early returns check
  const currentQ = topicQuestions[currentQuestion];
  const progress = ((currentQuestion + 1) / topicQuestions.length) * 100;

  const handleCheckAnswer = () => {
    if (showResult || !answerText || !answerText.trim() || !currentQ) return;
    setShowResult(true);
    // Check if answer matches (normalized comparison)
    const normalizedUserAnswer = normalizeAnswer(answerText);
    const normalizedCorrectAnswer = normalizeAnswer(currentQ.correctAnswerText);
    const isCorrect = normalizedUserAnswer === normalizedCorrectAnswer && normalizedUserAnswer !== '';
    if (isCorrect) {
      setScore(score + 1);
      // Trigger confetti animation
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    }
    // Save state after checking answer
    setTimeout(() => saveQuizState(), 100);
  };

  const handleNext = async () => {
    if (currentQuestion < topicQuestions.length - 1) {
      const nextIndex = currentQuestion + 1;
      setCurrentQuestion(nextIndex);
      setSelectedAnswer(null);
      setShowResult(false);
      setShowConfetti(false);
      
      // Restore saved answer for next question if it exists
      if (supabase && topicId) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user?.id) {
          const { data: sessionState } = await supabase
            .from('user_session_state')
            .select('quiz_answers')
            .eq('user_id', userData.user.id)
            .eq('topic_id', topicId)
            .maybeSingle();
          
          if (sessionState?.quiz_answers && typeof sessionState.quiz_answers === 'object') {
            const savedAnswers = sessionState.quiz_answers as Record<string, { answer: string; workingOut: string }>;
            const nextQId = topicQuestions[nextIndex]?.id;
            if (nextQId && savedAnswers[nextQId]) {
              setAnswerText(savedAnswers[nextQId].answer || '');
              setWorkingOut(savedAnswers[nextQId].workingOut || '');
            } else {
              setWorkingOut('');
              setAnswerText('');
            }
          } else {
            setWorkingOut('');
            setAnswerText('');
          }
        } else {
          setWorkingOut('');
          setAnswerText('');
        }
      } else {
        setWorkingOut('');
        setAnswerText('');
      }
    } else {
      setQuizComplete(true);
      // Clear session state when quiz is complete
      if (supabase && topicId) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user?.id) {
          await supabase
            .from('user_session_state')
            .delete()
            .eq('user_id', userData.user.id)
            .eq('topic_id', topicId);
        }
      }
    }
  };

  const handleRetry = () => {
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setWorkingOut('');
    setAnswerText('');
    setShowResult(false);
    setScore(0);
    setQuizComplete(false);
    setShowConfetti(false);
    
    // Clear session state on retry
    const { data: userData } = supabase?.auth.getUser();
    if (userData?.user?.id && topicId && supabase) {
      supabase
        .from('user_session_state')
        .delete()
        .eq('user_id', userData.user.id)
        .eq('topic_id', topicId);
    }
  };

  if (quizComplete) {
    const percentage = Math.round((score / topicQuestions.length) * 100);
    const passed = percentage >= 70;

    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-lg"
        >
          <div className="bg-white/95 backdrop-blur-2xl rounded-[40px] p-8 shadow-2xl text-center">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className={`w-24 h-24 mx-auto mb-6 rounded-[32px] flex items-center justify-center shadow-2xl ${
                passed ? 'bg-gradient-to-br from-green-400 to-green-600' : 'bg-gradient-to-br from-yellow-400 to-yellow-600'
              }`}
            >
              {passed ? (
                <Trophy className="w-12 h-12 text-white" />
              ) : (
                <Sparkles className="w-12 h-12 text-white" />
              )}
            </motion.div>

            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-3xl font-semibold mb-2"
            >
              {passed ? 'Excellent Work!' : 'Good Effort!'}
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-gray-500 mb-8"
            >
              {passed 
                ? "You've mastered this topic!" 
                : "Keep practicing to improve your score"}
            </motion.p>

            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: 'spring' }}
              className="mb-8"
            >
              <div className={`text-7xl font-bold mb-2 bg-gradient-to-br ${
                passed ? 'from-green-400 to-green-600' : 'from-yellow-400 to-yellow-600'
              } bg-clip-text text-transparent`}>
                {percentage}%
              </div>
              <p className="text-gray-600">
                {score} out of {topicQuestions.length} correct
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="space-y-3"
            >
              <Button 
                onClick={handleRetry}
                variant="outline"
                className="w-full h-14 rounded-full border-2 text-base"
                size="lg"
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                Try Again
              </Button>
              <Button 
                onClick={() => navigate('/dashboard')}
                className="w-full h-14 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg shadow-purple-500/30 text-base"
                size="lg"
              >
                <Home className="w-5 h-5 mr-2" />
                Back to Dashboard
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <div className="max-w-4xl mx-auto px-6 pt-6">
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-3xl px-6 py-4 mb-6">
          <div className="flex items-center gap-3 mb-3">
            {topic && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(`/subjects/${topic.subject_id}/${topic.id}`)}
                className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors flex-shrink-0"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </motion.button>
            )}
            <div className="flex-1">
            <div className="text-sm font-medium text-gray-600">
              Question {currentQuestion + 1} of {topicQuestions.length}
              </div>
            </div>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
            ></motion.div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 pb-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            {/* Question */}
            <div className="bg-white rounded-[32px] p-6 md:p-8 mb-6 shadow-sm">
              <div className="flex items-start gap-3 mb-6">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${subject.color ?? 'from-blue-500 to-purple-500'} text-white font-semibold shadow-lg`}>
                  {currentQuestion + 1}
                </div>
                <div className="text-xl flex-1 pt-2">
                  <MarkdownContent content={currentQ.question} />
                </div>
              </div>

              {/* Working Out and Answer Input */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="working-out" className="text-sm font-medium text-gray-700 mb-2 block">
                    Show your working out:
                  </Label>
                  <Textarea
                    id="working-out"
                    value={workingOut}
                    onChange={(e) => setWorkingOut(e.target.value)}
                    placeholder="Write your steps and calculations here..."
                    className="min-h-[150px] resize-none"
                    disabled={showResult}
                  />
                </div>
                
                <div>
                  <Label htmlFor="answer" className="text-sm font-medium text-gray-700 mb-2 block">
                    Your answer:
                  </Label>
                  <Input
                    id="answer"
                    type="text"
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    placeholder="Enter your final answer"
                    className="text-lg"
                      disabled={showResult}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && answerText.trim() && !showResult) {
                        handleCheckAnswer();
                      }
                    }}
                  />
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs font-medium text-blue-900 mb-1">💡 Answer Format Tips:</p>
                    <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                      <li>Spaces don't matter: "25,30,35" or "25, 30, 35" both work</li>
                      <li>Case doesn't matter: "Yes" or "yes" both work</li>
                      <li>For multiple answers, use commas: "5, 10, 15" or "5,10,15"</li>
                      <li>Just enter the final answer (numbers, words, or a combination)</li>
                    </ul>
                  </div>
                </div>
                
                {!showResult && (
                  <Button
                    onClick={handleCheckAnswer}
                    disabled={!answerText.trim()}
                    className="w-full h-14 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg shadow-purple-500/30"
                  >
                    Check Answer
                  </Button>
                )}
              </div>

              {/* Result and Explanation */}
              <AnimatePresence>
                {showResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 space-y-4"
                  >
                    <div className={`p-4 rounded-2xl relative overflow-hidden ${
                      currentQ && normalizeAnswer(answerText) === normalizeAnswer(currentQ.correctAnswerText)
                        ? 'bg-green-50 border-2 border-green-200'
                        : 'bg-red-50 border-2 border-red-200'
                        }`}>
                      {/* Confetti Effect */}
                      {showConfetti && currentQ && normalizeAnswer(answerText) === normalizeAnswer(currentQ.correctAnswerText) && (
                        <div className="absolute inset-0 pointer-events-none overflow-hidden">
                          {[...Array(30)].map((_, i) => (
                            <motion.div
                              key={i}
                              className="absolute w-2 h-2 rounded-full"
                              style={{
                                left: `${Math.random() * 100}%`,
                                top: '50%',
                                backgroundColor: ['#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b'][Math.floor(Math.random() * 5)],
                              }}
                              initial={{ 
                                opacity: 1, 
                                scale: 1,
                                y: 0,
                                x: 0,
                                rotate: 0
                              }}
                              animate={{ 
                                opacity: [1, 1, 0],
                                scale: [1, 1.5, 0.5],
                                y: [0, -100 - Math.random() * 100],
                                x: (Math.random() - 0.5) * 200,
                                rotate: [0, 360],
                              }}
                              transition={{ 
                                duration: 1.5,
                                delay: Math.random() * 0.3,
                                ease: "easeOut"
                              }}
                            />
                          ))}
                          {[...Array(10)].map((_, i) => (
                            <motion.div
                              key={`star-${i}`}
                              className="absolute"
                              style={{
                                left: `${Math.random() * 100}%`,
                                top: '50%',
                              }}
                              initial={{ 
                                opacity: 1, 
                                scale: 0,
                                rotate: 0
                              }}
                              animate={{ 
                                opacity: [1, 1, 0],
                                scale: [0, 1.5, 0],
                                rotate: [0, 180],
                                y: [0, -150 - Math.random() * 50],
                                x: (Math.random() - 0.5) * 150,
                              }}
                              transition={{ 
                                duration: 2,
                                delay: Math.random() * 0.5,
                                ease: "easeOut"
                              }}
                            >
                              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                            </motion.div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-3 mb-2 relative z-10">
                        {currentQ && normalizeAnswer(answerText) === normalizeAnswer(currentQ.correctAnswerText) ? (
                          <>
                            <motion.div
                              initial={{ scale: 0, rotate: -180 }}
                              animate={{ scale: [0, 1.3, 1], rotate: [0, 360] }}
                              transition={{ 
                                type: "spring", 
                                stiffness: 200, 
                                damping: 15,
                                duration: 0.6
                              }}
                            >
                              <CheckCircle2 className="w-8 h-8 text-green-600" />
                            </motion.div>
                            <motion.div
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ delay: 0.2, type: "spring" }}
                            >
                              <span className="font-semibold text-green-800 text-lg">Correct! 🎉</span>
                            </motion.div>
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: [0, 1.5, 1], rotate: [0, 360] }}
                              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                              className="ml-auto"
                            >
                              <Sparkles className="w-6 h-6 text-yellow-500" />
                            </motion.div>
                          </>
                        ) : (
                          <>
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring" }}
                            >
                              <XCircle className="w-6 h-6 text-red-600" />
                            </motion.div>
                            <span className="font-semibold text-red-800">Incorrect</span>
                          </>
                        )}
                      </div>
                      {currentQ.correctAnswerText && (
                        <div className="text-sm text-gray-700 mb-2">
                          <strong>Correct answer:</strong>{' '}
                          <MarkdownContent content={currentQ.correctAnswerText} />
                        </div>
                      )}
                      {currentQ.explanationText && (
                        <div className="text-sm text-gray-700">
                          <strong>Explanation:</strong>
                          <div className="mt-1">
                            <MarkdownContent content={currentQ.explanationText} />
                          </div>
                      </div>
                      )}
              </div>
                    
                    <Button
                      onClick={handleNext}
                      className="w-full h-14 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg shadow-purple-500/30"
                    >
                      {currentQuestion < topicQuestions.length - 1 ? 'Next Question' : 'Finish Quiz'}
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Explanation */}
              <AnimatePresence>
                {showResult && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`mt-6 p-5 rounded-2xl ${
                      selectedAnswer === currentQ.correctAnswer
                        ? 'bg-green-50'
                        : 'bg-blue-50'
                    }`}
                  >
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      {selectedAnswer === currentQ.correctAnswer ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                          <span className="text-green-900">Correct!</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-5 h-5 text-blue-600" />
                          <span className="text-blue-900">Not quite right</span>
                        </>
                      )}
                    </h4>
                    <p className="text-sm text-gray-700">{currentQ.explanation}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Next Button */}
            {showResult && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Button 
                  onClick={handleNext}
                  className="w-full h-14 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg shadow-purple-500/30 text-base"
                  size="lg"
                >
                  {currentQuestion < topicQuestions.length - 1 ? 'Next Question' : 'Finish Quiz'}
                </Button>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
