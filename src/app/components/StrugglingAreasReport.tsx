import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Badge } from '@/app/components/ui/badge';
import { Progress } from '@/app/components/ui/progress';
import { AlertTriangle, TrendingDown, BookOpen, Target } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

type StrugglingArea = {
  topic_name: string;
  subject_name: string;
  difficulty: string;
  quiz_attempts: number;
  average_score: number;
  lowest_score: number;
  last_attempt_date: string | null;
  lessons_completed: number;
  total_lessons: number;
  completion_rate: number;
};

interface StrugglingAreasReportProps {
  studentId: string;
}

export function StrugglingAreasReport({ studentId }: StrugglingAreasReportProps) {
  const [strugglingAreas, setStrugglingAreas] = useState<StrugglingArea[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStrugglingAreas = async () => {
      if (!supabase) return;

      try {
        const { data, error } = await supabase.rpc('get_student_struggling_areas', {
          student_uuid: studentId,
        });

        if (error) throw error;

        setStrugglingAreas((data || []) as StrugglingArea[]);
      } catch (error: any) {
        console.error('Error loading struggling areas:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStrugglingAreas();
  }, [studentId]);

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 mt-2">Analyzing struggling areas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          <h3 className="text-lg font-semibold">Areas Needing Attention</h3>
        </div>
        <p className="text-sm text-gray-600">
          Topics where your child is struggling or needs additional support
        </p>
      </div>

      {strugglingAreas.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Target className="w-8 h-8 text-green-600" />
          </div>
          <h4 className="text-lg font-semibold text-gray-900 mb-2">Great Progress!</h4>
          <p className="text-gray-600">
            No major struggling areas identified. Your child is doing well across all topics.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {strugglingAreas.map((area, index) => (
            <motion.div
              key={`${area.topic_name}-${area.subject_name}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="border-2 border-orange-200 rounded-xl p-5 bg-orange-50"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-gray-900">{area.topic_name}</h4>
                    <Badge variant="outline" className="text-xs">
                      {area.difficulty}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">{area.subject_name}</p>
                </div>
                <div className="flex items-center gap-1 text-orange-600">
                  <TrendingDown className="w-4 h-4" />
                  <span className="font-semibold text-sm">Needs Help</span>
                </div>
              </div>

              <div className="space-y-3">
                {/* Quiz Performance */}
                {area.quiz_attempts > 0 && (
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-gray-700 font-medium">Quiz Performance</span>
                      <span className="text-red-600 font-semibold">
                        Average: {area.average_score.toFixed(1)}%
                      </span>
                    </div>
                    <div className="space-y-1">
                      <Progress
                        value={area.average_score}
                        className="h-2"
                      />
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>
                          {area.quiz_attempts} attempt{area.quiz_attempts !== 1 ? 's' : ''}
                        </span>
                        <span>Lowest: {area.lowest_score.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Lesson Completion */}
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-700 font-medium">Lesson Completion</span>
                    <span className="text-gray-600">
                      {area.completion_rate.toFixed(0)}%
                    </span>
                  </div>
                  <div className="space-y-1">
                    <Progress
                      value={area.completion_rate}
                      className="h-2"
                    />
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>
                        {area.lessons_completed} of {area.total_lessons} lessons completed
                      </span>
                    </div>
                  </div>
                </div>

                {/* Why They're Struggling */}
                <div className="mt-4 p-3 bg-white rounded-lg border border-orange-200">
                  <h5 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-orange-600" />
                    Why This Area Needs Attention:
                  </h5>
                  <ul className="space-y-1 text-sm text-gray-700">
                    {area.average_score < 70 && area.quiz_attempts > 0 && (
                      <li className="flex items-start gap-2">
                        <span className="text-orange-500 mt-0.5">•</span>
                        <span>
                          Quiz scores are below 70% (average: {area.average_score.toFixed(1)}%),
                          indicating difficulty understanding the concepts.
                        </span>
                      </li>
                    )}
                    {area.completion_rate < 50 && (
                      <li className="flex items-start gap-2">
                        <span className="text-orange-500 mt-0.5">•</span>
                        <span>
                          Only {area.completion_rate.toFixed(0)}% of lessons completed,
                          suggesting the topic may be too challenging or needs more time.
                        </span>
                      </li>
                    )}
                    {area.quiz_attempts === 0 && area.completion_rate < 50 && (
                      <li className="flex items-start gap-2">
                        <span className="text-orange-500 mt-0.5">•</span>
                        <span>
                          No quiz attempts yet and low lesson completion - your child may need
                          encouragement to engage with this topic.
                        </span>
                      </li>
                    )}
                  </ul>
                </div>

                {area.last_attempt_date && (
                  <p className="text-xs text-gray-500 mt-2">
                    Last activity: {new Date(area.last_attempt_date).toLocaleDateString()}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
