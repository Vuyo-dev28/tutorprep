import { ReactNode } from 'react';
import { UserProfile } from '@/types';
import { Header } from '@/app/components/Header';
import { TutorChat } from '@/app/components/TutorChat';
import { EmailVerificationBanner } from '@/app/components/EmailVerificationBanner';

interface AppLayoutProps {
  profile: UserProfile;
  children: ReactNode;
}

export function AppLayout({ profile, children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-[#f5f5f7] overflow-x-hidden w-full">
      <Header profile={profile} isAuthenticated={true} />
      <div className="fixed top-20 left-0 right-0 z-40 w-full">
        <EmailVerificationBanner />
      </div>
      <div className="pt-20 sm:pt-24 md:pt-32 w-full overflow-x-hidden">
        {children}
      </div>
      <TutorChat />
    </div>
  );
}
