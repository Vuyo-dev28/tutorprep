import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, TrendingDown, BookOpen, Target, Lightbulb, CheckCircle2, Clock } from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';
import { supabase } from '@/lib/supabaseClient';
import { generateDailyReport, getTodayReport, DailyReport as DailyReportType, StrugglingTopic, NeedsWork } from '@/lib/reportService';

export function DailyReport() {
  const [report, setReport] = useState<DailyReportType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    loadReport();

    // Auto-refresh report every 30 minutes
    const interval = setInterval(() => {
      loadReport();
    }, 30 * 60 * 1000); // 30 minutes

    return () => clearInterval(interval);
  }, []);

  const loadReport = async () => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      if (!userId) {
        setIsLoading(false);
        return;
      }

      // Try to get today's report (within last 30 minutes)
      let todayReport = await getTodayReport(userId);

      // If no recent report exists (older than 30 minutes), generate a new one
      if (!todayReport) {
        setIsGenerating(true);
        todayReport = await generateDailyReport(userId);
        setIsGenerating(false);
      }

      setReport(todayReport);
    } catch (error) {
      console.error('Error loading report:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!supabase) return;

    setIsGenerating(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      if (!userId) return;

      // Delete today's report and generate a new one
      const today = new Date().toISOString().split('T')[0];
      await supabase
        .from('daily_reports')
        .delete()
        .eq('user_id', userId)
        .eq('report_date', today);

      const newReport = await generateDailyReport(userId);
      setReport(newReport);
    } catch (error) {
      console.error('Error regenerating report:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading || isGenerating) {
    return (
      <div className="bg-white rounded-3xl p-6 shadow-sm">
        <div className="text-center py-8 text-gray-500">
          {isGenerating ? 'Generating your daily report...' : 'Loading report...'}
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="bg-white rounded-3xl p-6 shadow-sm">
        <div className="text-center py-8 text-gray-500">
          No report available. Start studying to generate your first report!
        </div>
      </div>
    );
  }

  const strugglingTopics = (report.strugglingTopics || []) as StrugglingTopic[];
  const needsWork = (report.needsWork || []) as NeedsWork[];

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-500" />
            Daily Learning Report
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {new Date(report.reportDate).toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })} • Updated {new Date(report.createdAt).toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </p>
        </div>
        <button
          onClick={handleRegenerate}
          disabled={isGenerating}
          className="text-xs text-blue-600 hover:text-blue-700 underline"
        >
          Regenerate
        </button>
      </div>

      {/* Overall Performance */}
      <div className="mb-6 p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl border border-blue-100">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-gray-900 mb-1">Overall Performance</h4>
            <p className="text-sm text-gray-700">{report.overallPerformance}</p>
          </div>
        </div>
      </div>

      {/* Struggling Topics */}
      {strugglingTopics.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-orange-500" />
            <h4 className="font-semibold">Areas Struggling With</h4>
            <Badge variant="destructive" className="bg-orange-100 text-orange-700 border-orange-300">
              {strugglingTopics.length}
            </Badge>
          </div>
          <div className="space-y-3">
            {strugglingTopics.slice(0, 5).map((topic, index) => (
              <motion.div
                key={topic.topicId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-4 bg-orange-50 border border-orange-200 rounded-xl"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingDown className="w-4 h-4 text-orange-600" />
                      <h5 className="font-medium text-gray-900">{topic.topicName}</h5>
                      <Badge variant="outline" className="text-xs">
                        {topic.subjectName}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                      <span>Average Score: <strong className="text-orange-700">{topic.averageScore}%</strong></span>
                      <span>Attempts: {topic.attempts}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(topic.lastAttemptDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Needs Work */}
      {needsWork.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-blue-500" />
            <h4 className="font-semibold">Topics to Focus On</h4>
            <Badge variant="secondary">
              {needsWork.length}
            </Badge>
          </div>
          <div className="space-y-3">
            {needsWork.slice(0, 5).map((item, index) => (
              <motion.div
                key={item.topicId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-4 bg-blue-50 border border-blue-200 rounded-xl"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="w-4 h-4 text-blue-600" />
                      <h5 className="font-medium text-gray-900">{item.topicName}</h5>
                      <Badge variant="outline" className="text-xs">
                        {item.subjectName}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                      {item.reason === 'not_started' && 'Not started yet - begin learning this topic'}
                      {item.reason === 'incomplete' && `Incomplete - ${item.progress}% done`}
                      {item.reason === 'stale_progress' && 'No recent activity - revisit this topic'}
                      {item.reason === 'low_score' && 'Low quiz scores - needs more practice'}
                    </p>
                    {item.lastActivity && (
                      <p className="text-xs text-gray-500 mt-1">
                        Last activity: {new Date(item.lastActivity).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {report.recommendations && (
        <div className="mt-6 p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border border-purple-100">
          <div className="flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Recommendations</h4>
              <p className="text-sm text-gray-700 leading-relaxed">{report.recommendations}</p>
            </div>
          </div>
        </div>
      )}

      {strugglingTopics.length === 0 && needsWork.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className="font-medium">Great job! No areas need immediate attention.</p>
          <p className="text-sm mt-1">Keep up the excellent work!</p>
        </div>
      )}
    </div>
  );
}
