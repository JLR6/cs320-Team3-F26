import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { LoginForm } from './LoginForm';

const { signInWithPassword, replace, refresh } = vi.hoisted(() => ({
  // control authentication and navigation calls in each test
  signInWithPassword: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

// keep external services isolated from the form tests
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signInWithPassword } }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh }),
}));

type User = ReturnType<typeof userEvent.setup>;

async function submitValid(user: User) {
  // enter valid credentials and submit the form
  await user.type(screen.getByLabelText('Email'), 'alex@example.com');
  await user.type(screen.getByLabelText('Password'), 'password123');
  await user.click(screen.getByRole('button', { name: 'Log in' }));
}

describe('LoginForm', () => {
  // reset shared mocks before every test
  beforeEach(() => vi.clearAllMocks());

  it('shows errors and does not call Supabase when the form is empty', async () => {
    const user = userEvent.setup();
    render(<LoginForm next="/dashboard" />);
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(
      await screen.findByText('Enter a valid email address'),
    ).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('logs in and goes to the next path', async () => {
    // simulate a successful login response
    signInWithPassword.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<LoginForm next="/feed" />);
    await submitValid(user);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/feed'));
    expect(refresh).toHaveBeenCalled();
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'alex@example.com',
      password: 'password123',
    });
  });

  it('shows one vague message for wrong credentials', async () => {
    // simulate invalid login details
    signInWithPassword.mockResolvedValue({
      error: { code: 'invalid_credentials' },
    });
    const user = userEvent.setup();
    render(<LoginForm next="/dashboard" />);
    await submitValid(user);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Incorrect email or password.'),
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it('shows a generic message for other Supabase errors', async () => {
    // simulate an unexpected authentication error
    signInWithPassword.mockResolvedValue({
      error: { code: 'unexpected_failure' },
    });
    const user = userEvent.setup();
    render(<LoginForm next="/dashboard" />);
    await submitValid(user);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Could not log in. Please try again.',
      ),
    );
  });

  it('handles a network failure', async () => {
    // simulate a failed network request
    signInWithPassword.mockRejectedValue(new Error('network'));
    const user = userEvent.setup();
    render(<LoginForm next="/dashboard" />);
    await submitValid(user);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Something went wrong. Please try again.',
      ),
    );
  });

  it('disables the button while logging in', async () => {
    // keep the request pending while checking the loading state
    let finish!: (value: unknown) => void;
    signInWithPassword.mockReturnValue(
      new Promise((resolve) => (finish = resolve)),
    );
    const user = userEvent.setup();
    render(<LoginForm next="/dashboard" />);
    await submitValid(user);

    expect(
      await screen.findByRole('button', { name: /logging in/i }),
    ).toBeDisabled();
    finish({ error: null });
    await waitFor(() => expect(replace).toHaveBeenCalled());
  });
});
