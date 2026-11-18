// post detail behavior is tested here because it owns loading and navigation
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostDetail } from '../PostDetail';
import * as api from '@/lib/posts/posts-api';
import { FEED_PATH } from '@/lib/utils';
import { makePost } from '@/lib/test-utils';
import type { PostComment } from '@/types/post';

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
});

function renderDetail(id = 'p1') {
  return render(<PostDetail id={id} />);
}

describe('PostDetail', () => {
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

  it('does not render a complexity section', () => {
    vi.mocked(api.getPostById).mockResolvedValue(makePost());
    renderDetail();
    // verify unsupported complexity fields are not rendered
    expect(screen.queryByText('Time complexity')).toBeNull();
  });
});

describe('PostDetail', () => {
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

  it('shows an error when loading fails', async () => {
    vi.mocked(api.getPostById).mockRejectedValue(new Error('x'));
    renderDetail();
    expect(
      await screen.findByText("Couldn't load this post"),
    ).toBeInTheDocument();
  });

  it('shows a message when the post does not exist', async () => {
    vi.mocked(api.getPostById).mockResolvedValue(null);
    renderDetail();
    expect(
      await screen.findByText("This post doesn't exist."),
    ).toBeInTheDocument();
  });

  it('like updates the post', async () => {
    vi.mocked(api.getPostById).mockResolvedValue(makePost());
    vi.mocked(api.toggleLike).mockResolvedValue(makePost({ likeCount: 4 }));
    renderDetail();

    await user.click(await screen.findByRole('button', { name: '3' }));

    expect(
      await screen.findByRole('button', { name: '4' }),
    ).toBeInTheDocument();
  });

  it('adding a comment shows it in the list', async () => {
    vi.mocked(api.getPostById).mockResolvedValue(makePost());
    vi.mocked(api.addComment).mockResolvedValue({
      id: 'c1',
      author: { id: 'user1', username: 'alice' },
      content: 'Nice!',
      createdAt: new Date().toISOString(),
    } as PostComment);
    renderDetail();

    await user.type(
      await screen.findByPlaceholderText('Type comment here...'),
      'Nice!',
    );
    await user.click(screen.getByRole('button', { name: 'Comment' }));

    expect(await screen.findByText('Nice!')).toBeInTheDocument();
    expect(api.addComment).toHaveBeenCalledWith('p1', 'Nice!');
  });

  it('edit: saving from the dialog calls updatePost', async () => {
    vi.mocked(api.getPostById).mockResolvedValue(makePost());
    vi.mocked(api.updatePost).mockResolvedValue(makePost());
    renderDetail();

    await user.click(
      await screen.findByRole('button', { name: 'Post options' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: /edit/i }));
    await user.click(await screen.findByRole('button', { name: 'Save' }));

    expect(api.updatePost).toHaveBeenCalledWith('p1', expect.anything());
  });

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
    expect(push).toHaveBeenCalledWith(FEED_PATH);
  });
});
