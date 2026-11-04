import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { SignupForm } from './SignupForm';

const { signUp, rpc, replace } = vi.hoisted(() => ({
  signUp: vi.fn(),
  rpc: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signUp }, rpc }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh: vi.fn() }),
}));

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Email'), 'alex@example.com');
  await user.type(screen.getByLabelText('Username'), 'alex_dev');
  await user.type(screen.getByLabelText('Password'), 'password123');
  await user.type(screen.getByLabelText('Confirm password'), 'password123');
}

async function submit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Create account' }));
}

describe('SignupForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpc.mockResolvedValue({ data: true, error: null });
  });

  // Invalid email addresses are rejected when the field loses focus.
  it('shows an email error after the field is blurred', async () => {
    const user = userEvent.setup();
    render(<SignupForm />);
    await user.type(screen.getByLabelText('Email'), 'nope');
    await user.tab();
    expect(
      await screen.findByText('Enter a valid email address'),
    ).toBeInTheDocument();
  });

  // Existing accounts display an inline email error and do not redirect.
  it('shows an error under email when the account already exists', async () => {
    signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: {
        code: 'user_already_exists',
        message: 'User already registered',
      },
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
    const confirm = screen.getByLabelText('Confirm password');
    await user.clear(confirm);
    await user.type(confirm, 'different123');
    await submit(user);
    expect(
      await screen.findByText('Passwords do not match'),
    ).toBeInTheDocument();
  });

  // Taken usernames prevent signup from being submitted.
  it('shows an error under username when it is taken, without calling signUp', async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const user = userEvent.setup();
    render(<SignupForm />);
    await fillValid(user);
    await submit(user);
    expect(
      await screen.findByText('That username is already taken'),
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
  it('stops and shows a toast when the username check fails', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'down' } });
    const user = userEvent.setup();
    render(<SignupForm />);
    await fillValid(user);
    await submit(user);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Could not check that username. Please try again.',
      ),
    );
    expect(signUp).not.toHaveBeenCalled();
  });

  it('shows a generic toast when the request throws', async () => {
  rpc.mockRejectedValue(new Error('network'));
  const user = userEvent.setup();
  render(<SignupForm />);
  await fillValid(user);
  await submit(user);

  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith('Something went wrong. Please try again.'),
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
  await user.type(screen.getByLabelText('LeetCode username (optional)'), 'alex_lc');
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
