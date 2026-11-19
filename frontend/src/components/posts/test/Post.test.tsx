// also covers the like button and actions menu rendered by the card
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PostCard } from '../PostCard';
import { makePost } from '@/lib/test-utils';

// use one user event instance for interactive card tests
const user = userEvent.setup();

describe('PostCard', () => {
  it('logged out: links to the post, like is disabled, no owner menu', () => {
    render(
      <PostCard
        post={makePost()}
        isOwner={false}
        canInteract={false}
        onLike={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole('link', { name: /Two Sum/ })).toHaveAttribute(
      'href',
      '/posts/p1',
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
        isOwner={true}
        canInteract={true}
        onLike={onLike}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    );

    const like = screen.getByRole('button', { name: '3' });
    await user.click(like);
    expect(onLike).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Post options' }));
    await user.click(await screen.findByRole('menuitem', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Post options' }));
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalled();
  });
});
