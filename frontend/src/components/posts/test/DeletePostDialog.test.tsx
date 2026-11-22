import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DeletePostDialog } from '../DeletePostDialog';

describe('DeletePostDialog', () => {
  // shows the confirmation actions when open
  it('shows the confirmation actions when open', () => {
    render(
      <DeletePostDialog open onOpenChange={vi.fn()} onConfirm={vi.fn()} />,
    );

    expect(screen.getByRole('heading', { name: 'Delete Post?' })).toBeVisible();
    expect(
      screen.getByText('This action cannot be undone'),
    ).toBeInTheDocument();
  });

  // closes from cancel and confirms deletion
  it('closes from cancel and confirms deletion', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();
    render(
      <DeletePostDialog
        open
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
