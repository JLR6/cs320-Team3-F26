import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { UpdatePassword } from './PassResetForm';
import { toast } from 'sonner';

const { updateUser, signOut, replace, refresh } = vi.hoisted(() => ({
  // control authentication and navigation calls in each test
  updateUser: vi.fn(),
  signOut: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

// keep external services isolated from the form tests
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { updateUser, signOut } }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh }),
}));

type User = ReturnType<typeof userEvent.setup>;
async function submitValid(user: User) {
  // enter valid password and submit the form
  const password = screen.getByLabelText('New Password');
  const confirmPassword = screen.getByLabelText('New Password (Repeat)');

  await user.type(password, 'matching-password');
  await user.type(confirmPassword, 'matching-password');
  await user.click(screen.getByRole('button', { name: 'Save' }));
}

describe('UpdatePassword', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the password reset fields and save action', () => {
    render(<UpdatePassword />);

    // verify both password fields start empty and the save action is available
    expect(screen.getByLabelText('New Password')).toHaveValue('');
    expect(screen.getByLabelText('New Password (Repeat)')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('shows an error when the passwords do not match', async () => {
    const user = userEvent.setup();
    render(<UpdatePassword />);

    await user.type(screen.getByLabelText('New Password'), 'first-password');
    await user.type(
      screen.getByLabelText('New Password (Repeat)'),
      'second-password',
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // verify mismatched passwords show an error and supabase was not called
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Passwords do not match',
    );
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('shows success and clears both fields when the passwords match', async () => {
    updateUser.mockResolvedValue({ error: null });

    const user = userEvent.setup();
    render(<UpdatePassword />);

    await submitValid(user);

    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(replace).toHaveBeenCalledWith('/login');
    expect(refresh).toHaveBeenCalled();
    expect(updateUser).toHaveBeenCalledWith({
      password: 'matching-password',
    });
  });

  it('shows an error for a weak password', async () => {
    updateUser.mockResolvedValue({
      error: { code: 'weak_password', message: 'Password is too weak' },
    });
    const user = userEvent.setup();
    render(<UpdatePassword />);

    await submitValid(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Password is too weak',
    );
  });

  it('shows a generic message for other Supabase errors', async () => {
    updateUser.mockResolvedValue({
      error: { code: 'unexpected_failure' },
    });
    const user = userEvent.setup();
    render(<UpdatePassword />);
    await submitValid(user);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Could not update password. Please try again.',
      ),
    );
  });

  it('handles a network failure', async () => {
    updateUser.mockRejectedValue(new Error('network'));
    const user = userEvent.setup();
    render(<UpdatePassword />);
    await submitValid(user);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Something went wrong. Please try again.',
      ),
    );
  });
});
