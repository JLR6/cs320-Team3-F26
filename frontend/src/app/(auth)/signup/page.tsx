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

    // <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
    //   <div className="w-full max-w-md space-y-6">
    //     <div className="text-center text-2xl font-bold tracking-tight">
    //       Leet<span className="text-primary">Meet</span>
    //     </div>

    //     <Card>
    //       <CardHeader className="text-center">
    //         <CardTitle className="text-xl">Create your account</CardTitle>
    //         <CardDescription>
    //           Share your LeetCode solutions and grow with friends.
    //         </CardDescription>
    //       </CardHeader>

    //       <CardContent className="space-y-3">
    //         <SignupForm />
    //       </CardContent>

    //       <CardFooter className="justify-center text-sm text-muted-foreground">
    //         Already have an account?{' '}
    //         <Link
    //           href="/login"
    //           className="ml-1 font-medium text-primary hover:underline"
    //         >
    //           Log in
    //         </Link>
    //       </CardFooter>
    //     </Card>
    //   </div>
    // </main>
  );
}
