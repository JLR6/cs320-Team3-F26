import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CommentSection } from '../CommentSection';
import type { PostComment } from '@/types/post';

const user = userEvent.setup();

const comment = {
  id: 'c1',
  author: { id: 'user2', username: 'bob' },
  content: 'Nice!',
  createdAt: new Date().toISOString(),
} as PostComment;

describe('CommentSection', () => {
  it('logged out: shows the empty message and a login prompt, no input', () => {
    render(<CommentSection comments={[]} onAdd={vi.fn()} canComment={false} />);

    expect(screen.getByText('No comments yet.')).toBeInTheDocument();
    expect(screen.getByText('Log in to comment.')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Add a comment...')).toBeNull();
  });

  it('logged in: lists comments, ignores blank input, submits trimmed text and clears', async () => {
    const onAdd = vi.fn();
    render(<CommentSection comments={[comment]} onAdd={onAdd} canComment />);

    expect(screen.getByText('bob')).toBeInTheDocument();
    expect(screen.getByText('Nice!')).toBeInTheDocument();

    const input = screen.getByPlaceholderText('Add a comment...');
    const post = screen.getByRole('button', { name: 'Post' });

    await user.type(input, '   ');
    await user.click(post);
    expect(onAdd).not.toHaveBeenCalled();

    await user.clear(input);
    await user.type(input, '  hi  ');
    await user.click(post);
    expect(onAdd).toHaveBeenCalledWith('hi');
    await waitFor(() => expect(input).toHaveValue(''));
  });
});
