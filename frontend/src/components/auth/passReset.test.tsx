import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import UpdatePassword from './PassResetForm';

describe('UpdatePassword', () => {
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

    // verify mismatched passwords show an error without a success message
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Passwords do not match.',
    );
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows success and clears both fields when the passwords match', async () => {
    const user = userEvent.setup();
    render(<UpdatePassword />);
    const password = screen.getByLabelText('New Password');
    const confirmPassword = screen.getByLabelText('New Password (Repeat)');

    await user.type(password, 'matching-password');
    await user.type(confirmPassword, 'matching-password');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // verify matching passwords show success and clear both inputs
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
    const password = screen.getByLabelText('New Password');
    const confirmPassword = screen.getByLabelText('New Password (Repeat)');

    await user.type(password, 'first-password');
    await user.type(confirmPassword, 'second-password');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    // correct the values and submit again to replace the previous error
    await user.clear(password);
    await user.clear(confirmPassword);
    await user.type(password, 'matching-password');
    await user.type(confirmPassword, 'matching-password');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // verify the successful submission removes the previous error
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Password updated successfully!',
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
