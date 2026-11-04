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

  it('shows an email error after the field is blurred', async () => {
    const user = userEvent.setup();
    render(<SignupForm />);
    await user.type(screen.getByLabelText('Email'), 'nope');
    await user.tab();
    expect(
      await screen.findByText('Enter a valid email address'),
    ).toBeInTheDocument();
  });

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

  it('tells the user to check their email when confirmation is required', async () => {
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
        expect.stringContaining('Check your email'),
      ),
    );
    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'alex@example.com' }),
    );
  });

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
});
