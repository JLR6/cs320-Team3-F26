import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommentSection } from '../CommentSection';
import * as api from '@/lib/posts/posts-api';
import { makeComment, renderWithQuery } from '@/lib/test-utils';

// fake api so nothing is really sent
vi.mock('@/lib/posts/posts-api', async (importOriginal) => ({
  ApiError: (await importOriginal<typeof api>()).ApiError,
  addComment: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
  setLiked: vi.fn(),
  hasLiked: vi.fn(),
}));

const toastError = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({ toast: { error: toastError } }));

const user = userEvent.setup();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.hasLiked).mockResolvedValue(false);
});

describe('CommentSection', () => {
  // logged out: shows the empty message, a disabled box and disabled likes
  it('logged out: shows the empty message, a disabled box and disabled likes', () => {
    renderWithQuery(<CommentSection postId="p1" comments={[makeComment()]} />);

    expect(screen.getByPlaceholderText('Log in to comment')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Comment' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '0' })).toBeDisabled();
    // nobody is logged in, so there is no "did i like it?" request
    expect(api.hasLiked).not.toHaveBeenCalled();
  });
  // shows a message when there are no comments
  it('shows a message when there are no comments', () => {
    renderWithQuery(<CommentSection postId="p1" comments={[]} userId="u1" />);
    expect(screen.getByText('No comments yet.')).toBeInTheDocument();
  });
  // lists comments newest first
  it('lists comments newest first', () => {
    renderWithQuery(
      <CommentSection
        postId="p1"
        userId="u1"
        comments={[
          makeComment({ id: 'c1', content: 'first' }),
          makeComment({ id: 'c2', content: 'second' }),
        ]}
      />,
    );
    const texts = screen.getAllByText(/first|second/).map((e) => e.textContent);
    expect(texts).toEqual(['second', 'first']);
  });
  // submits trimmed text and clears the box
  it('submits trimmed text and clears the box', async () => {
    vi.mocked(api.addComment).mockResolvedValue(undefined);
    renderWithQuery(<CommentSection postId="p1" comments={[]} userId="u1" />);

    const input = screen.getByPlaceholderText('Type comment here...');
    const button = screen.getByRole('button', { name: 'Comment' });

    // blank text can't be submitted
    await user.type(input, '   ');
    expect(button).toBeDisabled();

    await user.clear(input);
    await user.type(input, '  hi  ');
    await user.click(button);

    expect(api.addComment).toHaveBeenCalledWith('p1', 'hi');
    await waitFor(() => expect(input).toHaveValue(''));
  });
  // likes a comment and shows the new count right away
  it('likes a comment and shows the new count right away', async () => {
    vi.mocked(api.setLiked).mockResolvedValue(undefined);
    renderWithQuery(
      <CommentSection
        postId="p1"
        userId="u1"
        comments={[makeComment({ likeCount: 2 })]}
      />,
    );

    // wait for the "did i like it?" answer before clicking
    await waitFor(() =>
      expect(api.hasLiked).toHaveBeenCalledWith('comment', 'c1'),
    );
    await user.click(screen.getByRole('button', { name: '2' }));

    expect(api.setLiked).toHaveBeenCalledWith('comment', 'c1', true);
  });
  // only the author sees edit and delete
  it('only the author sees edit and delete', () => {
    renderWithQuery(
      <CommentSection
        postId="p1"
        userId="someone-else"
        comments={[makeComment({ author: { id: 'u1', username: 'bob' } })]}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });
  // author can edit a comment
  it('author can edit a comment', async () => {
    vi.mocked(api.updateComment).mockResolvedValue(undefined);
    renderWithQuery(
      <CommentSection
        postId="p1"
        userId="u1"
        comments={[makeComment({ author: { id: 'u1', username: 'bob' } })]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const box = screen.getByRole('textbox', { name: 'Edit comment' });
    await user.clear(box);
    await user.type(box, 'changed');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(api.updateComment).toHaveBeenCalledWith('c1', 'changed');
    // the edit box closes once saved
    await waitFor(() =>
      expect(
        screen.queryByRole('textbox', { name: 'Edit comment' }),
      ).toBeNull(),
    );
  });
  // author can delete, and sees why when the comment has likes
  it('author can delete, and sees why when the comment has likes', async () => {
    vi.mocked(api.deleteComment).mockRejectedValue(
      new api.ApiError(409, 'Comment has related likes that prevent deletion'),
    );
    renderWithQuery(
      <CommentSection
        postId="p1"
        userId="u1"
        comments={[makeComment({ author: { id: 'u1', username: 'bob' } })]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(api.deleteComment).toHaveBeenCalledWith('c1');
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "This comment has likes, so it can't be deleted",
      ),
    );
  });
});
