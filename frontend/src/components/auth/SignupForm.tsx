'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from './PasswordInput';
import { signupSchema, type SignupValues } from '@/lib/validation/auth';
import { createClient } from '@/lib/supabase/client';
import { FieldError } from '@/components/auth/FieldError';

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
      const { data: available, error: checkError } = await supabase.rpc(
        'username_available',
        { name: values.username },
      );
      if (checkError) {
        toast.error('Could not check that username. Please try again.');
        return;
      }
      if (!available) {
        setError('username', { message: 'That username is already taken' });
        return;
      }

      // create the account after the name check
      const { data, error } = await supabase.auth.signUp({
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
      if (data.user && data.user.identities?.length === 0) {
        setError('email', {
          message: 'An account with this email already exists',
        });
        return;
      }

      if (data.session) {
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
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          {...register('email')}
        />
        <FieldError id="email-error" message={errors.email?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          autoComplete="username"
          aria-invalid={!!errors.username}
          aria-describedby={errors.username ? 'username-error' : undefined}
          {...register('username')}
        />
        <FieldError id="username-error" message={errors.username?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-error' : undefined}
          {...register('password')}
        />
        <FieldError id="password-error" message={errors.password?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <PasswordInput
          id="confirmPassword"
          autoComplete="new-password"
          aria-invalid={!!errors.confirmPassword}
          aria-describedby={
            errors.confirmPassword ? 'confirmPassword-error' : undefined
          }
          {...register('confirmPassword')}
        />
        <FieldError
          id="confirmPassword-error"
          message={errors.confirmPassword?.message}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="leetcodeUsername">LeetCode username (optional)</Label>
        <Input
          id="leetcodeUsername"
          autoComplete="off"
          aria-invalid={!!errors.leetcodeUsername}
          aria-describedby={
            errors.leetcodeUsername ? 'leetcodeUsername-error' : undefined
          }
          {...register('leetcodeUsername')}
        />
        <FieldError
          id="leetcodeUsername-error"
          message={errors.leetcodeUsername?.message}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Creating account...
          </>
        ) : (
          'Create account'
        )}
      </Button>
    </form>
  );
}
