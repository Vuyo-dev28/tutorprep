import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { X, Mail, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function EmailVerificationBanner() {
  const [isEmailVerified, setIsEmailVerified] = useState<boolean | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const checkEmailVerification = async () => {
      if (!supabase) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsEmailVerified(true);
        return;
      }

      // Check if email is verified
      setIsEmailVerified(user.email_confirmed_at !== null);

      // Check if user has dismissed the banner in this session
      const dismissedKey = `email_banner_dismissed_${user.id}`;
      if (sessionStorage.getItem(dismissedKey)) {
        setIsDismissed(true);
      }
    };

    checkEmailVerification();

    // Listen for auth state changes (e.g., when email is verified)
    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setIsEmailVerified(session.user.email_confirmed_at !== null);
        if (session.user.email_confirmed_at) {
          // Email verified, remove dismissed flag
          const dismissedKey = `email_banner_dismissed_${session.user.id}`;
          sessionStorage.removeItem(dismissedKey);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleResendVerification = async () => {
    if (!supabase) return;

    setIsResending(true);
    setResendMessage('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        setResendMessage('Unable to get your email address.');
        setIsResending(false);
        return;
      }

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
      });

      if (error) {
        setResendMessage('Failed to resend email. Please try again later.');
      } else {
        setResendMessage('Verification email sent! Please check your inbox.');
      }
    } catch (error) {
      setResendMessage('An error occurred. Please try again later.');
    } finally {
      setIsResending(false);
      setTimeout(() => setResendMessage(''), 5000);
    }
  };

  const handleDismiss = async () => {
    if (!supabase) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const dismissedKey = `email_banner_dismissed_${user.id}`;
      sessionStorage.setItem(dismissedKey, 'true');
      setIsDismissed(true);
    }
  };

  // Don't show if email is verified, dismissed, or still checking
  if (isEmailVerified === null || isEmailVerified || isDismissed) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-amber-50 border-b border-amber-200"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-amber-800">
                  <strong>Please verify your email address.</strong> Check your inbox for a verification link. 
                  You can continue using the app, but please verify your email to ensure account security.
                </p>
                {resendMessage && (
                  <p className={`text-xs mt-1 ${resendMessage.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>
                    {resendMessage}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <button
                onClick={handleResendVerification}
                disabled={isResending}
                className="text-sm font-medium text-amber-700 hover:text-amber-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors"
              >
                <Mail className="w-4 h-4" />
                {isResending ? 'Sending...' : 'Resend Email'}
              </button>
              <button
                onClick={handleDismiss}
                className="text-amber-600 hover:text-amber-800 p-1 rounded-lg hover:bg-amber-100 transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
