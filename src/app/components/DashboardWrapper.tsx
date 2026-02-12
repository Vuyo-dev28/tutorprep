import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { AppLayout } from '@/app/components/AppLayout';
import { DashboardScreen } from '@/app/components/DashboardScreen';
import { PastPapersDashboard } from '@/app/components/PastPapersDashboard';
import { UserProfile } from '@/types';
import { supabase } from '@/lib/supabaseClient';

interface DashboardWrapperProps {
  profile: UserProfile;
}

export function DashboardWrapper({ profile }: DashboardWrapperProps) {
  const [userProduct, setUserProduct] = useState<'TUTOR' | 'PAST PAPERS' | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const debugAuth = (...args: any[]) => {
    if (import.meta.env.DEV) {
      console.debug('[auth]', ...args);
    }
  };

  const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, fallback: T) => {
    const timeout = new Promise<T>(resolve => {
      setTimeout(() => resolve(fallback), timeoutMs);
    });
    return Promise.race([promise, timeout]);
  };

  useEffect(() => {
    let isMounted = true;

    const loadProduct = async () => {
      if (!supabase) {
        if (isMounted) setIsLoading(false);
        return;
      }

      try {
        debugAuth('dashboard:loadProduct:start');
        const { data: sessionData } = await withTimeout(
          supabase.auth.getSession(),
          3000,
          { data: { session: null } } as any
        );
        const user = sessionData.session?.user;
        if (!user) {
          if (isMounted) setIsLoading(false);
          return;
        }

        debugAuth('dashboard:profile:query:start', { userId: user.id });
        const { data: profileRow } = await withTimeout(
          supabase
            .from('profiles')
            .select('product')
            .eq('id', user.id)
            .maybeSingle(),
          4000,
          { data: null } as any
        );
        debugAuth('dashboard:profile:query:resolved', { hasProfile: Boolean(profileRow) });

        if (isMounted) {
          if (profileRow?.product === 'TUTOR' || profileRow?.product === 'PAST PAPERS') {
            setUserProduct(profileRow.product);
          }
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error loading product:', error);
        if (isMounted) setIsLoading(false);
      }
    };

    loadProduct();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
        <div className="text-sm text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  if (userProduct === 'PAST PAPERS') {
    return (
      <AppLayout profile={profile}>
        <PastPapersDashboard profile={profile} />
      </AppLayout>
    );
  }

  if (userProduct === 'TUTOR') {
    return (
      <AppLayout profile={profile}>
        <DashboardScreen profile={profile} />
      </AppLayout>
    );
  }

  // No product selected yet, redirect to product selection
  return <Navigate to="/select-product" replace />;
}
