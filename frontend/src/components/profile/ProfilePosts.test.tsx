import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProfilePost } from '@/lib/api/profile-posts';
import { ProfilePosts } from './ProfilePosts';

// a post like the one in the Figma design
function makePost(overrides: Partial<ProfilePost> = {}): ProfilePost {
  return {
    id: 'p1',
    author: { id: 'u2', username: 'Elizabeth S.', profilePicture: null },
    problemNumber: 42,
    problemName: 'Trapping Rain Water',
    difficulty: 'Hard',
    description: 'Solved my first hard problem!',
    tags: ['Array', 'Stack'],
    solutionUrl: null,
    likeCount: 1100,
    comments: [{}, {}, {}],
    createdAt: new Date(Date.now() - 3 * 60_000).toISOString(),
    ...overrides,
  };
}

// render the list with sensible defaults; each test overrides what it checks
function renderPosts(overrides: Partial<Parameters<typeof ProfilePosts>[0]>) {
  const onLoadMore = vi.fn();
  render(
    <ProfilePosts
      posts={[]}
      status="success"
      hasMore={false}
      loadingMore={false}
      onLoadMore={onLoadMore}
      {...overrides}
    />,
  );
  return { onLoadMore };
}

describe('ProfilePosts', () => {
  it('shows a loading line while posts load', () => {
    renderPosts({ status: 'pending' });
    expect(screen.getByText('Loading posts...')).toBeInTheDocument();
  });

  it('shows an error when posts fail to load', () => {
    renderPosts({ status: 'error' });
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load posts");
  });

  // empty state text from the "Profile - Mine" frame
  it('says the account has no posts', () => {
    renderPosts({ posts: [] });
    expect(screen.getByText('This account has no posts')).toBeInTheDocument();
  });

  // one card has everything from the design's post
  it('renders a post card with its details', () => {
    renderPosts({ posts: [makePost()] });

    expect(screen.getByText('Elizabeth S.')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '42. Trapping Rain Water' }),
    ).toHaveAttribute('href', '/posts/p1');
    expect(screen.getByText('(Hard)')).toBeInTheDocument();
    expect(screen.getByText('3m')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'see solution' })).toHaveAttribute(
      'href',
      '/posts/p1',
    );
    expect(screen.getByText('#Array')).toBeInTheDocument();
    expect(screen.getByLabelText('3 comments')).toHaveTextContent('3');
    expect(screen.getByLabelText('1100 likes')).toHaveTextContent('1.1k');
    expect(
      screen.getByText("You've reached the end of your feed"),
    ).toBeInTheDocument();
  });

  // missing optional fields fall back instead of crashing
  it('handles posts with missing details', () => {
    renderPosts({
      posts: [
        makePost({
          author: { id: 'u2', username: null },
          problemName: null,
          difficulty: null,
          createdAt: null,
          tags: [],
        }),
      ],
    });
    expect(screen.getByText('Unknown user')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '42. Problem 42' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });

  // more pages: a Load more button instead of the end message
  it('loads more posts when there are more pages', async () => {
    const { onLoadMore } = renderPosts({ posts: [makePost()], hasMore: true });
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(onLoadMore).toHaveBeenCalledOnce();
    expect(
      screen.queryByText("You've reached the end of your feed"),
    ).toBeNull();
  });

  // the button is disabled while the next page loads
  it('disables Load more while loading', () => {
    renderPosts({ posts: [makePost()], hasMore: true, loadingMore: true });
    expect(screen.getByRole('button', { name: 'Loading...' })).toBeDisabled();
  });
});
