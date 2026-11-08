import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import UpdatePassword from './passReset';

describe('UpdatePassword', () => {
  it('shows the reset password form and login link', () => {
    render(<UpdatePassword />);

    // verify the page explains what the form is for
    expect(screen.getByRole('heading', { name: 'Reset Password' })).toBeInTheDocument();
    expect(
      screen.getByText('Enter your new password below.'),
    ).toBeInTheDocument();

    // verify both password fields and the submit action are available
    expect(screen.getByPlaceholderText('New Password')).toHaveValue('');
    expect(screen.getByPlaceholderText('Confirm New Password')).toHaveValue('');
    expect(
      screen.getByRole('button', { name: 'Update Password' }),
    ).toBeInTheDocument();

    // verify users can return to the login page
    expect(screen.getByRole('link', { name: 'Back to Login' })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('shows an error when the passwords do not match', async () => {
    const user = userEvent.setup();
    render(<UpdatePassword />);

    // enter two different passwords to trigger the client-side check
    await user.type(screen.getByPlaceholderText('New Password'), 'first-password');
    await user.type(
      screen.getByPlaceholderText('Confirm New Password'),
      'second-password',
    );
    await user.click(screen.getByRole('button', { name: 'Update Password' }));

    // verify the mismatch is shown as an alert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Passwords do not match.',
    );
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows success and clears both fields when the passwords match', async () => {
    const user = userEvent.setup();
    render(<UpdatePassword />);
    const password = screen.getByPlaceholderText('New Password');
    const confirmPassword = screen.getByPlaceholderText('Confirm New Password');

    // enter matching passwords and submit the form
    await user.type(password, 'matching-password');
    await user.type(confirmPassword, 'matching-password');
    await user.click(screen.getByRole('button', { name: 'Update Password' }));

    // verify the update succeeds and the fields are cleared
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Password updated successfully!',
    );
    expect(password).toHaveValue('');
    expect(confirmPassword).toHaveValue('');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('clears an older error before checking a new submission', async () => {
    const user = userEvent.setup();
    render(<UpdatePassword />);
    const password = screen.getByPlaceholderText('New Password');
    const confirmPassword = screen.getByPlaceholderText('Confirm New Password');

    // submit mismatched values so the form displays an error
    await user.type(password, 'first-password');
    await user.type(confirmPassword, 'second-password');
    await user.click(screen.getByRole('button', { name: 'Update Password' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    // correct both values and submit again to replace the old error
    await user.clear(password);
    await user.clear(confirmPassword);
    await user.type(password, 'matching-password');
    await user.type(confirmPassword, 'matching-password');
    await user.click(screen.getByRole('button', { name: 'Update Password' }));

    // verify the successful result replaces the previous error
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Password updated successfully!',
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
