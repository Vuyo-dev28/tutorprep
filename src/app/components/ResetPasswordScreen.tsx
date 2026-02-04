import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { supabase } from '@/lib/supabaseClient';
import { Header } from './Header';
import { Lock, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';

export function ResetPasswordScreen() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidatingLink, setIsValidatingLink] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLinkValid, setIsLinkValid] = useState(false);

  useEffect(() => {
    const validateAndSetSession = async () => {
      if (!supabase) {
        setIsValidatingLink(false);
        setErrorMessage('Supabase is not configured.');
        return;
      }

      try {
        // Check if we have the hash from the email link
        const hash = window.location.hash;
        
        if (!hash) {
          setIsValidatingLink(false);
          setErrorMessage('Invalid reset link. Please request a new password reset.');
          return;
        }

        // Extract the tokens from the hash
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const type = params.get('type');

        if (type !== 'recovery' || !accessToken) {
          setIsValidatingLink(false);
          setErrorMessage('Invalid reset link. Please request a new password reset.');
          return;
        }

        // Set the session using the tokens from the URL
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        });

        if (error) {
          console.error('Error setting session:', error);
          setIsValidatingLink(false);
          setErrorMessage('This reset link has expired or is invalid. Please request a new password reset.');
          return;
        }

        if (data.session) {
          // Verify we have a valid user
          const { data: { user } } = await supabase.auth.getUser();
          
          if (user) {
            setIsLinkValid(true);
            // Clear the hash from URL for security
            window.history.replaceState(null, '', window.location.pathname);
          } else {
            setIsValidatingLink(false);
            setErrorMessage('Unable to verify your session. Please request a new password reset.');
          }
        } else {
          setIsValidatingLink(false);
          setErrorMessage('This reset link has expired or is invalid. Please request a new password reset.');
        }
      } catch (error: any) {
        console.error('Error validating reset link:', error);
        setIsValidatingLink(false);
        setErrorMessage('An error occurred while validating your reset link. Please try again.');
      } finally {
        setIsValidatingLink(false);
      }
    };

    validateAndSetSession();
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!isLinkValid) {
      setErrorMessage('Please use a valid password reset link.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters');
      return;
    }

    if (!supabase) {
      setErrorMessage('Supabase is not configured.');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        setErrorMessage(error.message);
        setIsLoading(false);
        return;
      }

      setSuccessMessage('Password updated successfully! Redirecting to login...');
      
      // Sign out the recovery session and redirect to login
      await supabase.auth.signOut();
      
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error: any) {
      console.error('Error updating password:', error);
      setErrorMessage('An error occurred while updating your password. Please try again.');
      setIsLoading(false);
    }
  };

  // Show loading state while validating the link
  if (isValidatingLink) {
    return (
      <div className="min-h-screen bg-[#f5f5f7]">
        <Header isAuthenticated={false} />
        <div className="flex items-center justify-center pt-32 min-h-screen px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-md bg-white rounded-[32px] p-8 shadow-2xl ring-1 ring-slate-200"
          >
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
              <h1 className="text-2xl font-semibold text-slate-900 mb-2">Validating Reset Link</h1>
              <p className="text-slate-600">Please wait while we verify your password reset link...</p>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Show error state if link is invalid
  if (!isLinkValid && errorMessage) {
    return (
      <div className="min-h-screen bg-[#f5f5f7]">
        <Header isAuthenticated={false} />
        <div className="flex items-center justify-center pt-32 min-h-screen px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-md bg-white rounded-[32px] p-8 shadow-2xl ring-1 ring-slate-200"
          >
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-rose-600" />
              </div>
              <h1 className="text-2xl font-semibold text-slate-900 mb-2">Invalid Reset Link</h1>
              <p className="text-slate-600 mb-6">{errorMessage}</p>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium mb-1">This link may have expired or already been used.</p>
                  <p>Password reset links are valid for 1 hour and can only be used once.</p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Link to="/forgot-password">
                  <Button className="w-full h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30">
                    Request New Reset Link
                  </Button>
                </Link>
                <Link to="/login">
                  <Button
                    variant="outline"
                    className="w-full h-12 rounded-full border-2"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Login
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Show password reset form if link is valid
  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <Header isAuthenticated={false} />
      <div className="flex items-center justify-center pt-32 min-h-screen px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md bg-white rounded-[32px] p-8 shadow-2xl ring-1 ring-slate-200"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-3xl font-semibold text-slate-900 mb-2">Set New Password</h1>
            <p className="text-slate-600">Enter your new password below</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {errorMessage && (
              <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
            {successMessage && (
              <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                {successMessage}
              </div>
            )}

            <div>
              <Label htmlFor="reset-password" className="text-gray-700 mb-2 block">
                New Password
              </Label>
              <Input
                id="reset-password"
                type="password"
                placeholder="Enter new password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 rounded-2xl bg-gray-50 border-0 focus:bg-white focus:ring-2 focus:ring-blue-600 transition-all"
                required
                minLength={6}
                disabled={isLoading || !!successMessage}
              />
              <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters</p>
            </div>

            <div>
              <Label htmlFor="reset-confirm" className="text-gray-700 mb-2 block">
                Confirm Password
              </Label>
              <Input
                id="reset-confirm"
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="h-12 rounded-2xl bg-gray-50 border-0 focus:bg-white focus:ring-2 focus:ring-blue-600 transition-all"
                required
                minLength={6}
                disabled={isLoading || !!successMessage}
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30"
              disabled={isLoading || !!successMessage || !isLinkValid}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Password'
              )}
            </Button>

            <div className="text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </Link>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
