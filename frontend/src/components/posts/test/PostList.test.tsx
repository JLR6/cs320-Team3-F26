import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PostList } from '../PostList';
import * as api from '@/lib/posts/posts-api';
import { fillPostForm, makePost } from '@/lib/test-utils';

vi.mock('@/lib/posts/posts-api');

function renderList(props: Partial<ComponentProps<typeof PostList>> = {}) {
  return render(
    <PostList
      feed="main"
      currentUserId="user1"
      createOpen={false}
      onCreateOpenChange={vi.fn()}
      {...props}
    />,
  );
}

async function openPostMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Post options' }));
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('PostList', () => {
  it('loads posts and updates the like count', async () => {
    const user = userEvent.setup();

    vi.mocked(api.getPosts).mockResolvedValue({
      posts: [makePost()],
      nextCursor: null,
      hasMore: false,
    });
    vi.mocked(api.toggleLike).mockResolvedValue(
      makePost({ likedByMe: true, likeCount: 4 }),
    );

    renderList();

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: '3' }));

    expect(api.toggleLike).toHaveBeenCalledWith('p1');
    expect(
      await screen.findByRole('button', { name: '4' }),
    ).toBeInTheDocument();
  });

  // this checks the empty state for each feed type
  it.each([
    ['main', 'No posts yet.'],
    ['following', 'Go follow people to see their posts here.'],
  ] as const)(
    'shows the empty message for the %s feed',
    async (feed, message) => {
      vi.mocked(api.getPosts).mockResolvedValue({
        posts: [],
        nextCursor: null,
        hasMore: false,
      });

      // render the list so the feed-specific empty message is shown
      renderList({ feed });

      expect(await screen.findByText(message)).toBeInTheDocument();
    },
  );

  it('shows an error if posts fail to load', async () => {
    vi.mocked(api.getPosts).mockRejectedValue(new Error('Failed to load'));

    renderList();

    expect(
      await screen.findByText("Couldn't load posts. Please try again."),
    ).toBeInTheDocument();
  });

  it.each([
    ['main', true],
    ['following', false],
  ] as const)('creates a post on the %s feed', async (feed, shouldShowPost) => {
    const user = userEvent.setup();
    const onCreateOpenChange = vi.fn();

    vi.mocked(api.getPosts).mockResolvedValue({
      posts: [],
      nextCursor: null,
      hasMore: false,
    });
    vi.mocked(api.createPost).mockResolvedValue(
      makePost({ problemName: 'Add Two Numbers' }),
    );

    renderList({
      feed,
      createOpen: true,
      onCreateOpenChange,
    });

    await fillPostForm(user);
    await user.click(screen.getByRole('button', { name: 'Post' }));

    await waitFor(() => {
      expect(onCreateOpenChange).toHaveBeenCalledWith(false);
    });

    if (shouldShowPost) {
      expect(
        (await screen.findAllByText(/Add Two Numbers/)).length,
      ).toBeGreaterThan(0);
    } else {
      expect(screen.queryByText(/Add Two Numbers/)).not.toBeInTheDocument();
    }
  });

  it('edits a post', async () => {
    const user = userEvent.setup();

    vi.mocked(api.getPosts).mockResolvedValue({
      posts: [makePost()],
      nextCursor: null,
      hasMore: false,
    });
    vi.mocked(api.updatePost).mockResolvedValue(
      makePost({ problemName: 'Three Sum' }),
    );

    renderList();

    await openPostMenu(user);
    // use a case insensitive pattern to find the edit menu item
    await user.click(await screen.findByRole('menuitem', { name: /edit/i }));

    const description = (await screen.findAllByRole('textbox'))[2];

    await user.clear(description);
    await user.type(description, 'Three Sum');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect((await screen.findAllByText(/Three Sum/)).length).toBeGreaterThan(0);

    expect(api.updatePost).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({
        problemNumber: 1,
        description: 'Three Sum',
      }),
    );
  });

  it('keeps a post when cancelled and removes it when deleted', async () => {
    const user = userEvent.setup();

    vi.mocked(api.getPosts).mockResolvedValue({
      posts: [makePost()],
      nextCursor: null,
      hasMore: false,
    });
    vi.mocked(api.deletePost).mockResolvedValue(undefined);

    renderList();

    // cancel the deletion and keep the post
    await openPostMenu(user);
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Delete this post?')).not.toBeInTheDocument();
    expect(api.deletePost).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: /Two Sum/ })).toBeInTheDocument();

    // confirm the deletion and remove the post
    await openPostMenu(user);
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.queryByText(/Two Sum/)).not.toBeInTheDocument();
    });

    expect(api.deletePost).toHaveBeenCalledWith('p1');
  });
});
