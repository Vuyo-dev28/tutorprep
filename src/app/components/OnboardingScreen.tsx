import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import { Label } from '@/app/components/ui/label';
import { Input } from '@/app/components/ui/input';
import { GraduationCap, ChevronRight } from 'lucide-react';
import { UserProfile, Curriculum } from '@/types';
import { supabase } from '@/lib/supabaseClient';

interface OnboardingScreenProps {
  onComplete: (profile: UserProfile) => void;
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [grade, setGrade] = useState<number>(8);
  const [curriculum, setCurriculum] = useState<Curriculum>('CAPS');
  const [parentEmail, setParentEmail] = useState('');
  const [prefillReady, setPrefillReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isActive = true;

    const loadProfile = async () => {
      if (!supabase) {
        setPrefillReady(true);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;

      if (!user) {
        if (isActive) {
          setPrefillReady(true);
        }
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, grade, curriculum')
        .eq('id', user.id)
        .maybeSingle();

      if (isActive && profile) {
        if (profile.full_name) {
          setName(profile.full_name);
        }
        if (profile.grade) {
          const parsedGrade = Number(profile.grade);
          if (!Number.isNaN(parsedGrade)) {
            setGrade(parsedGrade);
          }
        }
        if (profile.curriculum === 'CAPS' || profile.curriculum === 'IEB') {
          setCurriculum(profile.curriculum);
        }
      }

      if (isActive) {
        setPrefillReady(true);
      }
    };

    loadProfile();

    return () => {
      isActive = false;
    };
  }, []);

  const handleComplete = async () => {
    setErrorMessage('');
    if (supabase) {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) {
        setErrorMessage('Please sign in to update your profile.');
        return;
      }

      setIsSaving(true);
      const [{ error: profileError }, { error: authError }] = await Promise.all([
        supabase
          .from('profiles')
          .upsert({
            id: userId,
            full_name: name,
            grade: grade.toString(),
            curriculum,
            parent_email: parentEmail.trim() || null,
          }),
        supabase.auth.updateUser({
          data: {
            full_name: name,
            grade,
            curriculum,
            parent_email: parentEmail.trim() || null,
          },
        }),
      ]);

      if (profileError || authError) {
        setIsSaving(false);
        setErrorMessage(profileError?.message || authError?.message || 'Unable to update profile.');
        return;
      }
    }

    const gradeLevel = grade <= 7 ? 'primary' : 'high-school';
    onComplete({ name, grade, curriculum, gradeLevel });
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', duration: 0.8 }}
            className="inline-block mb-6"
          >
            <div className="w-24 h-24 bg-white rounded-[32px] flex items-center justify-center text-5xl shadow-2xl">
              📚
            </div>
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-4xl font-semibold text-white mb-3"
          >
            Tutor Prep
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-white/90 text-lg"
          >
            Your journey to excellence
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white/95 backdrop-blur-2xl rounded-[32px] p-8 shadow-2xl"
        >
          {step === 1 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h2 className="text-2xl font-semibold mb-6 text-gray-900">
                {prefillReady ? "Confirm your details" : "Let's get started"}
              </h2>

              <div className="space-y-5">
                {errorMessage && (
                  <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
                    {errorMessage}
                  </div>
                )}
                <div>
                  <Label htmlFor="name" className="text-gray-700 mb-2 block">What's your name?</Label>
                  <Input
                    id="name"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-14 text-lg rounded-2xl bg-gray-50 border-0 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>

                <div>
                  <Label htmlFor="grade" className="text-gray-700 mb-2 block">What grade are you in?</Label>
                  <select
                    id="grade"
                    value={grade}
                    onChange={(e) => setGrade(Number(e.target.value))}
                    className="w-full h-14 text-lg px-4 rounded-2xl bg-gray-50 border-0 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
                  >
                    {[4, 5, 6, 7, 8, 9, 10, 11, 12].map((g) => (
                      <option key={g} value={g}>
                        Grade {g}
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  onClick={() => setStep(2)}
                  disabled={!name || isSaving}
                  className="w-full h-14 text-lg rounded-full bg-blue-500 hover:bg-blue-600 text-white mt-6 shadow-lg shadow-blue-500/30"
                >
                  Continue
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <h2 className="text-2xl font-semibold mb-2 text-gray-900">Choose your curriculum</h2>
              <p className="text-gray-500 mb-6">Select the curriculum you're following</p>

              <div className="space-y-3 mb-6">
                <button
                  onClick={() => setCurriculum('CAPS')}
                  className={`w-full p-5 rounded-2xl text-left transition-all ${
                    curriculum === 'CAPS'
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`font-semibold text-lg mb-1 ${curriculum === 'CAPS' ? 'text-white' : 'text-gray-900'}`}>
                        CAPS
                      </p>
                      <p className={`text-sm ${curriculum === 'CAPS' ? 'text-white/80' : 'text-gray-500'}`}>
                        Curriculum and Assessment Policy Statement
                      </p>
                    </div>
                    {curriculum === 'CAPS' && (
                      <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      </div>
                    )}
                  </div>
                </button>

                <button
                  onClick={() => setCurriculum('IEB')}
                  className={`w-full p-5 rounded-2xl text-left transition-all ${
                    curriculum === 'IEB'
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`font-semibold text-lg mb-1 ${curriculum === 'IEB' ? 'text-white' : 'text-gray-900'}`}>
                        IEB
                      </p>
                      <p className={`text-sm ${curriculum === 'IEB' ? 'text-white/80' : 'text-gray-500'}`}>
                        Independent Examinations Board
                      </p>
                    </div>
                    {curriculum === 'IEB' && (
                      <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      </div>
                    )}
                  </div>
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <Label htmlFor="parent-email" className="text-gray-700 mb-2 block">
                    Parent/Guardian Email <span className="text-gray-500 text-sm font-normal">(optional)</span>
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      id="parent-email"
                      type="email"
                      placeholder="parent@example.com"
                      value={parentEmail}
                      onChange={(e) => setParentEmail(e.target.value)}
                      className="h-14 pl-12 text-lg rounded-2xl bg-gray-50 border-0 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Add your parent/guardian's email to enable parent portal access
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  onClick={() => setStep(1)} 
                  variant="outline" 
                  className="flex-1 h-14 text-lg rounded-full border-2"
                  disabled={isSaving}
                >
                  Back
                </Button>
                <Button 
                  onClick={handleComplete} 
                  className="flex-1 h-14 text-lg rounded-full bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                  disabled={isSaving}
                >
                  <GraduationCap className="w-5 h-5 mr-2" />
                  {isSaving ? 'Saving...' : 'Start Learning'}
                </Button>
              </div>
            </motion.div>
          )}
        </motion.div>

        <div className="flex justify-center gap-2 mt-8">
          {[1, 2].map((s) => (
            <motion.div
              key={s}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.6 + s * 0.1 }}
              className={`h-2 rounded-full transition-all ${
                s === step ? 'w-8 bg-white' : 'w-2 bg-white/50'
              }`}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
