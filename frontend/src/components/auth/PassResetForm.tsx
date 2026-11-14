'use client';

import { AppCardInput, AppCardButton } from '@/components/app-card';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { passResetSchema, type PassResetValues } from '@/lib/validation/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { createClient } from '@/lib/supabase/client';
import { FieldError } from '@/components/auth/FieldError';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export function UpdatePassword() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PassResetValues>({
    resolver: zodResolver(passResetSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: { password: '', confirmPassword: '' },
  });

  async function onSubmit(values: PassResetValues) {
    try {
      const supabase = createClient();

      const { error } = await supabase.auth.updateUser({
        password: values.password,
      });

      if (error) {
        if (error.code === 'weak_password') {
          setError('password', { message: error.message });
        } else {
          toast.error('Could not update password. Please try again.');
        }
        return;
      }

      // logging out and redirecting to log in
      toast.success('Password changed!');
      supabase.auth.signOut({ scope: 'local' });
      router.replace('/login');
      router.refresh();
    } catch {
      toast.error('Something went wrong. Please try again.');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <AppCardInput
        type="password"
        label="New Password"
        autoComplete="new-password"
        asPassword
        {...register('password')}
      />
      <FieldError id="password-error" message={errors.password?.message} />

      <AppCardInput
        type="password"
        label="New Password (Repeat)"
        autoComplete="new-password"
        asPassword
        {...register('confirmPassword')}
      />
      <FieldError
        id="confirmPassword-error"
        message={errors.confirmPassword?.message}
      />

      <div className="w-full flex my-2">
        <AppCardButton
          variant="blue"
          type="submit"
          className="ml-auto"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Updating...</span>
            </div>
          ) : (
            'Save'
          )}
        </AppCardButton>
      </div>
    </form>
  );
}
