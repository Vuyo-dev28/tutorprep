import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Button } from '@/app/components/ui/button';
import { Progress } from '@/app/components/ui/progress';
import { Badge } from '@/app/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import {
  User,
  TrendingUp,
  BookOpen,
  Award,
  Clock,
  AlertTriangle,
  ChevronRight,
  LogOut,
  BarChart3,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Header } from '@/app/components/Header';
import { StudentProgressReport } from './StudentProgressReport';
import { StrugglingAreasReport } from './StrugglingAreasReport';

type StudentProgress = {
  link_id: string;
  parent_email: string;
  access_code: string;
  student_id: string;
  student_name: string;
  student_grade: string;
  student_curriculum: string;
  topics_completed: number;
  total_topics: number;
  lessons_completed: number;
  total_lessons: number;
  quiz_attempts: number;
  average_quiz_score: number;
  total_study_minutes: number;
  last_study_date: string | null;
  study_days_last_30: number;
};

export function ParentPortalDashboard() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<StudentProgress[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const loadStudents = async () => {
      if (!supabase) {
        setErrorMessage('System error. Please try again later.');
        setIsLoading(false);
        return;
      }

      // Get parent access info from sessionStorage
      const parentEmail = sessionStorage.getItem('parent_email');
      const accessCode = sessionStorage.getItem('parent_access_code');
      const studentIdsJson = sessionStorage.getItem('parent_students');

      if (!studentIdsJson) {
        setErrorMessage('No access information found. Please log in again.');
        setIsLoading(false);
        return;
      }

      try {
        // First, get the parent-student links to find which students are linked
        let linksQuery = supabase
          .from('parent_student_links')
          .select('*, profiles!parent_student_links_student_id_fkey(id, full_name, grade, curriculum)')
          .eq('is_active', true);

        if (parentEmail) {
          linksQuery = linksQuery.eq('parent_email', parentEmail);
        } else if (accessCode) {
          linksQuery = linksQuery.eq('access_code', accessCode.toUpperCase().trim());
        } else {
          setErrorMessage('Invalid access. Please log in again.');
          setIsLoading(false);
          return;
        }

        const { data: links, error: linksError } = await linksQuery;

        if (linksError) throw linksError;

        if (!links || links.length === 0) {
          setErrorMessage('No students found. Please contact support.');
          setIsLoading(false);
          return;
        }

        // Now try to get progress data from the view, but fallback to basic info if view is empty
        let progressQuery = supabase.from('parent_student_progress').select('*');

        if (parentEmail) {
          progressQuery = progressQuery.eq('parent_email', parentEmail);
        } else if (accessCode) {
          progressQuery = progressQuery.eq('access_code', accessCode.toUpperCase().trim());
        }

        const { data: progressData, error: progressError } = await progressQuery;

        // If view has data, use it; otherwise build from links
        if (progressData && progressData.length > 0) {
          setStudents(progressData as StudentProgress[]);
          if (!selectedStudentId) {
            setSelectedStudentId(progressData[0].student_id);
          }
        } else {
          // Build student progress from links (with default/zero values)
          const studentsFromLinks: StudentProgress[] = links.map((link: any) => ({
            link_id: link.id,
            parent_email: link.parent_email,
            access_code: link.access_code,
            student_id: link.student_id,
            student_name: link.profiles?.full_name || 'Unknown',
            student_grade: link.profiles?.grade?.toString() || 'N/A',
            student_curriculum: link.profiles?.curriculum || 'CAPS',
            topics_completed: 0,
            total_topics: 0,
            lessons_completed: 0,
            total_lessons: 0,
            quiz_attempts: 0,
            average_quiz_score: 0,
            total_study_minutes: 0,
            last_study_date: null,
            study_days_last_30: 0,
          }));

          setStudents(studentsFromLinks);
          if (!selectedStudentId && studentsFromLinks.length > 0) {
            setSelectedStudentId(studentsFromLinks[0].student_id);
          }
        }
      } catch (error: any) {
        console.error('Error loading students:', error);
        setErrorMessage(error.message || 'Failed to load student data.');
      } finally {
        setIsLoading(false);
      }
    };

    loadStudents();
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem('parent_email');
    sessionStorage.removeItem('parent_access_code');
    sessionStorage.removeItem('parent_students');
    navigate('/parent-portal/login');
  };

  const selectedStudent = students.find((s) => s.student_id === selectedStudentId);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f5f5f7]">
        <Header isAuthenticated={false} />
        <div className="flex items-center justify-center pt-32 min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading student progress...</p>
          </div>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen bg-[#f5f5f7]">
        <Header isAuthenticated={false} />
        <div className="flex items-center justify-center pt-32 min-h-screen">
          <div className="bg-white rounded-2xl p-8 max-w-md shadow-lg">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Error</h2>
              <p className="text-gray-600 mb-6">{errorMessage}</p>
              <Button onClick={handleLogout} variant="outline">
                <LogOut className="w-4 h-4 mr-2" />
                Go Back
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <Header isAuthenticated={false} />
      <div className="pt-32 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Parent Portal</h1>
                <p className="text-gray-600 mt-1">Track your children's learning progress</p>
              </div>
              <Button onClick={handleLogout} variant="outline">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>

          {/* Student Selection */}
          {students.length > 1 && (
            <div className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Select Student</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {students.map((student) => (
                  <motion.button
                    key={student.student_id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedStudentId(student.student_id)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      selectedStudentId === student.student_id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                        <User className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{student.student_name}</h3>
                        <p className="text-sm text-gray-500">
                          Grade {student.student_grade} • {student.student_curriculum}
                        </p>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {/* Student Progress Dashboard */}
          {selectedStudent && (
            <div className="space-y-6">
              {/* Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-xl p-6 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-600">Topics Completed</h3>
                    <BookOpen className="w-5 h-5 text-blue-500" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {selectedStudent.topics_completed} / {selectedStudent.total_topics}
                  </p>
                  <Progress
                    value={
                      selectedStudent.total_topics > 0
                        ? (selectedStudent.topics_completed / selectedStudent.total_topics) * 100
                        : 0
                    }
                    className="mt-3"
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white rounded-xl p-6 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-600">Lessons Completed</h3>
                    <TrendingUp className="w-5 h-5 text-green-500" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {selectedStudent.lessons_completed} / {selectedStudent.total_lessons}
                  </p>
                  <Progress
                    value={
                      selectedStudent.total_lessons > 0
                        ? (selectedStudent.lessons_completed / selectedStudent.total_lessons) * 100
                        : 0
                    }
                    className="mt-3"
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-white rounded-xl p-6 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-600">Average Quiz Score</h3>
                    <Award className="w-5 h-5 text-yellow-500" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {selectedStudent.average_quiz_score.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedStudent.quiz_attempts} attempt{selectedStudent.quiz_attempts !== 1 ? 's' : ''}
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white rounded-xl p-6 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-600">Study Time</h3>
                    <Clock className="w-5 h-5 text-purple-500" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {Math.round(selectedStudent.total_study_minutes / 60)}h
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedStudent.study_days_last_30} days in last 30
                  </p>
                </motion.div>
              </div>

              {/* Detailed Reports */}
              <Tabs defaultValue="progress" className="bg-white rounded-2xl p-6 shadow-sm">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="progress">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Progress Report
                  </TabsTrigger>
                  <TabsTrigger value="struggling">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Struggling Areas
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="progress" className="mt-6">
                  <StudentProgressReport studentId={selectedStudent.student_id} />
                </TabsContent>
                <TabsContent value="struggling" className="mt-6">
                  <StrugglingAreasReport studentId={selectedStudent.student_id} />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
