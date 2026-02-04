import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { supabase } from '@/lib/supabaseClient';
import { motion } from 'motion/react';
import { Header } from '@/app/components/Header';

const sendWelcomeMessage = async () => {
  if (!supabase) return;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check if we've already sent a welcome message in this session
    const sessionKey = `welcome_sent_${user.id}`;
    if (sessionStorage.getItem(sessionKey)) {
      return; // Already sent in this session
    }

    // Call the database function to send welcome message with timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), 5000); // 5 second timeout
    });

    const rpcPromise = supabase.rpc('send_welcome_message', {
      target_user_id: user.id,
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
};

export function LoginScreen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    if (!supabase) {
      setErrorMessage('Supabase is not configured. Check your environment variables.');
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsLoading(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    // Send welcome message to tutor chat (non-blocking)
    sendWelcomeMessage().catch((err) => {
      console.error('Error sending welcome message:', err);
    });

    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
      <Header isAuthenticated={false} />
      <div className="flex items-center justify-center p-4 sm:p-6 pt-20 sm:pt-24 md:pt-32">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-6 sm:mb-8">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.5, type: 'spring' }}
              className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-2xl sm:rounded-[28px] flex items-center justify-center text-3xl sm:text-4xl shadow-xl mx-auto mb-4 sm:mb-5"
            >
              🔐
            </motion.div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">Welcome back</h1>
            <p className="text-slate-600 mt-2">Log in to keep learning</p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-white rounded-[32px] p-8 shadow-2xl ring-1 ring-slate-200"
          >
            <form onSubmit={handleSubmit} className="space-y-5">
              {errorMessage && (
                <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
                  {errorMessage}
                </div>
              )}
              <div>
                <Label htmlFor="login-email" className="text-gray-700 mb-2 block">
                  Email
                </Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-12 rounded-2xl bg-gray-50 border-0 focus:bg-white focus:ring-2 focus:ring-blue-600 transition-all"
                  required
                />
              </div>

              <div>
                <Label htmlFor="login-password" className="text-gray-700 mb-2 block">
                  Password
                </Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-12 rounded-2xl bg-gray-50 border-0 focus:bg-white focus:ring-2 focus:ring-blue-600 transition-all"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30"
                disabled={isLoading}
              >
                {isLoading ? 'Logging in...' : 'Log in'}
              </Button>
            </form>

            <div className="flex items-center justify-between text-sm mt-6">
              <Link to="/signup" className="text-blue-600 hover:text-blue-700">
                Create an account
              </Link>
              <Link to="/forgot-password" className="text-blue-600 hover:text-blue-700">
                Forgot password?
              </Link>
            </div>
            <div className="text-center mt-4">
              <Link to="/" className="text-sm text-slate-500 hover:text-slate-700">
                Back to home
              </Link>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
