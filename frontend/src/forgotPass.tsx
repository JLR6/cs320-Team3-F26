import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY!,
);

const Forgot = () => {
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setErrorMessage('');
    setSuccessMessage('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/updatePassword',
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage(
        'If an account exists for this email, check your inbox for a password reset link.',
      );
    } catch {
      setErrorMessage('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wrapper">
      <form onSubmit={handleReset}>
        <h1>Password Reset</h1>

        <p>
          Forgot your password? Enter your email, and we’ll send you a link to
          reset it.
        </p>

        <div className="input-box">
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        {errorMessage && <p role="alert">{errorMessage}</p>}

        {successMessage && <p role="status">{successMessage}</p>}

        <button type="submit" disabled={loading}>
          {loading ? 'Sending...' : 'Submit'}
        </button>

        <div className="back-login">
          <Link to="/">Back to Login</Link>
        </div>
      </form>
    </div>
  );
};

export default Forgot;
