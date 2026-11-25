import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  beforeEach(() => {
    // start every test with a successful password update response
    vi.clearAllMocks();
    updateUser.mockResolvedValue({ error: null });
  });

  // shows the password reset fields and save action
  it('shows the password reset fields and save action', () => {
    render(<UpdatePassword />);

    // verify both password fields start empty and the save action is available
    expect(screen.getByLabelText('New Password')).toHaveValue('');
    expect(screen.getByLabelText('New Password (Repeat)')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });
  // shows an error when the passwords do not match
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
  // updates the password and returns the user to login
  it('updates the password when the passwords match', async () => {
    const user = userEvent.setup();
    render(<UpdatePassword />);

    await submitValid(user);

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Password changed!'),
    );
    expect(updateUser).toHaveBeenCalledWith({ password: 'matching-password' });
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(replace).toHaveBeenCalledWith('/login');
    expect(refresh).toHaveBeenCalled();
  });
  // shows weak-password and generic server responses
  it('shows server errors from failed password updates', async () => {
    updateUser
      .mockResolvedValueOnce({
        error: { code: 'weak_password', message: 'Password is too weak' },
      })
      .mockResolvedValueOnce({ error: { code: 'unexpected' } });
    const user = userEvent.setup();
    render(<UpdatePassword />);
    await submitValid(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Password is too weak',
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
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
