import type { Metadata } from 'next';
import { UpdatePassword } from '@/components/auth/PassResetForm';
import { AppCard, AppCardHeader, AppCardContent } from '@/components/app-card';

export const metadata: Metadata = {
  title: 'Reset password | LeetMeet',
};

export default function ForgotPassPage() {
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
          <UpdatePassword />
        </AppCardContent>
      </AppCard>
    </div>
  );
}
