import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import {
  Users,
  BookOpen,
  TrendingUp,
  Settings,
  LogOut,
  Plus,
  Edit,
  Trash2,
  BarChart3,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { ContentUploadForm } from './ContentUploadForm';
import { ContentManagement } from './ContentManagement';
import { ContactSubmissions } from './ContactSubmissions';
import { AdminMessages } from './AdminMessages';
import { AdminTutorChat } from './AdminTutorChat';
import { ParentAccessManagement } from './ParentAccessManagement';

type Stats = {
  totalStudents: number;
  totalSubjects: number;
  totalTopics: number;
  totalLessons: number;
  totalQuestions: number;
  totalAchievements: number;
  activeUsers: number;
  totalQuizAttempts: number;
};

export function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    totalStudents: 0,
    totalSubjects: 0,
    totalTopics: 0,
    totalLessons: 0,
    totalQuestions: 0,
    totalAchievements: 0,
    activeUsers: 0,
    totalQuizAttempts: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const checkAdmin = async () => {
      if (!supabase) {
        navigate('/admin/login');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/admin/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile || profile.role !== 'admin') {
        navigate('/admin/login');
        return;
      }

      loadStats();
    };

    checkAdmin();
  }, [navigate]);

  const loadStats = async () => {
    if (!supabase) return;

    try {
      const [
        { count: studentsCount },
        { count: subjectsCount },
        { count: topicsCount },
        { count: lessonsCount },
        { count: questionsCount },
        { count: achievementsCount },
        { count: quizAttemptsCount },
        { data: activeUsersData },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
        supabase.from('subjects').select('*', { count: 'exact', head: true }),
        supabase.from('topics').select('*', { count: 'exact', head: true }),
        supabase.from('lessons').select('*', { count: 'exact', head: true }),
        supabase.from('questions').select('*', { count: 'exact', head: true }),
        supabase.from('achievements').select('*', { count: 'exact', head: true }),
        supabase.from('quiz_attempts').select('*', { count: 'exact', head: true }),
        supabase
          .from('study_sessions')
          .select('user_id')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      const uniqueActiveUsers = new Set((activeUsersData ?? []).map((s) => s.user_id)).size;

      setStats({
        totalStudents: studentsCount ?? 0,
        totalSubjects: subjectsCount ?? 0,
        totalTopics: topicsCount ?? 0,
        totalLessons: lessonsCount ?? 0,
        totalQuestions: questionsCount ?? 0,
        totalAchievements: achievementsCount ?? 0,
        activeUsers: uniqueActiveUsers,
        totalQuizAttempts: quizAttemptsCount ?? 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    navigate('/admin/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-semibold text-lg">Admin Dashboard</h1>
                <p className="text-xs text-gray-500">Content Management & Analytics</p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleSignOut}
              className="rounded-full"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-8">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="upload">Upload Content</TabsTrigger>
            <TabsTrigger value="content">Manage Content</TabsTrigger>
            <TabsTrigger value="contacts">Contact Forms</TabsTrigger>
            <TabsTrigger value="messages">User Messages</TabsTrigger>
            <TabsTrigger value="tutor-chat">Ask A Tutor</TabsTrigger>
            <TabsTrigger value="parent-access">Parent Access</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <Users className="w-8 h-8 text-blue-500" />
                </div>
                <p className="text-3xl font-semibold">{stats.totalStudents}</p>
                <p className="text-sm text-gray-500">Total Students</p>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <BookOpen className="w-8 h-8 text-purple-500" />
                </div>
                <p className="text-3xl font-semibold">{stats.totalSubjects}</p>
                <p className="text-sm text-gray-500">Subjects</p>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="w-8 h-8 text-green-500" />
                </div>
                <p className="text-3xl font-semibold">{stats.activeUsers}</p>
                <p className="text-sm text-gray-500">Active Users (7d)</p>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <BarChart3 className="w-8 h-8 text-orange-500" />
                </div>
                <p className="text-3xl font-semibold">{stats.totalQuizAttempts}</p>
                <p className="text-sm text-gray-500">Quiz Attempts</p>
              </div>
            </div>

            {/* Content Summary */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="font-semibold mb-4">Content Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Topics</span>
                    <span className="font-semibold">{stats.totalTopics}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Lessons</span>
                    <span className="font-semibold">{stats.totalLessons}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Questions</span>
                    <span className="font-semibold">{stats.totalQuestions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Achievements</span>
                    <span className="font-semibold">{stats.totalAchievements}</span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="upload" className="space-y-6">
            <ContentUploadForm />
          </TabsContent>

          <TabsContent value="content" className="space-y-6">
            <ContentManagement />
          </TabsContent>

          <TabsContent value="contacts" className="space-y-6">
            <ContactSubmissions />
          </TabsContent>

          <TabsContent value="messages" className="space-y-6">
            <AdminMessages />
          </TabsContent>

          <TabsContent value="tutor-chat" className="space-y-6">
            <AdminTutorChat />
          </TabsContent>

          <TabsContent value="parent-access" className="space-y-6">
            <ParentAccessManagement />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="text-xl font-semibold mb-4">Analytics</h3>
              <p className="text-gray-500">
                Detailed analytics and reporting coming soon. View student progress, engagement metrics, and performance data.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
