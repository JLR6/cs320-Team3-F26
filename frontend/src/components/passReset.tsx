'use client';

import React, { useState } from 'react';
import Link from 'next/link';

const UpdatePassword = () => {
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
    <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <form
        onSubmit={handleUpdate}
        className="w-full max-w-md space-y-5 rounded-lg border border-border bg-card p-6 text-card-foreground"
      >
        <h1 className="text-2xl font-semibold">LeetMeet</h1>
        <h2 className="text-xl font-medium">Reset Password</h2>

        <p className="text-muted-foreground">Enter your new password below.</p>

        <div>
          <input
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground"
            type="password"
            placeholder="New Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        <div>
          <input
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground"
            type="password"
            placeholder="Confirm New Password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        {errorMessage && (
          <p className="text-destructive" role="alert">
            {errorMessage}
          </p>
        )}

        {successMessage && (
          <p className="text-easy" role="status">
            {successMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50"
        >
          {loading ? 'Updating...' : 'Update Password'}
        </button>

        <div className="text-sm text-muted-foreground">
          <p>
            Remember your password?{' '}
            <Link
              href="/"
              className="text-primary underline underline-offset-4"
            >
              Back to Login
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
};

export default UpdatePassword;
