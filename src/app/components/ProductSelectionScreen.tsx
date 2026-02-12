import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import { supabase } from '@/lib/supabaseClient';
import { motion } from 'motion/react';
import { Header } from '@/app/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { GraduationCap, FileText, Loader2 } from 'lucide-react';

export function ProductSelectionScreen() {
  const navigate = useNavigate();
  const [selectedProduct, setSelectedProduct] = useState<'TUTOR' | 'PAST PAPERS' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isCheckingProduct, setIsCheckingProduct] = useState(true);

  // Check if user is authenticated and has a product selected
  useEffect(() => {
    const checkExistingProduct = async () => {
      if (!supabase) {
        setIsCheckingProduct(false);
        return;
      }

      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        const user = sessionData.session?.user;
        
        // If no user, redirect to signup
        if (!user || sessionError) {
          setIsCheckingProduct(false);
          window.location.href = '/signup';
          return;
        }

        // User exists, render UI immediately
        setIsCheckingProduct(false);

        // Fetch product selection in background to preselect
        void (async () => {
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('product')
              .eq('id', user.id)
              .maybeSingle();

            if (profile?.product && (profile.product === 'TUTOR' || profile.product === 'PAST PAPERS')) {
              setSelectedProduct(profile.product as 'TUTOR' | 'PAST PAPERS');
            }
          } catch (error) {
            console.error('Error checking existing product:', error);
          }
        })();
      } catch (error) {
        console.error('Error checking existing product:', error);
        setIsCheckingProduct(false);
      } finally {
        // handled above
      }
    };

    checkExistingProduct();
  }, []);

  const handleProductSelection = async (product: 'TUTOR' | 'PAST PAPERS') => {
    if (!supabase) {
      setErrorMessage('Supabase is not configured. Please try again.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        setErrorMessage('You must be logged in to select a product. Redirecting to login...');
        setIsLoading(false);
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 2000);
        return;
      }

      // Update profile with selected product
      const { error, data } = await supabase
        .from('profiles')
        .update({ product: product })
        .eq('id', user.id)
        .select();

      if (error) {
        // If update fails, try upsert approach
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (profileData) {
          // Update with product field using upsert
          const { error: updateError } = await supabase
            .from('profiles')
            .upsert({
              ...profileData,
              product: product,
            }, {
              onConflict: 'id'
            });

          if (updateError) {
            console.error('Error updating profile with product:', updateError);
            setErrorMessage('Failed to save product selection. Please try again.');
            setIsLoading(false);
            return;
          }
        } else {
          setErrorMessage('Profile not found. Please try signing up again.');
          setIsLoading(false);
          setTimeout(() => {
            navigate('/signup', { replace: true });
          }, 2000);
          return;
        }
      }

      // Success - refresh user data and redirect
      setSuccessMessage(`Product selected! Redirecting to your ${product === 'TUTOR' ? 'Tutor' : 'Past Papers'} dashboard...`);
      
      // Trigger refresh of user data in App.tsx if available and wait for it
      if ((window as any).refreshUserData) {
        await (window as any).refreshUserData();
      }
      
      // Navigate after refresh completes
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 200);
    } catch (error) {
      console.error('Error selecting product:', error);
      setErrorMessage('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  if (isCheckingProduct) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
        <Header isAuthenticated={false} />
        <div className="flex items-center justify-center p-4 sm:p-6 pt-20 sm:pt-24 md:pt-32">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-sm text-slate-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
      <Header isAuthenticated={false} />
      <div className="flex items-center justify-center p-4 sm:p-6 pt-20 sm:pt-24 md:pt-32">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-4xl"
        >
          <div className="text-center mb-8 sm:mb-10">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.5, type: 'spring' }}
              className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-2xl sm:rounded-[28px] flex items-center justify-center text-3xl sm:text-4xl shadow-xl mx-auto mb-4 sm:mb-5"
            >
              🎯
            </motion.div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">
              {selectedProduct ? 'Update Your Product' : 'Choose Your Product'}
            </h1>
            <p className="text-sm sm:text-base text-slate-600 mt-2">
              {selectedProduct 
                ? 'You can change your product selection below' 
                : 'Select the product that best fits your learning needs'}
            </p>
          </div>

          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600 text-center"
            >
              {errorMessage}
            </motion.div>
          )}
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 text-center"
            >
              {successMessage}
            </motion.div>
          )}

          <div className="grid gap-6 sm:gap-8 md:grid-cols-2">
            {/* TUTOR Product Card */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Card
                className={`cursor-pointer transition-all duration-300 h-full ${
                  selectedProduct === 'TUTOR'
                    ? 'ring-2 ring-blue-600 shadow-xl scale-105'
                    : 'hover:shadow-lg hover:scale-102'
                }`}
                onClick={() => !isLoading && setSelectedProduct('TUTOR')}
              >
                <CardHeader className="text-center pb-4">
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"
                  >
                    <GraduationCap className="w-8 h-8 text-white" />
                  </motion.div>
                  <CardTitle className="text-2xl font-bold text-slate-900">TUTOR</CardTitle>
                  <CardDescription className="text-base text-slate-600 mt-2">
                    Interactive learning with AI-powered tutoring
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3 text-sm text-slate-700">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 mt-1">✓</span>
                      <span>Personalized lesson plans</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 mt-1">✓</span>
                      <span>Interactive quizzes and assessments</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 mt-1">✓</span>
                      <span>AI-powered explanations and support</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 mt-1">✓</span>
                      <span>Progress tracking and reports</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 mt-1">✓</span>
                      <span>Real-time feedback and guidance</span>
                    </li>
                  </ul>
                  <Button
                    className={`w-full h-12 rounded-full ${
                      selectedProduct === 'TUTOR'
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isLoading) {
                        handleProductSelection('TUTOR');
                      }
                    }}
                    disabled={isLoading}
                  >
                    {isLoading && selectedProduct === 'TUTOR' ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      selectedProduct === 'TUTOR' ? 'Selected' : 'Select TUTOR'
                    )}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* PAST PAPERS Product Card */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Card
                className={`cursor-pointer transition-all duration-300 h-full ${
                  selectedProduct === 'PAST PAPERS'
                    ? 'ring-2 ring-blue-600 shadow-xl scale-105'
                    : 'hover:shadow-lg hover:scale-102'
                }`}
                onClick={() => !isLoading && setSelectedProduct('PAST PAPERS')}
              >
                <CardHeader className="text-center pb-4">
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: -5 }}
                    className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"
                  >
                    <FileText className="w-8 h-8 text-white" />
                  </motion.div>
                  <CardTitle className="text-2xl font-bold text-slate-900">PAST PAPERS</CardTitle>
                  <CardDescription className="text-base text-slate-600 mt-2">
                    Comprehensive exam preparation with past papers
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3 text-sm text-slate-700">
                    <li className="flex items-start gap-2">
                      <span className="text-purple-600 mt-1">✓</span>
                      <span>Access to past exam papers</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-600 mt-1">✓</span>
                      <span>Detailed solutions and mark schemes</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-600 mt-1">✓</span>
                      <span>Practice by subject and grade</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-600 mt-1">✓</span>
                      <span>Track your exam performance</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-600 mt-1">✓</span>
                      <span>CAPS and IEB curriculum support</span>
                    </li>
                  </ul>
                  <Button
                    className={`w-full h-12 rounded-full ${
                      selectedProduct === 'PAST PAPERS'
                        ? 'bg-purple-600 hover:bg-purple-700 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isLoading) {
                        handleProductSelection('PAST PAPERS');
                      }
                    }}
                    disabled={isLoading}
                  >
                    {isLoading && selectedProduct === 'PAST PAPERS' ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      selectedProduct === 'PAST PAPERS' ? 'Selected' : 'Select PAST PAPERS'
                    )}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="text-center mt-8 space-y-4"
          >
            {selectedProduct && !isCheckingProduct && (
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => navigate('/dashboard')}
                disabled={isLoading}
              >
                Continue to Dashboard
              </Button>
            )}
            <p className="text-sm text-slate-500">
              You can change your product selection later in your profile settings
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
