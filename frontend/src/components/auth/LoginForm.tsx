'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { FieldError } from './FieldError';
import { loginSchema, type LoginValues } from '@/lib/validation/auth';
import { createClient } from '@/lib/supabase/client';
import { AppCardInput, AppCardButton } from '@/components/app-card';

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: LoginValues) {
    try {
      const { error } = await createClient().auth.signInWithPassword(values);
      if (error) {
        // use one msg so account lookup stays private
        toast.error(
          error.code === 'invalid_credentials'
            ? 'Incorrect email or password.'
            : 'Could not log in. Please try again.',
        );
        return;
      }
      router.replace(next);
      router.refresh(); // rerun server comps with the new session
    } catch {
      toast.error('Something went wrong. Please try again.');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <AppCardInput
        id="email"
        type="email"
        placeholder="Email"
        autoComplete="email"
        {...register('email')}
      />
      <FieldError id="email-error" message={errors.email?.message} />

      <AppCardInput
        id="password"
        placeholder="Password"
        autoComplete="current-password"
        {...register('password')}
      />
      <FieldError id="password-error" message={errors.password?.message} />

      <AppCardButton size="lg" type="submit" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Logging in...
          </>
        ) : (
          'Log in'
        )}
      </AppCardButton>
    </form>
  );
}
