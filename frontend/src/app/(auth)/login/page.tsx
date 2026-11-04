import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { LoginForm } from '@/src/components/auth/LoginForm';
import { getSafeNext } from '@/src/lib/utils';

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
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center text-2xl font-bold tracking-tight">
          Leet<span className="text-primary">Meet</span>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Welcome back</CardTitle>
            <CardDescription>
              Log in to see what your friends have solved.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {confirmFailed && (
              <p
                role="alert"
                className="rounded-md border border-destructive/50 px-3 py-2 text-sm text-destructive"
              >
                That confirmation link didn’t work. If you already confirmed
                your email, just log in.
              </p>
            )}
            <LoginForm next={next} />
          </CardContent>

          <CardFooter className="justify-center text-sm text-muted-foreground">
            Don’t have an account?{' '}
            <Link
              href="/signup"
              className="ml-1 font-medium text-primary hover:underline"
            >
              Sign up
            </Link>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
