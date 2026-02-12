import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@/app/components/AppLayout';
import { ErrorBoundary } from '@/app/components/ErrorBoundary';
import { SubscriptionCallbackHandler } from '@/app/components/SubscriptionCallbackHandler';
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
const ProductSelectionScreen = lazy(() => import('@/app/components/ProductSelectionScreen').then(m => ({ default: m.ProductSelectionScreen })));
const PastPapersDashboard = lazy(() => import('@/app/components/PastPapersDashboard').then(m => ({ default: m.PastPapersDashboard })));
const DashboardWrapper = lazy(() => import('@/app/components/DashboardWrapper').then(m => ({ default: m.DashboardWrapper })));

// Loading fallback component
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
    <div className="text-sm text-gray-500">Loading...</div>
  </div>
);

export default function App() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userProduct, setUserProduct] = useState<'TUTOR' | 'PAST PAPERS' | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const debugAuth = (...args: any[]) => {
    if (import.meta.env.DEV) {
      console.debug('[auth]', ...args);
    }
  };

  const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, fallback: T) => {
    const timeout = new Promise<T>(resolve => {
      setTimeout(() => resolve(fallback), timeoutMs);
    });
    return Promise.race([promise, timeout]);
  };

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

      debugAuth('app:loadProfile:start');
      const { data: sessionData } = await withTimeout(
        supabase.auth.getSession(),
        3000,
        { data: { session: null } } as any
      );
      
      const sessionUser = sessionData.session?.user;

      if (!sessionUser) {
        if (isActive) {
          debugAuth('app:loadProfile:no-session');
          setUserProfile(null);
          setIsAuthReady(true);
        }
        return;
      }

      // Allow access even if email is not confirmed
      // We'll show a banner reminder instead of blocking access

      debugAuth('app:profile:query:start', { userId: sessionUser.id });
      const { data: profileRow } = await withTimeout(
        supabase
          .from('profiles')
          .select('full_name, grade, product')
          .eq('id', sessionUser.id)
          .maybeSingle(),
        4000,
        { data: null } as any
      );
      debugAuth('app:profile:query:resolved', { hasProfile: Boolean(profileRow) });

      if (isActive) {
        setUserProfile(
          buildProfile({
            name: profileRow?.full_name ?? sessionUser.user_metadata?.full_name ?? sessionUser.email,
            grade: profileRow?.grade ?? sessionUser.user_metadata?.grade,
            curriculum: sessionUser.user_metadata?.curriculum,
          })
        );
        // Set product if it exists and is valid
        if (profileRow?.product === 'TUTOR' || profileRow?.product === 'PAST PAPERS') {
          setUserProduct(profileRow.product);
        } else {
          setUserProduct(null);
        }
        setIsAuthReady(true);
      }
    };

    loadProfile();

    if (!supabase) {
      return () => undefined;
    }

    // Function to manually refresh profile and product (exposed globally)
    const refreshUserData = async () => {
      if (!supabase || !isActive) return;

      debugAuth('app:refreshUserData:start');
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionUser = sessionData.session?.user;

      if (!sessionUser) {
        if (isActive) {
          setUserProfile(null);
          setUserProduct(null);
        }
        return;
      }

      const { data: profileRow } = await supabase
        .from('profiles')
        .select('full_name, grade, product')
        .eq('id', sessionUser.id)
        .maybeSingle();
      debugAuth('app:refreshUserData:profile', { hasProfile: Boolean(profileRow) });

      if (isActive) {
        setUserProfile(
          buildProfile({
            name: profileRow?.full_name ?? sessionUser.user_metadata?.full_name ?? sessionUser.email,
            grade: profileRow?.grade ?? sessionUser.user_metadata?.grade,
            curriculum: sessionUser.user_metadata?.curriculum,
          })
        );
        
        if (profileRow?.product === 'TUTOR' || profileRow?.product === 'PAST PAPERS') {
          setUserProduct(profileRow.product);
        } else {
          setUserProduct(null);
        }
      }
    };
    
    // Expose refresh function globally for ProductSelectionScreen to call
    (window as any).refreshUserData = refreshUserData;

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isActive) {
        return;
      }

      debugAuth('app:onAuthStateChange', { event, hasSession: Boolean(session?.user) });
      if (!session?.user) {
        setUserProfile(null);
        setUserProduct(null);
        setIsAuthReady(true);
        return;
      }

      // Load profile with product
      if (supabase) {
        debugAuth('app:onAuthStateChange:profile:start', { userId: session.user.id });
        const { data: profileRow } = await withTimeout(
          supabase
            .from('profiles')
            .select('full_name, grade, product')
            .eq('id', session.user.id)
            .maybeSingle(),
          4000,
          { data: null } as any
        );
        debugAuth('app:onAuthStateChange:profile:resolved', { hasProfile: Boolean(profileRow) });

        setUserProfile(
          buildProfile({
            name: profileRow?.full_name ?? session.user.user_metadata?.full_name ?? session.user.email,
            grade: profileRow?.grade ?? session.user.user_metadata?.grade,
            curriculum: session.user.user_metadata?.curriculum,
          })
        );
        
        // Set product if it exists and is valid
        if (profileRow?.product === 'TUTOR' || profileRow?.product === 'PAST PAPERS') {
          setUserProduct(profileRow.product);
        } else {
          setUserProduct(null);
        }
      } else {
        setUserProfile(
          buildProfile({
            name: session.user.user_metadata?.full_name ?? session.user.email,
            grade: session.user.user_metadata?.grade,
            curriculum: session.user.user_metadata?.curriculum,
          })
        );
        setUserProduct(null);
      }
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
      delete (window as any).refreshUserData;
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
          <SubscriptionCallbackHandler />
          <Routes>
        <Route 
          path="/" 
            element={
              userProfile && userProduct ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <HomeScreen />
              )
            } 
          />
        <Route 
          path="/about" 
          element={
            userProfile && userProduct ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <AboutScreen />
            )
          } 
        />
        <Route 
          path="/login" 
          element={
            userProfile && userProduct ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <LoginScreen />
            )
          } 
        />
        <Route 
          path="/signup" 
          element={
            userProfile && userProduct ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <SignupScreen />
            )
          } 
        />
        <Route 
          path="/forgot-password" 
          element={
            userProfile && userProduct ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <ForgotPasswordScreen />
            )
          } 
        />
        <Route 
          path="/reset-password" 
          element={<ResetPasswordScreen />}
        />
        <Route 
          path="/select-product" 
          element={<ProductSelectionScreen />}
        />
        <Route 
          path="/dashboard" 
          element={
            userProfile ? (
              <DashboardWrapper profile={userProfile} />
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
