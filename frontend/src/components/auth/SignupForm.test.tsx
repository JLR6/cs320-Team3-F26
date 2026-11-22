import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { SignupForm } from './SignupForm';

// create independent mock objects for each test
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

// mock the supabase client and its chainable query structure
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
  await user.type(
    screen.getByPlaceholderText('Confirm password'),
    'password123',
  );
}

async function submit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Sign Up' }));
}

describe('SignupForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // start with an available email
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
  });

  // shows an email error after the field is blurred
  it('shows an email error after the field is blurred', async () => {
    const user = userEvent.setup();
    render(<SignupForm />);
    await user.type(screen.getByPlaceholderText('Email'), 'nope');
    await user.tab();
    expect(
      await screen.findByText('Enter a valid email address'),
    ).toBeInTheDocument();
  });

  // shows an email error for an existing account
  it('shows an email error for an existing account', async () => {
    // simulate the frontend email check finding a record
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

  // shows a mismatch error on the confirm field
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

  // does not call signup for a taken email
  it('does not call signUp for a taken email', async () => {
    // return a record to mark the address as registered
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

  // redirects when signup returns a session
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

  // shows a weak password error under the password field
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

  // shows a generic toast for other signup errors
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
  // shows a rate limit toast when email delivery is limited
  it('shows a rate limit toast when email delivery is limited', async () => {
    signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: {
        code: 'over_email_send_rate_limit',
        message: 'slow down',
      },
    });
    const user = userEvent.setup();
    render(<SignupForm />);
    await fillValid(user);
    await submit(user);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Too many attempts. Please wait a bit and try again.',
      ),
    );
  });
  // shows the duplicate email error from the signup response
  it('shows the duplicate email error from the signup response', async () => {
    signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: 'email_exists', message: 'already registered' },
    });
    const user = userEvent.setup();
    render(<SignupForm />);
    await fillValid(user);
    await submit(user);

    expect(
      await screen.findByText('An account with this email already exists'),
    ).toBeInTheDocument();
  });
  // shows a confirmation message when signup needs email confirmation
  it('shows a confirmation message when signup needs email confirmation', async () => {
    signUp.mockResolvedValue({
      data: { user: { identities: [{}] }, session: null },
      error: null,
    });
    const user = userEvent.setup();
    render(<SignupForm />);
    await fillValid(user);
    await submit(user);

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        'Account created! Check your email to confirm your account.',
      ),
    );
  });

  // stops when the email check fails
  it('stops when the email check fails', async () => {
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
  // shows a generic toast when the request throws
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
  // sends the leetcode username when it is provided
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
