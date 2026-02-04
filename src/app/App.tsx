import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@/app/components/AppLayout';
import { ErrorBoundary } from '@/app/components/ErrorBoundary';
import { Curriculum, UserProfile } from '@/types';
import { supabase } from '@/lib/supabaseClient';

// Lazy load components for code splitting
const HomeScreen = lazy(() => import('@/app/components/HomeScreen').then(m => ({ default: m.HomeScreen })));
const AboutScreen = lazy(() => import('@/app/components/AboutScreen').then(m => ({ default: m.AboutScreen })));
const LoginScreen = lazy(() => import('@/app/components/LoginScreen').then(m => ({ default: m.LoginScreen })));
const SignupScreen = lazy(() => import('@/app/components/SignupScreen').then(m => ({ default: m.SignupScreen })));
const ForgotPasswordScreen = lazy(() => import('@/app/components/ForgotPasswordScreen').then(m => ({ default: m.ForgotPasswordScreen })));
const ResetPasswordScreen = lazy(() => import('@/app/components/ResetPasswordScreen').then(m => ({ default: m.ResetPasswordScreen })));
const DashboardScreen = lazy(() => import('@/app/components/DashboardScreen').then(m => ({ default: m.DashboardScreen })));
const SubjectsScreen = lazy(() => import('@/app/components/SubjectsScreen').then(m => ({ default: m.SubjectsScreen })));
const LessonScreen = lazy(() => import('@/app/components/LessonScreen').then(m => ({ default: m.LessonScreen })));
const LessonDetailScreen = lazy(() => import('@/app/components/LessonDetailScreen').then(m => ({ default: m.LessonDetailScreen })));
const QuizScreen = lazy(() => import('@/app/components/QuizScreen').then(m => ({ default: m.QuizScreen })));
const ProgressScreen = lazy(() => import('@/app/components/ProgressScreen').then(m => ({ default: m.ProgressScreen })));
const AchievementsScreen = lazy(() => import('@/app/components/AchievementsScreen').then(m => ({ default: m.AchievementsScreen })));
const UserMessaging = lazy(() => import('@/app/components/UserMessaging').then(m => ({ default: m.UserMessaging })));
const ProfileScreen = lazy(() => import('@/app/components/ProfileScreen').then(m => ({ default: m.ProfileScreen })));
const ParentPortalLogin = lazy(() => import('@/app/components/ParentPortalLogin').then(m => ({ default: m.ParentPortalLogin })));
const ParentPortalDashboard = lazy(() => import('@/app/components/ParentPortalDashboard').then(m => ({ default: m.ParentPortalDashboard })));
const AdminLoginScreen = lazy(() => import('@/app/components/AdminLoginScreen').then(m => ({ default: m.AdminLoginScreen })));
const AdminDashboard = lazy(() => import('@/app/components/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const HelpScreen = lazy(() => import('@/app/components/HelpScreen').then(m => ({ default: m.HelpScreen })));

// Loading fallback component
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
    <div className="text-sm text-gray-500">Loading...</div>
  </div>
);

export default function App() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const buildProfile = (options: {
    name?: string | null;
    grade?: string | number | null;
    curriculum?: string | null;
  }): UserProfile => {
    const resolvedGrade = Number(options.grade ?? 8);
    const safeGrade = Number.isNaN(resolvedGrade) ? 8 : resolvedGrade;
    const curriculum =
      options.curriculum === 'IEB' || options.curriculum === 'CAPS'
        ? (options.curriculum as Curriculum)
        : 'CAPS';
    return {
      name: options.name || 'Student',
      grade: safeGrade,
      curriculum,
      gradeLevel: safeGrade <= 7 ? 'primary' : 'high-school',
    };
  };

  useEffect(() => {
    let isActive = true;

    const loadProfile = async () => {
      if (!supabase) {
        if (isActive) {
          setIsAuthReady(true);
        }
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const sessionUser = sessionData.session?.user;

      if (!sessionUser) {
        if (isActive) {
          setUserProfile(null);
          setIsAuthReady(true);
        }
        return;
      }

      // Allow access even if email is not confirmed
      // We'll show a banner reminder instead of blocking access

      const { data: profileRow } = await supabase
        .from('profiles')
        .select('full_name, grade')
        .eq('id', sessionUser.id)
        .maybeSingle();

      if (isActive) {
        setUserProfile(
          buildProfile({
            name: profileRow?.full_name ?? sessionUser.user_metadata?.full_name ?? sessionUser.email,
            grade: profileRow?.grade ?? sessionUser.user_metadata?.grade,
            curriculum: sessionUser.user_metadata?.curriculum,
          })
        );
        setIsAuthReady(true);
      }
    };

    loadProfile();

    if (!supabase) {
      return () => undefined;
    }

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isActive) {
        return;
      }

      if (!session?.user) {
        setUserProfile(null);
        setIsAuthReady(true);
        return;
      }

      setUserProfile(
        buildProfile({
          name: session.user.user_metadata?.full_name ?? session.user.email,
          grade: session.user.user_metadata?.grade,
          curriculum: session.user.user_metadata?.curriculum,
        })
      );
      setIsAuthReady(true);

      // Send welcome message when user signs in (non-blocking)
      if (event === 'SIGNED_IN' && supabase) {
        // Don't await - run in background so it doesn't block auth
        (async () => {
          try {
            // Check if we've already sent a welcome message in this session
            const sessionKey = `welcome_sent_${session.user.id}`;
            if (sessionStorage.getItem(sessionKey)) {
              return; // Already sent in this session
            }

            // Call the database function to send welcome message with timeout
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Timeout')), 5000); // 5 second timeout
            });

            const rpcPromise = supabase.rpc('send_welcome_message', {
              target_user_id: session.user.id,
            });

            const { error } = await Promise.race([rpcPromise, timeoutPromise]) as any;

            if (!error) {
              // Mark that we've sent the welcome message for this session
              sessionStorage.setItem(sessionKey, 'true');
            }
          } catch (error) {
            // Silently fail - don't log to avoid console spam
            // The function might not exist yet if migration hasn't run
          }
        })();
      }
    });

    return () => {
      isActive = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
        <Route 
          path="/" 
            element={
              userProfile ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <HomeScreen />
              )
            } 
          />
        <Route 
          path="/about" 
          element={
            userProfile ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <AboutScreen />
            )
          } 
        />
        <Route 
          path="/login" 
          element={
            userProfile ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <LoginScreen />
            )
          } 
        />
        <Route 
          path="/signup" 
          element={
            userProfile ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <SignupScreen />
            )
          } 
        />
        <Route 
          path="/forgot-password" 
          element={
            userProfile ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <ForgotPasswordScreen />
            )
          } 
        />
        <Route 
          path="/reset-password" 
          element={
            userProfile ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <ResetPasswordScreen />
            )
          } 
        />
        <Route 
          path="/dashboard" 
          element={
            userProfile ? (
              <AppLayout profile={userProfile}>
              <DashboardScreen profile={userProfile} />
              </AppLayout>
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        <Route 
          path="/subjects" 
          element={
            userProfile ? (
              <AppLayout profile={userProfile}>
              <SubjectsScreen />
              </AppLayout>
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        <Route 
          path="/subjects/:subjectId" 
          element={
            userProfile ? (
              <AppLayout profile={userProfile}>
              <SubjectsScreen />
              </AppLayout>
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        <Route 
          path="/subjects/:subjectId/:topicId" 
          element={
            userProfile ? (
              <AppLayout profile={userProfile}>
              <LessonScreen />
              </AppLayout>
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        <Route 
          path="/subjects/:subjectId/:topicId/lesson/:lessonId" 
          element={
            userProfile ? (
              <AppLayout profile={userProfile}>
              <LessonDetailScreen />
              </AppLayout>
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        <Route 
          path="/quiz/:topicId" 
          element={
            userProfile ? (
              <AppLayout profile={userProfile}>
              <QuizScreen />
              </AppLayout>
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        <Route 
          path="/progress" 
          element={
            userProfile ? (
              <AppLayout profile={userProfile}>
              <ProgressScreen />
              </AppLayout>
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        <Route 
          path="/achievements" 
          element={
            userProfile ? (
              <AppLayout profile={userProfile}>
                <AchievementsScreen />
              </AppLayout>
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        <Route 
          path="/messages" 
          element={
            userProfile ? (
              <AppLayout profile={userProfile}>
                <UserMessaging />
              </AppLayout>
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        <Route 
          path="/profile" 
          element={
            userProfile ? (
              <AppLayout profile={userProfile}>
                <ProfileScreen profile={userProfile} />
              </AppLayout>
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        <Route 
          path="/admin/login" 
          element={<AdminLoginScreen />} 
        />
        <Route 
          path="/admin/dashboard" 
          element={<AdminDashboard />} 
        />
        <Route 
          path="/parent-portal/login" 
          element={<ParentPortalLogin />} 
        />
        <Route 
          path="/parent-portal" 
          element={<ParentPortalDashboard />} 
        />
        <Route 
          path="/help" 
          element={
            userProfile ? (
              <AppLayout profile={userProfile}>
                <HelpScreen />
              </AppLayout>
            ) : (
              <HelpScreen />
            )
          } 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </Router>
    </ErrorBoundary>
  );
}
