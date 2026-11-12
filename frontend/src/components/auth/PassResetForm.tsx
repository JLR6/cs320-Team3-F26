'use client';

import React, { useState } from 'react';
import { AppCardInput, AppCardButton } from '@/components/app-card';
import { Loader2 } from 'lucide-react';

export function UpdatePassword() {
  // Set up the basic states for updating a password
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setErrorMessage('');
    setSuccessMessage('');
    setLoading(true);

    try {
      // Password validation for UI testing
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match.');
        return;
      }

      // Placeholder for Supabase password update
      setSuccessMessage('Password updated successfully!');
      setPassword('');
      setConfirmPassword('');
    } catch {
      setErrorMessage('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleUpdate}>
      <AppCardInput
        type="password"
        label="New Password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="new-password"
        asPassword
        required
      />
      {/* TODO: add FieldError once this page is functional */}

      <AppCardInput
        type="password"
        label="New Password (Repeat)"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        autoComplete="new-password"
        asPassword
        required
      />
      {/* TODO: add FieldError once this page is functional */}

      {errorMessage && (
        <p
          role="alert"
          className="rounded-md border border-destructive/50 px-3 py-2 mt-5 -mb-3 text-xs text-destructive font-semibold"
        >
          {errorMessage}
        </p>
      )}

      {successMessage && (
        <p
          role="status"
          className="text-xs font-semibold mt-5 -mb-3  rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400"
        >
          {successMessage} HIHIHIHI
        </p>
      )}

      <div className="w-full flex my-2">
        <AppCardButton
          variant="blue"
          type="submit"
          className="ml-auto"
          disabled={loading}
        >
          {loading ? (
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
