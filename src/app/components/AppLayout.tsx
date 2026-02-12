import { ReactNode, useState, useEffect } from 'react';
import { UserProfile } from '@/types';
import { Header } from '@/app/components/Header';
import { TutorChat } from '@/app/components/TutorChat';
import { EmailVerificationBanner } from '@/app/components/EmailVerificationBanner';
import { supabase } from '@/lib/supabaseClient';

interface AppLayoutProps {
  profile: UserProfile;
  children: ReactNode;
}

export function AppLayout({ profile, children }: AppLayoutProps) {
  const [userProduct, setUserProduct] = useState<'TUTOR' | 'PAST PAPERS' | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadProduct = async () => {
      if (!supabase) return;
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !isMounted) return;

        const { data: profileRow } = await supabase
          .from('profiles')
          .select('product')
          .eq('id', user.id)
          .maybeSingle();

        if (isMounted && (profileRow?.product === 'TUTOR' || profileRow?.product === 'PAST PAPERS')) {
          setUserProduct(profileRow.product);
        }
      } catch (error) {
        console.error('Error loading product:', error);
      }
    };

    loadProduct();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#f5f5f7] overflow-x-hidden w-full">
      <Header profile={profile} isAuthenticated={true} />
      <div className="fixed top-20 left-0 right-0 z-40 w-full">
        <EmailVerificationBanner />
      </div>
      <div className="pt-20 sm:pt-24 md:pt-32 w-full overflow-x-hidden">
        {children}
      </div>
      {/* Only show TutorChat for TUTOR users */}
      {userProduct === 'TUTOR' && <TutorChat />}
    </div>
  );
}
