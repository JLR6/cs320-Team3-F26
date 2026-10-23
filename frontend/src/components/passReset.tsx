'use client';

import React, { useState } from 'react';
import Link from 'next/link';

const UpdatePassword = () => {
  //set up the basic states for updating a password
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdate = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setErrorMessage('');
    setSuccessMessage('');
    setLoading(true);

    try {
      //password validation for UI testing
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match.');
        return;
      }

      //placeholder for Supabase password update
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
    <div className="wrapper">
      <form onSubmit={handleUpdate}>
        <h1>LeetMeet</h1>
        <h1>Reset Password</h1>

        <p>Enter your new password below.</p>

        <div className="input-box">
          <input
            type="password"
            placeholder="New Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        <div className="input-box">
          <input
            type="password"
            placeholder="Confirm New Password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        {errorMessage && <p role="alert">{errorMessage}</p>}
        {successMessage && <p role="status">{successMessage}</p>}

        <button type="submit" disabled={loading}>
          {loading ? 'Updating...' : 'Update Password'}
        </button>

        <div className="register-link">
          <p>
            Remember your password? <Link href="/">Back to Login</Link>
          </p>
        </div>
      </form>
    </div>
  );
};

export default UpdatePassword;
