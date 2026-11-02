// Also covers LikeButton, PostActionsMenu (and the badges) since the card renders them.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PostCard } from '../PostCard';
import { postPath } from '@/lib/utils';
import { makePost } from '@/lib/test-utils';

// The `user` is a UserEvent instance from @testing-library/user-event, which simulates user interactions.
const user = userEvent.setup();

describe('PostCard', () => {
  it('logged out: links to the post, like is disabled, no owner menu', () => {
    render(
      <PostCard
        post={makePost()}
        onLike={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole('link', { name: /Two Sum/ })).toHaveAttribute(
      'href',
      postPath('p1'),
    );
    expect(screen.getByRole('button', { name: '3' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Post options' })).toBeNull();
  });

  it('owner: shows (edited), like and the Edit/Delete menu call their handlers', async () => {
    const post = makePost({
      likedByMe: true,
      updatedAt: new Date().toISOString(),
    });
    const onLike = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <PostCard
        post={post}
        currentUserId="user1"
        onLike={onLike}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );

    expect(screen.getByText(/\(edited\)/)).toBeInTheDocument();

    const like = screen.getByRole('button', { name: '3' });
    expect(like).toHaveAttribute('aria-pressed', 'true');
    await user.click(like);
    expect(onLike).toHaveBeenCalledWith('p1');

    await user.click(screen.getByRole('button', { name: 'Post options' }));
    await user.click(await screen.findByRole('menuitem', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(post);

    await user.click(screen.getByRole('button', { name: 'Post options' }));
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith(post);
  });
});
