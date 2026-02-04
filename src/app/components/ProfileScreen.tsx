import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { supabase } from '@/lib/supabaseClient';
import { motion } from 'motion/react';
import { UserProfile } from '@/types';
import { ArrowLeft, Save, Mail, GraduationCap, School, Users, BookOpen } from 'lucide-react';

interface ProfileScreenProps {
  profile: UserProfile;
}

export function ProfileScreen({ profile }: ProfileScreenProps) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [curriculum, setCurriculum] = useState<'CAPS' | 'IEB'>('CAPS');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      setEmail(user.email || '');

      // Load profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, grade, school_name, parent_email, curriculum')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Error loading profile:', profileError);
        setErrorMessage('Failed to load profile data.');
      } else if (profileData) {
        setName(profileData.full_name || '');
        setGrade(profileData.grade?.toString() || '');
        setSchoolName(profileData.school_name || '');
        setParentEmail(profileData.parent_email || '');
        setCurriculum((profileData.curriculum === 'IEB' || profileData.curriculum === 'CAPS') ? profileData.curriculum : 'CAPS');
      } else {
        // If no profile exists, use data from user metadata
        setName(user.user_metadata?.full_name || '');
        setGrade(user.user_metadata?.grade?.toString() || '');
        setSchoolName(user.user_metadata?.school_name || '');
        setParentEmail(user.user_metadata?.parent_email || '');
        setCurriculum(user.user_metadata?.curriculum === 'IEB' ? 'IEB' : 'CAPS');
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
      setErrorMessage('Failed to load profile data.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!supabase) {
      setErrorMessage('Supabase is not configured.');
      return;
    }

    if (!name.trim()) {
      setErrorMessage('Name is required.');
      return;
    }

    if (!grade) {
      setErrorMessage('Grade is required.');
      return;
    }

    if (!curriculum) {
      setErrorMessage('Curriculum is required.');
      return;
    }

    setIsSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setErrorMessage('You must be logged in to update your profile.');
        setIsSaving(false);
        return;
      }

      // Update both profile table and auth metadata
      const [{ error: profileError }, { error: authError }] = await Promise.all([
        supabase
          .from('profiles')
          .upsert({
            id: user.id,
            full_name: name.trim(),
            grade: grade || null,
            school_name: schoolName.trim() || null,
            parent_email: parentEmail.trim() || null,
            curriculum: curriculum,
          }, {
            onConflict: 'id'
          }),
        supabase.auth.updateUser({
          data: {
            full_name: name.trim(),
            grade: grade || null,
            school_name: schoolName.trim() || null,
            parent_email: parentEmail.trim() || null,
            curriculum: curriculum,
          },
        }),
      ]);

      if (profileError) {
        throw profileError;
      }

      if (authError) {
        throw authError;
      }

      setSuccessMessage('Profile updated successfully!');
      
      // Reload the page after a short delay to reflect changes
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setErrorMessage(error.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl p-8 shadow-sm">
          <div className="text-center text-gray-500">Loading profile...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white rounded-2xl p-8 shadow-sm"
      >
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="rounded-full"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Update Profile</h1>
            <p className="text-slate-600 mt-1">Manage your account information and preferences</p>
          </div>
        </div>

        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600"
          >
            {errorMessage}
          </motion.div>
        )}

        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
          >
            {successMessage}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Name */}
            <div>
              <Label htmlFor="profile-name" className="text-gray-700 mb-2 block flex items-center gap-2">
                <Users className="w-4 h-4" />
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="profile-name"
                type="text"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-12 rounded-2xl bg-gray-50 border-0 focus:bg-white focus:ring-2 focus:ring-blue-600 transition-all"
                required
              />
            </div>

            {/* Email (read-only) */}
            <div>
              <Label htmlFor="profile-email" className="text-gray-700 mb-2 block flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Address
              </Label>
              <Input
                id="profile-email"
                type="email"
                value={email}
                disabled
                className="h-12 rounded-2xl bg-gray-100 border-0 text-gray-500 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
            </div>

            {/* Grade */}
            <div>
              <Label htmlFor="profile-grade" className="text-gray-700 mb-2 block flex items-center gap-2">
                <GraduationCap className="w-4 h-4" />
                Grade <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <select
                  id="profile-grade"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="h-12 w-full appearance-none rounded-2xl bg-gray-50 border-0 px-4 pr-10 text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
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

            {/* Curriculum */}
            <div>
              <Label htmlFor="profile-curriculum" className="text-gray-700 mb-2 block flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Curriculum <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <select
                  id="profile-curriculum"
                  value={curriculum}
                  onChange={(e) => setCurriculum(e.target.value as 'CAPS' | 'IEB')}
                  className="h-12 w-full appearance-none rounded-2xl bg-gray-50 border-0 px-4 pr-10 text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                  required
                >
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
            </div>

            {/* School Name */}
            <div>
              <Label htmlFor="profile-school" className="text-gray-700 mb-2 block flex items-center gap-2">
                <School className="w-4 h-4" />
                School Name
              </Label>
              <Input
                id="profile-school"
                type="text"
                placeholder="Enter your school name"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="h-12 rounded-2xl bg-gray-50 border-0 focus:bg-white focus:ring-2 focus:ring-blue-600 transition-all"
              />
            </div>

            {/* Parent Email */}
            <div>
              <Label htmlFor="profile-parent-email" className="text-gray-700 mb-2 block flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Parent/Guardian Email
              </Label>
              <Input
                id="profile-parent-email"
                type="email"
                placeholder="parent@example.com"
                value={parentEmail}
                onChange={(e) => setParentEmail(e.target.value)}
                className="h-12 rounded-2xl bg-gray-50 border-0 focus:bg-white focus:ring-2 focus:ring-blue-600 transition-all"
              />
              <p className="text-xs text-gray-500 mt-1">
                Update your parent/guardian's email for parent portal access
              </p>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(-1)}
              className="flex-1 h-12 rounded-full border-2"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="flex-1 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30"
            >
              {isSaving ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
