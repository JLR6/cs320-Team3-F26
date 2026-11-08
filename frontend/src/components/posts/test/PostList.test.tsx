import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PostList } from '../PostList';
import * as api from '@/lib/posts-api';
import { fillPostForm, makePost } from '@/lib/test-utils';

vi.mock('@/lib/posts-api');

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

    vi.mocked(api.getPosts).mockResolvedValue([makePost()]);
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

  // this basically runs for each item like an object almost
  it.each([
    ['main', 'No posts yet.'],
    ['following', 'Go follow people to see their posts here.'],
  ] as const)(
    'shows the empty message for the %s feed',
    async (feed, message) => {
      vi.mocked(api.getPosts).mockResolvedValue([]);

      // while generally not worth testing since these files need to be covered, we need to go through with render tests as well
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

    vi.mocked(api.getPosts).mockResolvedValue([]);
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
      expect(await screen.findByText(/Add Two Numbers/)).toBeInTheDocument();
    } else {
      expect(screen.queryByText(/Add Two Numbers/)).not.toBeInTheDocument();
    }
  });

  it('edits a post', async () => {
    const user = userEvent.setup();

    vi.mocked(api.getPosts).mockResolvedValue([makePost()]);
    vi.mocked(api.updatePost).mockResolvedValue(
      makePost({ problemName: 'Three Sum' }),
    );

    renderList();

    await openPostMenu(user);
    // the /edit/i thing means a regex when in slashes, and the i just means capitalization doesn't matter
    await user.click(await screen.findByRole('menuitem', { name: /edit/i }));

    const name = await screen.findByLabelText('Problem name');

    await user.clear(name);
    await user.type(name, 'Three Sum');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText(/Three Sum/)).toBeInTheDocument();

    expect(api.updatePost).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ problemName: 'Three Sum' }),
    );
  });

  it('keeps a post when cancelled and removes it when deleted', async () => {
    const user = userEvent.setup();

    vi.mocked(api.getPosts).mockResolvedValue([makePost()]);
    vi.mocked(api.deletePost).mockResolvedValue(undefined);

    renderList();

    // Cancel deletion.
    await openPostMenu(user);
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Delete this post?')).not.toBeInTheDocument();
    expect(api.deletePost).not.toHaveBeenCalled();
    expect(screen.getByText(/Two Sum/)).toBeInTheDocument();

    // Confirm deletion.
    await openPostMenu(user);
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.queryByText(/Two Sum/)).not.toBeInTheDocument();
    });

    expect(api.deletePost).toHaveBeenCalledWith('p1');
  });
});
