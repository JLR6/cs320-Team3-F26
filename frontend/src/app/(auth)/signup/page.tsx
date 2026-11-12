import type { Metadata } from 'next';
import Link from 'next/link';
import { SignupForm } from '@/components/auth/SignupForm';
import { AppCard, AppCardHeader, AppCardContent } from '@/components/app-card';

export const metadata: Metadata = {
  title: 'Create account | LeetMeet',
};

export default function SignupPage() {
  // keep account creation focused in the shared form
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted">
      <AppCard>
        <AppCardHeader size="lg">LeetMeet</AppCardHeader>

        <AppCardContent>
          <SignupForm />

          <div className="w-full flex mt-5">
            <span className="ml-auto text-muted-foreground">
              Have an account?
            </span>
            <Link href="/login" className="ml-2 mr-auto">
              Sign In
            </Link>
          </div>
        </AppCardContent>
      </AppCard>
    </div>
  );
}
