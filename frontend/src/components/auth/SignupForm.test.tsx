import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { SignupForm } from './SignupForm';

// Create independent mock objects to manipulate inside individual tests
const { signUp, replace, maybeSingleMock, fromMock } = vi.hoisted(() => {
  const maybeSingleMock = vi.fn();
  const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
  const selectMock = vi.fn(() => ({ eq: eqMock }));
  const fromMock = vi.fn(() => ({ select: selectMock }));

  return {
    signUp: vi.fn(),
    replace: vi.fn(),
    maybeSingleMock,
    fromMock,
  };
});

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Mock the supabase client to simulate our fluent chainable query structure
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { signUp },
    from: fromMock,
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh: vi.fn() }),
}));

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText('Email'), 'alex@example.com');
  await user.type(screen.getByPlaceholderText('Username'), 'alex_dev');
  await user.type(screen.getByPlaceholderText('Password'), 'password123');
  await user.type(screen.getByPlaceholderText('Confirm password'), 'password123');
}

async function submit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Sign Up' }));
}

describe('SignupForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default the email check to return null, meaning the email is perfectly available
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
  });

  // Invalid email addresses are rejected when the field loses focus.
  it('shows an email error after the field is blurred', async () => {
    const user = userEvent.setup();
    render(<SignupForm />);
    await user.type(screen.getByPlaceholderText('Email'), 'nope');
    await user.tab();
    expect(
      await screen.findByText('Enter a valid email address'),
    ).toBeInTheDocument();
  });

  // Existing accounts display an inline email error and do not redirect.
  it('shows an error under email when the account already exists', async () => {
    // Simulate finding a record during the frontend pre-check step
    maybeSingleMock.mockResolvedValue({
      data: { email: 'alex@example.com' },
      error: null,
    });

    const user = userEvent.setup();
    render(<SignupForm />);
    await fillValid(user);
    await submit(user);

    expect(
      await screen.findByText('An account with this email already exists'),
    ).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  // The confirmation field must match the password field.
  it('shows a mismatch error on the confirm field', async () => {
    const user = userEvent.setup();
    render(<SignupForm />);
    await fillValid(user);
    const confirm = screen.getByPlaceholderText('Confirm password');
    await user.clear(confirm);
    await user.type(confirm, 'different123');
    await submit(user);
    expect(
      await screen.findByText('Passwords do not match'),
    ).toBeInTheDocument();
  });

  // Taken usernames prevent signup from being submitted.
  // UPDATE: This test now mirrors the email block logic since the code was migrated from checking usernames to email
  it('shows an error under email when it is taken, without calling signUp', async () => {
    // Mock the chain to return data instead of null, signaling the address is already registered
    maybeSingleMock.mockResolvedValue({
      data: { email: 'alex@example.com' },
      error: null,
    });
    const user = userEvent.setup();
    render(<SignupForm />);
    await fillValid(user);
    await submit(user);
    expect(
      await screen.findByText('An account with this email already exists'),
    ).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  // Successful signup redirects users to the feed.
  it('redirects when signUp returns a session', async () => {
    signUp.mockResolvedValue({
      data: { user: { identities: [{}] }, session: {} },
      error: null,
    });
    const user = userEvent.setup();
    render(<SignupForm />);
    await fillValid(user);
    await submit(user);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/feed'));
  });

  // Supabase weak-password errors are shown below the password field.
  it('shows a weak password error under the password field', async () => {
    signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: 'weak_password', message: 'Password is too weak' },
    });
    const user = userEvent.setup();
    render(<SignupForm />);
    await fillValid(user);
    await submit(user);

    expect(await screen.findByText('Password is too weak')).toBeInTheDocument();
  });

  // Unexpected signup failures show a generic error toast.
  it('shows a generic toast for other signup errors', async () => {
    signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: 'unexpected_failure', message: 'boom' },
    });
    const user = userEvent.setup();
    render(<SignupForm />);
    await fillValid(user);
    await submit(user);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Could not create your account. Please try again.',
      ),
    );
  });

  // Username-check failures stop signup and show an error toast.
  // UPDATE: Updated the error copy match to look for "email availability"
  it('stops and shows a toast when the email check fails', async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: { message: 'down' },
    });
    const user = userEvent.setup();
    render(<SignupForm />);
    await fillValid(user);
    await submit(user);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Could not check email availability. Please try again.',
      ),
    );
    expect(signUp).not.toHaveBeenCalled();
  });

  it('shows a generic toast when the request throws', async () => {
    maybeSingleMock.mockRejectedValue(new Error('network'));
    const user = userEvent.setup();
    render(<SignupForm />);
    await fillValid(user);
    await submit(user);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Something went wrong. Please try again.',
      ),
    );
  });

  it('sends the LeetCode username when it is provided', async () => {
    signUp.mockResolvedValue({
      data: { user: { identities: [{}] }, session: {} },
      error: null,
    });
    const user = userEvent.setup();
    render(<SignupForm />);
    await fillValid(user);
    await user.type(
      screen.getByPlaceholderText('LeetCode username (optional)'),
      'alex_lc',
    );
    await submit(user);

    await waitFor(() =>
      expect(signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            data: expect.objectContaining({ leetcode_username: 'alex_lc' }),
          }),
        }),
      ),
    );
  });
});
