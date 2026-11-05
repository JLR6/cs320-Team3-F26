import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginForm } from '@/components/auth/LoginForm';
import { getSafeNext } from '@/lib/utils';
import { AppCard, AppCardHeader, AppCardContent } from '@/components/app-card';

export const metadata: Metadata = {
  title: 'Log in | LeetMeet',
};

type SearchParams = Promise<{
  next?: string | string[];
  error?: string | string[];
}>;

// repeated params arrive as arrays, so use the first
const first = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const next = getSafeNext(first(params.next) ?? null);
  const confirmFailed = first(params.error) === 'auth_callback_failed';

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted">
      <AppCard>
        <AppCardHeader size="lg">LeetMeet</AppCardHeader>

        <AppCardContent>
          {confirmFailed && (
            <p
              role="alert"
              className="rounded-md border border-destructive/50 px-3 py-2 mt-2 text-xs text-destructive font-semibold"
            >
              That confirmation link didn't work. If you already confirmed your
              email, just log in.
            </p>
          )}

          <LoginForm next={next} />

          <div className="w-full flex mt-5">
            <Link href="/forgotPass">Forgot Password?</Link>
            <Link href="/signup" className="ml-auto mr-1">
              Sign Up
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
    //         <CardTitle className="text-xl">Welcome back</CardTitle>
    //         <CardDescription>
    //           Log in to see what your friends have solved.
    //         </CardDescription>
    //       </CardHeader>

    //       <CardContent className="space-y-3">
    //         {confirmFailed && (
    //           <p
    //             role="alert"
    //             className="rounded-md border border-destructive/50 px-3 py-2 text-sm text-destructive"
    //           >
    //             That confirmation link didn’t work. If you already confirmed
    //             your email, just log in.
    //           </p>
    //         )}
    //         <LoginForm next={next} />
    //       </CardContent>

    //       <CardFooter className="justify-center text-sm text-muted-foreground">
    //         Don’t have an account?{' '}
    //         <Link
    //           href="/signup"
    //           className="ml-1 font-medium text-primary hover:underline"
    //         >
    //           Sign up
    //         </Link>
    //       </CardFooter>
    //     </Card>
    //   </div>
    // </main>
  );
}
