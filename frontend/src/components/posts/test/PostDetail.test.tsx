// PostDetail's like button, owner menu and comment box are already tested through
// PostCard / CommentSection, so here we only test what is unique to this file.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostDetail, PostDetailView } from '../PostDetail';
import * as api from '@/lib/posts-api';
import { FEED_PATH } from '@/lib/utils';
import { makePost } from '@/lib/test-utils';
import type { Post, PostComment } from '@/types/post';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/posts-api');

const user = userEvent.setup();

beforeEach(() => {
  vi.resetAllMocks();
});

function renderDetail(post: Post) {
  return render(
    <PostDetail
      post={post}
      onLike={vi.fn()}
      onComment={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
    />,
  );
}

describe('PostDetail', () => {
  it('shows complexity and an https solution link', () => {
    renderDetail(
      makePost({
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(1)',
        solutionUrl: 'https://leetcode.com/s/1', // really simple solution link that should be allowed
      }),
    );

    expect(screen.getByText('O(n)')).toBeInTheDocument();
    expect(screen.getByText('O(1)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View solution/ })).toHaveAttribute(
      'href',
      'https://leetcode.com/s/1',
    );
  });

  it('shows a dash for missing complexity and hides non-http links', () => {
    renderDetail(
      makePost({
        timeComplexity: 'O(n)',
        solutionUrl: 'evil://link.com/solution',
      }),
    );

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /View solution/ })).toBeNull();
  });

  it('hides the complexity section when neither value is set', () => {
    renderDetail(makePost());
    expect(screen.queryByText('Time complexity')).toBeNull();
  });
});

function renderView() {
  return render(<PostDetailView postId="p1" currentUserId="user1" />);
}

describe('PostDetailView', () => {
  it('shows Loading..., then the post and a back link', async () => {
    vi.mocked(api.getPostById).mockResolvedValue(makePost());
    renderView();
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    expect(
      await screen.findByRole('heading', { name: /Two Sum/ }), // regular expression
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to feed/ })).toHaveAttribute(
      'href',
      FEED_PATH,
    );
  });

  it('shows an error when loading fails', async () => {
    vi.mocked(api.getPostById).mockRejectedValue(new Error('x'));
    renderView();
    expect(
      await screen.findByText("Couldn't load this post. Please try again."),
    ).toBeInTheDocument();
  });

  it('shows a message when the post does not exist', async () => {
    vi.mocked(api.getPostById).mockResolvedValue(null);
    renderView();
    expect(
      await screen.findByText("This post doesn't exist or was deleted."),
    ).toBeInTheDocument();
  });

  it('like updates the post', async () => {
    vi.mocked(api.getPostById).mockResolvedValue(makePost());
    vi.mocked(api.toggleLike).mockResolvedValue(makePost({ likeCount: 4 }));
    renderView();

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
    renderView();

    await user.type(
      await screen.findByPlaceholderText('Add a comment...'),
      'Nice!',
    );
    await user.click(screen.getByRole('button', { name: 'Post' }));

    expect(await screen.findByText('Nice!')).toBeInTheDocument();
    expect(api.addComment).toHaveBeenCalledWith('p1', 'Nice!');
  });

  it('edit: saving from the dialog calls updatePost', async () => {
    vi.mocked(api.getPostById).mockResolvedValue(makePost());
    vi.mocked(api.updatePost).mockResolvedValue(makePost());
    renderView();

    await user.click(
      await screen.findByRole('button', { name: 'Post options' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: /edit/i }));
    await user.click(
      await screen.findByRole('button', { name: 'Save changes' }),
    );

    expect(api.updatePost).toHaveBeenCalledWith('p1', expect.anything());
  });

  it('delete: confirming deletes the post and returns to the feed', async () => {
    vi.mocked(api.getPostById).mockResolvedValue(makePost());
    vi.mocked(api.deletePost).mockResolvedValue(undefined);
    renderView();

    await user.click(
      await screen.findByRole('button', { name: 'Post options' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    expect(api.deletePost).toHaveBeenCalledWith('p1');
    expect(push).toHaveBeenCalledWith(FEED_PATH);
  });
});
