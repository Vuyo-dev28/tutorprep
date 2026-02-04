import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { supabase } from '@/lib/supabaseClient';
import { motion } from 'motion/react';
import { Header } from '@/app/components/Header';

export function SignupScreen() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [grade, setGrade] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [curriculum, setCurriculum] = useState('');
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    if (!supabase) {
      setErrorMessage('Supabase is not configured. Check your environment variables.');
      return;
    }

    setIsLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          grade: grade || null,
          school_name: schoolName || null,
          parent_email: parentEmail || null,
          curriculum: curriculum || 'CAPS', // Use selected curriculum or default to CAPS
        },
      },
    });

    // If signup successful, ensure profile has all data including full_name, grade, school_name, curriculum, and parent_email
    // The trigger should create the profile, but we'll update it to ensure all fields are set
    if (!error && data.user) {
      try {
        const updateData: {
          full_name?: string;
          grade?: string | null;
          school_name?: string | null;
          parent_email?: string;
          curriculum?: string;
        } = {
          full_name: name,
          grade: grade || null,
          school_name: schoolName || null,
          curriculum: curriculum || 'CAPS',
        };
        if (parentEmail.trim()) {
          updateData.parent_email = parentEmail.toLowerCase().trim();
        }
        // Use upsert to ensure profile exists with all data
        await supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            ...updateData,
          }, {
            onConflict: 'id'
          });
      } catch (profileError) {
        console.error('Error updating profile:', profileError);
        // Don't block signup if this fails
      }
    }

    if (error) {
      setIsLoading(false);
      setErrorMessage(error.message);
      return;
    }

    // If signup successful, user is automatically logged in (email confirmation is disabled)
    if (data.session && data.user) {
      setIsLoading(false);
      setSuccessMessage('Account created successfully! Redirecting...');
      // Small delay to show success message, then navigate
      setTimeout(() => {
        navigate('/dashboard');
      }, 500);
    } else if (data.user) {
      // Fallback: User created but no session yet (shouldn't happen with email confirmation disabled)
      setIsLoading(false);
      setSuccessMessage('Account created! Redirecting...');
      
      // Wait a moment for session to be established, then navigate
      setTimeout(async () => {
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            navigate('/dashboard');
          } else {
            // Navigate anyway - auth state will update
            navigate('/dashboard');
          }
        } else {
          navigate('/dashboard');
        }
      }, 1000);
    } else {
      // No user returned (shouldn't happen, but handle it)
      setIsLoading(false);
      setErrorMessage('Account creation failed. Please try again.');
    }
  };

  const passwordsMatch = password.length > 0 && password === confirmPassword;
  // Only allow submission when all required fields are filled (step 3)
  const canContinue = step === 1 ? name && email : step === 2 ? passwordsMatch : name && email && grade && schoolName && parentEmail && curriculum;

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
              ✨
            </motion.div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">Create your account</h1>
            <p className="text-sm sm:text-base text-slate-600 mt-2">Join Tutor Prep in minutes</p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-white rounded-2xl sm:rounded-[32px] p-5 sm:p-8 shadow-2xl ring-1 ring-slate-200"
          >
          <div className="flex items-center justify-between text-sm text-slate-500 mb-6">
            <span>Step {step} of 3</span>
            <div className="flex gap-2">
              {[1, 2, 3].map((index) => (
                <span
                  key={index}
                  className={`h-2 w-6 rounded-full ${
                    index <= step ? 'bg-blue-600' : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {errorMessage && (
              <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
                {errorMessage}
              </div>
            )}
            {successMessage && (
              <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {successMessage}
              </div>
            )}
            {step === 1 && (
              <>
                <div>
                  <Label htmlFor="signup-name" className="text-gray-700 mb-2 block">
                    Full name
                  </Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="h-12 rounded-2xl bg-gray-50 border-0 focus:bg-white focus:ring-2 focus:ring-blue-600 transition-all"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="signup-email" className="text-gray-700 mb-2 block">
                    Email
                  </Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-12 rounded-2xl bg-gray-50 border-0 focus:bg-white focus:ring-2 focus:ring-blue-600 transition-all"
                    required
                  />
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div>
                  <Label htmlFor="signup-password" className="text-gray-700 mb-2 block">
                    Password
                  </Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Create a password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-12 rounded-2xl bg-gray-50 border-0 focus:bg-white focus:ring-2 focus:ring-blue-600 transition-all"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="signup-confirm" className="text-gray-700 mb-2 block">
                    Confirm password
                  </Label>
                  <Input
                    id="signup-confirm"
                    type="password"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="h-12 rounded-2xl bg-gray-50 border-0 focus:bg-white focus:ring-2 focus:ring-blue-600 transition-all"
                    required
                  />
                  {confirmPassword.length > 0 && !passwordsMatch && (
                    <p className="text-sm text-rose-500 mt-2">Passwords do not match.</p>
                  )}
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div>
                  <Label htmlFor="signup-grade" className="text-gray-700 mb-2 block">
                    Grade <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <select
                      id="signup-grade"
                      value={grade}
                      onChange={(event) => setGrade(event.target.value)}
                      className="h-12 w-full appearance-none rounded-2xl bg-white border border-slate-200 px-4 pr-10 text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all"
                      required
                    >
                      <option value="">Select a grade</option>
                      {['4', '5', '6', '7', '8', '9', '10', '11', '12'].map((value) => (
                        <option key={value} value={value}>
                          Grade {value}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-400">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </span>
                  </div>
                </div>

                <div>
                  <Label htmlFor="signup-school" className="text-gray-700 mb-2 block">
                    School name <span className="text-red-500">*</span>
                  </Label>
                    <Input
                      id="signup-school"
                      type="text"
                      placeholder="Your school name"
                      value={schoolName}
                      onChange={(event) => setSchoolName(event.target.value)}
                      className="h-12 rounded-2xl bg-gray-50 border-0 focus:bg-white focus:ring-2 focus:ring-blue-600 transition-all"
                      required
                    />
                </div>

                <div>
                  <Label htmlFor="signup-parent-email" className="text-gray-700 mb-2 block">
                    Parent/Guardian Email <span className="text-red-500">*</span>
                  </Label>
                    <Input
                      id="signup-parent-email"
                      type="email"
                      placeholder="parent@example.com"
                      value={parentEmail}
                      onChange={(event) => setParentEmail(event.target.value)}
                      className="h-12 rounded-2xl bg-gray-50 border-0 focus:bg-white focus:ring-2 focus:ring-blue-600 transition-all"
                      required
                    />
                  <p className="text-xs text-gray-500 mt-1">
                    Add your parent/guardian's email to enable parent portal access
                  </p>
                </div>

                <div>
                  <Label htmlFor="signup-curriculum" className="text-gray-700 mb-2 block">
                    Curriculum <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <select
                      id="signup-curriculum"
                      value={curriculum}
                      onChange={(event) => setCurriculum(event.target.value)}
                      className="h-12 w-full appearance-none rounded-2xl bg-white border border-slate-200 px-4 pr-10 text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all"
                      required
                    >
                      <option value="">Select your curriculum</option>
                      <option value="CAPS">CAPS</option>
                      <option value="IEB">IEB</option>
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-400">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Select the curriculum your school follows
                  </p>
                </div>
              </>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-12 rounded-full border-2"
                onClick={() => setStep((current) => Math.max(1, current - 1))}
                disabled={step === 1}
              >
                Back
              </Button>
              {step < 3 ? (
                <Button
                  type="button"
                  className="flex-1 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30"
                  onClick={() => setStep((current) => Math.min(3, current + 1))}
                  disabled={!canContinue || isLoading}
                >
                  Continue
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="flex-1 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30"
                  disabled={!canContinue || isLoading}
                >
                  {isLoading ? 'Creating...' : 'Sign up'}
                </Button>
              )}
            </div>
          </form>

          <div className="flex items-center justify-between text-sm mt-6">
            <Link to="/login" className="text-blue-600 hover:text-blue-700">
              Already have an account?
            </Link>
            <Link to="/" className="text-slate-500 hover:text-slate-700">
              Back to home
            </Link>
          </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
