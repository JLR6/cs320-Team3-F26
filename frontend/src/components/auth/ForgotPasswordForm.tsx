'use client';

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { createClient } from '@/lib/supabase/client';
import { FieldError } from './FieldError';
import { AppCardInput, AppCardButton } from '@/components/app-card';

// reuse one client instead of recreating it per submit
const supabase = createClient();

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // clear old state before the next request
    setErrorMessage('');
    setSent(false);
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/updatePassword`,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSent(true);
      toast.success('Check your email for a reset link.');
    } catch {
      setErrorMessage('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleReset} noValidate>
      <AppCardInput
        id="email"
        type="email"
        autoComplete="email"
        placeholder="Email address"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
        disabled={loading}
      />

      {/* show the local form error */}
      <FieldError id="email-error" message={errorMessage} />

      {sent && (
        <div
          role="status"
          className="text-xs font-semibold mt-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400"
        >
          If an account exists for this email, check your inbox for a password
          reset link.
        </div>
      )}

      <div className="w-full flex my-2">
        <AppCardButton
          variant="blue"
          type="submit"
          className="ml-auto"
          disabled={!email.trim() || loading}
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Sending...</span>
            </div>
          ) : (
            'Continue'
          )}
        </AppCardButton>
      </div>
    </form>
  );
}
