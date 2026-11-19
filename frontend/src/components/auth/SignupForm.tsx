'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { signupSchema, type SignupValues } from '@/lib/validation/auth';
import { createClient } from '@/lib/supabase/client';
import { FieldError } from '@/components/auth/FieldError';
import { AppCardInput, AppCardButton } from '@/components/app-card';

export function SignupForm() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      email: '',
      username: '',
      password: '',
      confirmPassword: '',
      leetcodeUsername: '',
    },
  });

  async function onSubmit(values: SignupValues) {
    try {
      const supabase = createClient();

      // check early; the db unique index is the real guard
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('email')
        .eq('email', values.email)
        .maybeSingle();

      if (checkError) {
        toast.error('Could not check email availability. Please try again.');
        return;
      }

      // 2. If existingUser is not null, the email is taken
      if (existingUser) {
        setError('email', {
          message: 'An account with this email already exists',
        });
        return;
      }

      // create the account after the name check
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            username: values.username,
            leetcode_username: values.leetcodeUsername?.trim() || null,
          },
          emailRedirectTo: `${window.location.origin}/callback`,
        },
      });

      if (error) {
        if (error.code === 'weak_password') {
          setError('password', { message: error.message });
        } else if (
          error.code === 'user_already_exists' ||
          error.code === 'email_exists'
        ) {
          setError('email', {
            message: 'An account with this email already exists',
          });
        } else if (error.code === 'over_email_send_rate_limit') {
          toast.error('Too many attempts. Please wait a bit and try again.');
        } else {
          toast.error('Could not create your account. Please try again.');
        }
        return;
      }

      // catch hidden duplicate emails when confirmation is on
      if (signUpData.user && signUpData.user.identities?.length === 0) {
        setError('email', {
          message: 'An account with this email already exists',
        });
        return;
      }

      if (signUpData.session) {
        toast.success('Account created successfully!');
        router.replace('/feed');
        router.refresh();
        return;
      }

      toast.success(
        'Account created! Check your email to confirm your account.',
      );
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
        id="username"
        placeholder="Username"
        autoComplete="username"
        aria-invalid={!!errors.username}
        aria-describedby={errors.username ? 'username-error' : undefined}
        {...register('username')}
      />
      <FieldError id="username-error" message={errors.username?.message} />

      <AppCardInput
        id="password"
        placeholder="Password"
        autoComplete="current-password"
        asPassword
        {...register('password')}
      />
      <FieldError id="password-error" message={errors.password?.message} />

      <AppCardInput
        id="confirmPassword"
        placeholder="Confirm password"
        autoComplete="new-password"
        asPassword
        {...register('confirmPassword')}
      />
      <FieldError
        id="confirmPassword-error"
        message={errors.confirmPassword?.message}
      />

      <AppCardInput
        id="leetcodeUsername"
        placeholder="LeetCode username (optional)"
        autoComplete="off"
        {...register('leetcodeUsername')}
      />
      <FieldError
        id="leetcodeUsername-error"
        message={errors.leetcodeUsername?.message}
      />

      <AppCardButton size="lg" type="submit" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Signing up...
          </>
        ) : (
          'Sign Up'
        )}
      </AppCardButton>
    </form>
  );
}
