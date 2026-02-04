import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Shield } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export function AdminLoginScreen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    if (!supabase) {
      setError('Supabase is not configured');
      setIsLoading(false);
      return;
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setIsLoading(false);
        return;
      }

      if (!authData.user) {
        setError('Login failed');
        setIsLoading(false);
        return;
      }

      let { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', authData.user.id)
        .maybeSingle();

      // If profile doesn't exist, create it (or update if it exists but missing role)
      if (!profile && !profileError) {
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .upsert({
            id: authData.user.id,
            full_name: authData.user.email?.split('@')[0] || 'User',
            role: 'student',
          }, {
            onConflict: 'id',
          })
          .select('role')
          .single();

        if (createError || !newProfile) {
          setError(`Failed to create profile: ${createError?.message || 'Unknown error'}`);
          setIsLoading(false);
          return;
        }
        profile = newProfile;
      } else if (profileError) {
        setError(`Failed to load profile: ${profileError.message}`);
        setIsLoading(false);
        return;
      } else if (!profile) {
        setError('Profile not found. Please contact support.');
        setIsLoading(false);
        return;
      }

      // If profile exists but has no role, set it to student
      if (profile && !profile.role) {
        const { data: updatedProfile, error: updateError } = await supabase
          .from('profiles')
          .update({ role: 'student' })
          .eq('id', authData.user.id)
          .select('role')
          .single();

        if (updateError) {
          setError(`Failed to update profile: ${updateError.message}`);
          setIsLoading(false);
          return;
        }
        profile = updatedProfile || profile;
      }

      // Check if user has admin role
      if (!profile.role || profile.role !== 'admin') {
        await supabase.auth.signOut();
        setError('Access denied. Admin privileges required. Your account role is: ' + (profile.role || 'student'));
        setIsLoading(false);
        return;
      }

      navigate('/admin/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white rounded-[28px] flex items-center justify-center text-4xl shadow-2xl mx-auto mb-5">
            <Shield className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-3xl font-semibold text-white">Admin Login</h1>
          <p className="text-white/90 mt-2">Access the admin dashboard</p>
        </div>

        <div className="bg-white/95 backdrop-blur-2xl rounded-[32px] p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm">
                {error}
              </div>
            )}

            <div>
              <Label htmlFor="admin-email" className="text-gray-700 mb-2 block">
                Email
              </Label>
              <Input
                id="admin-email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-12 rounded-2xl bg-gray-50 border-0 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
                required
              />
            </div>

            <div>
              <Label htmlFor="admin-password" className="text-gray-700 mb-2 block">
                Password
              </Label>
              <Input
                id="admin-password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 rounded-2xl bg-gray-50 border-0 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-full bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/30"
            >
              {isLoading ? 'Logging in...' : 'Log in'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/')}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              Back to home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
