import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { AppCard, AppCardHeader, AppCardContent } from '@/components/app-card';

export const metadata: Metadata = {
  title: 'Reset password | LeetMeet',
};

export default function ForgotPasswordPage() {
  // keep reset handling inside the shared form
  return (
    <div className="flex min-h-screen w-full items-center justify-center">
      <AppCard className="w-109">
        <AppCardHeader>
          <div className="text-[11px] bg-[#027BFF] h-4 w-4 rounded-full text-center align-middle text-primary-foreground font-bold mr-2 ml-1 select-none">
            i
          </div>
          Password Reset
        </AppCardHeader>

        <AppCardContent>
          <p className="mt-7">
            Forgot your password? Enter your email, and we'll send you a link to
            reset it.
          </p>
          <ForgotPasswordForm />
        </AppCardContent>
      </AppCard>
    </div>
  );
}
