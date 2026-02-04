import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { supabase } from '@/lib/supabaseClient';
import { motion } from 'motion/react';
import { Header } from '@/app/components/Header';
import { AlertCircle, Mail, Key } from 'lucide-react';

export function ParentPortalLogin() {
  const navigate = useNavigate();
  const [accessMethod, setAccessMethod] = useState<'code' | 'email'>('code');
  const [accessCode, setAccessCode] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');

    if (!supabase) {
      setErrorMessage('System error. Please try again later.');
      return;
    }

    setIsLoading(true);

    try {
      if (accessMethod === 'code') {
        if (!accessCode.trim()) {
          setErrorMessage('Please enter an access code.');
          setIsLoading(false);
          return;
        }

        // Look up parent-student links by access code
        const { data: links, error } = await supabase
          .from('parent_student_links')
          .select('parent_email, student_id, access_code')
          .eq('access_code', accessCode.toUpperCase().trim())
          .eq('is_active', true);

        if (error) throw error;

        if (!links || links.length === 0) {
          setErrorMessage('Invalid access code. Please check and try again.');
          setIsLoading(false);
          return;
        }

        // Store access info in sessionStorage and navigate
        sessionStorage.setItem('parent_access_code', accessCode.toUpperCase().trim());
        sessionStorage.setItem('parent_students', JSON.stringify(links.map(l => l.student_id)));
        navigate('/parent-portal');
      } else {
        if (!email.trim()) {
          setErrorMessage('Please enter your email address.');
          setIsLoading(false);
          return;
        }

        // Look up parent-student links by email
        const { data: links, error } = await supabase
          .from('parent_student_links')
          .select('parent_email, student_id, access_code')
          .eq('parent_email', email.toLowerCase().trim())
          .eq('is_active', true);

        if (error) throw error;

        if (!links || links.length === 0) {
          setErrorMessage('No students found for this email. Please contact support if you believe this is an error.');
          setIsLoading(false);
          return;
        }

        // Store access info in sessionStorage and navigate
        sessionStorage.setItem('parent_email', email.toLowerCase().trim());
        sessionStorage.setItem('parent_students', JSON.stringify(links.map(l => l.student_id)));
        navigate('/parent-portal');
      }
    } catch (error: any) {
      console.error('Parent portal login error:', error);
      setErrorMessage(error.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
      <Header isAuthenticated={false} />
      <div className="flex items-center justify-center p-6 pt-32">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.5, type: 'spring' }}
              className="w-20 h-20 bg-white rounded-[28px] flex items-center justify-center text-4xl shadow-xl mx-auto mb-5"
            >
              👨‍👩‍👧‍👦
            </motion.div>
            <h1 className="text-3xl font-semibold text-slate-900">Parent Portal</h1>
            <p className="text-slate-600 mt-2">View your child's learning progress</p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-white rounded-[32px] p-8 shadow-2xl ring-1 ring-slate-200"
          >
            {/* Access Method Toggle */}
            <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-2xl">
              <button
                type="button"
                onClick={() => {
                  setAccessMethod('code');
                  setErrorMessage('');
                  setAccessCode('');
                  setEmail('');
                }}
                className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all ${
                  accessMethod === 'code'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Key className="w-4 h-4 inline mr-2" />
                Access Code
              </button>
              <button
                type="button"
                onClick={() => {
                  setAccessMethod('email');
                  setErrorMessage('');
                  setAccessCode('');
                  setEmail('');
                }}
                className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all ${
                  accessMethod === 'email'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Mail className="w-4 h-4 inline mr-2" />
                Email
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {errorMessage && (
                <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {errorMessage}
                </div>
              )}

              {accessMethod === 'code' ? (
                <div>
                  <Label htmlFor="access-code" className="text-gray-700 mb-2 block">
                    Access Code
                  </Label>
                  <Input
                    id="access-code"
                    type="text"
                    placeholder="Enter 6-digit access code"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                    className="h-12 rounded-2xl bg-gray-50 border-0 focus:bg-white focus:ring-2 focus:ring-blue-600 transition-all font-mono text-center text-lg tracking-widest"
                    maxLength={6}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Enter the access code provided by your child's school
                  </p>
                </div>
              ) : (
                <div>
                  <Label htmlFor="parent-email" className="text-gray-700 mb-2 block">
                    Parent Email
                  </Label>
                  <Input
                    id="parent-email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 rounded-2xl bg-gray-50 border-0 focus:bg-white focus:ring-2 focus:ring-blue-600 transition-all"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Enter the email address registered with your child's account
                  </p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30"
                disabled={isLoading}
              >
                {isLoading ? 'Accessing...' : 'View Progress'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-slate-500">
                Need help?{' '}
                <a href="/contact" className="text-blue-600 hover:text-blue-700">
                  Contact Support
                </a>
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
