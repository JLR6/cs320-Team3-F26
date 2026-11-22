// post detail behavior is tested here because it owns loading and navigation
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostDetail } from '../PostDetail';
import * as api from '@/lib/posts/posts-api';
import { FEED_PATH } from '@/lib/utils';
import { makeComment, makePost, renderWithQuery } from '@/lib/test-utils';

const push = vi.hoisted(() => vi.fn());
const getUser = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/posts/posts-api');
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getUser } }),
}));

const user = userEvent.setup();

beforeEach(() => {
  vi.resetAllMocks();
  getUser.mockResolvedValue({
    data: { user: { id: 'user1', user_metadata: { username: 'alice' } } },
  });
  vi.mocked(api.hasLiked).mockResolvedValue(false);
});

function renderDetail(id = 'p1') {
  return renderWithQuery(<PostDetail id={id} />);
}

describe('PostDetail', () => {
  // shows a safe solution link
  it('shows a safe solution link', async () => {
    vi.mocked(api.getPostById).mockResolvedValue(
      makePost({
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(1)',
        solution: 'https://leetcode.com/s/1',
      }),
    );
    renderDetail();

    // verify the solution link is shown for a safe url
    expect(
      await screen.findByRole('link', { name: /View solution on LeetCode/ }),
    ).toHaveAttribute('href', 'https://leetcode.com/s/1');
  });
  // hides unsafe solution links
  it('hides unsafe solution links', () => {
    vi.mocked(api.getPostById).mockResolvedValue(
      makePost({
        timeComplexity: 'O(n)',
        solution: 'evil://link.com/solution',
      }),
    );
    renderDetail();

    // verify unsafe urls are not rendered as links
    expect(
      screen.queryByRole('link', { name: /View solution on LeetCode/ }),
    ).toBeNull();
  });
  // does not render a complexity section
  it('does not render a complexity section', () => {
    vi.mocked(api.getPostById).mockResolvedValue(makePost());
    renderDetail();
    // verify unsupported complexity fields are not rendered
    expect(screen.queryByText('Time complexity')).toBeNull();
  });
});

describe('PostDetail', () => {
  // shows loading..., then the post and a back button
  it('shows Loading..., then the post and a back button', async () => {
    vi.mocked(api.getPostById).mockResolvedValue(makePost());
    renderDetail();
    // wait for the detail request to finish before checking the page
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    expect(
      await screen.findByRole('heading', { name: /Two Sum/ }), // regular expression
    ).toBeInTheDocument();
    // verify the page provides a back button
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });
  // shows an error when loading fails
  it('shows an error when loading fails', async () => {
    vi.mocked(api.getPostById).mockRejectedValue(new Error('x'));
    renderDetail();
    expect(
      await screen.findByText("Couldn't load this post"),
    ).toBeInTheDocument();
  });
  // shows a message when the post does not exist
  it('shows a message when the post does not exist', async () => {
    vi.mocked(api.getPostById).mockResolvedValue(null);
    renderDetail();
    expect(
      await screen.findByText("This post doesn't exist."),
    ).toBeInTheDocument();
  });
  // like updates the count right away and calls the backend
  it('like updates the count right away and calls the backend', async () => {
    vi.mocked(api.getPostById).mockResolvedValue(makePost());
    vi.mocked(api.setLiked).mockResolvedValue(undefined);
    renderDetail();

    await user.click(await screen.findByRole('button', { name: '3' }));

    expect(
      await screen.findByRole('button', { name: '4' }),
    ).toBeInTheDocument();
    expect(api.setLiked).toHaveBeenCalledWith('post', 'p1', true);
  });
  // puts the like back when the backend fails
  it('puts the like back when the backend fails', async () => {
    vi.mocked(api.getPostById).mockResolvedValue(makePost());
    vi.mocked(api.setLiked).mockRejectedValue(new Error('down'));
    renderDetail();

    await user.click(await screen.findByRole('button', { name: '3' }));

    // verify the count goes back after the failed request
    await waitFor(() => expect(api.setLiked).toHaveBeenCalled());
    expect(
      await screen.findByRole('button', { name: '3' }),
    ).toBeInTheDocument();
  });
  // adding a comment reloads the post and shows it in the list
  it('adding a comment reloads the post and shows it in the list', async () => {
    // first load: no comments, after posting: the backend has the comment
    vi.mocked(api.getPostById)
      .mockResolvedValueOnce(makePost())
      .mockResolvedValue(
        makePost({ comments: [makeComment({ content: 'Nice!' })] }),
      );
    vi.mocked(api.addComment).mockResolvedValue(undefined);
    renderDetail();

    await user.type(
      await screen.findByPlaceholderText('Type comment here...'),
      'Nice!',
    );
    await user.click(screen.getByRole('button', { name: 'Comment' }));

    expect(await screen.findByText('Nice!')).toBeInTheDocument();
    expect(api.addComment).toHaveBeenCalledWith('p1', 'Nice!');
  });
  // edit: saving from the dialog calls updatepost
  it('edit: saving from the dialog calls updatePost', async () => {
    vi.mocked(api.getPostById).mockResolvedValue(makePost());
    vi.mocked(api.updatePost).mockResolvedValue(makePost());
    renderDetail();

    await user.click(
      await screen.findByRole('button', { name: 'Post options' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: /edit/i }));
    await user.click(await screen.findByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(api.updatePost).toHaveBeenCalledWith('p1', expect.anything()),
    );
  });
  // delete: confirming deletes the post and returns to the feed
  it('delete: confirming deletes the post and returns to the feed', async () => {
    vi.mocked(api.getPostById).mockResolvedValue(makePost());
    vi.mocked(api.deletePost).mockResolvedValue(undefined);
    renderDetail();

    await user.click(
      await screen.findByRole('button', { name: 'Post options' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    expect(api.deletePost).toHaveBeenCalledWith('p1');
    await waitFor(() => expect(push).toHaveBeenCalledWith(FEED_PATH));
  });
});
