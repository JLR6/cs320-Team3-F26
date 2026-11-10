import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PostForm } from '../PostForm';
import { fillPostForm, makePost } from '@/lib/test-utils';

const user = userEvent.setup();

describe('PostForm', () => {
  it('blocks an empty submit, then clears a field error once the user types', async () => {
    const onSubmit = vi.fn();
    render(<PostForm onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: 'Post' }));

    const name = screen.getByLabelText('Problem name');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(name).toHaveAttribute('aria-invalid', 'true');

    await user.type(name, 'T');
    expect(name).toHaveAttribute('aria-invalid', 'false');
  });

  it('submits the parsed values when the form is valid', async () => {
    const onSubmit = vi.fn();
    render(<PostForm onSubmit={onSubmit} />);

    await fillPostForm(user);
    await user.click(screen.getByRole('button', { name: 'Post' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ problemNumber: 1 }),
    );
  });

  it('shows a save error when onSubmit fails', async () => {
    render(
      <PostForm onSubmit={vi.fn().mockRejectedValue(new Error('boom'))} />,
    );

    await fillPostForm(user);
    await user.click(screen.getByRole('button', { name: 'Post' }));

    expect(
      await screen.findByText("Couldn't save your post. Please try again."),
    ).toBeInTheDocument();
  });

  it('edit mode: prefills the fields, relabels the button, and cancels', async () => {
    const onCancel = vi.fn();
    render(
      <PostForm
        initial={makePost({
          problem: {
            number: 1,
            title: 'Two Sum',
            difficulty: 'Easy',
            tags: ['BFS', 'HashTable'],
          },
        })}
        onSubmit={vi.fn()}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByLabelText('Problem name')).toHaveValue('Two Sum');
    expect(screen.getByLabelText('Tags')).toHaveValue('#BFS #HashTable');
    expect(
      screen.getByRole('button', { name: 'Save changes' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
