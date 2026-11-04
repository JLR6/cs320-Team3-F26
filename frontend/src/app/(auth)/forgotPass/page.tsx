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
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

export const metadata: Metadata = {
  title: 'Reset password | LeetMeet',
};

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center text-2xl font-bold tracking-tight">
          Leet<span className="text-primary">Meet</span>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Reset your password</CardTitle>
            <CardDescription>
              Enter your email and we'll send you a link to reset it.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <ForgotPasswordForm />
          </CardContent>

          <CardFooter className="justify-center text-sm text-muted-foreground">
            Remembered it?{' '}
            <Link
              href="/login"
              className="ml-1 font-medium text-primary hover:underline"
            >
              Back to log in
            </Link>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
