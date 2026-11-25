import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useQuery } from '@tanstack/react-query';
import { CreatePostProvider, useCreatePost } from '../CreatePostProvider';
import * as api from '@/lib/posts/posts-api';
import { postKeys } from '@/hooks/use-posts';
import { renderWithQuery } from '@/lib/test-utils';
import type { Post, PostInput } from '@/types/post';

// swap the real api for a fake so no data is really saved
vi.mock('@/lib/posts/posts-api', () => ({ createPost: vi.fn() }));

// swap the real dialog for a simple fake
// the path is relative to this test file, so it needs the ../
// the fake only shows up while open is true, and its button submits the form
vi.mock('../PostFormDialog', () => ({
  PostFormDialog: ({
    open,
    onSubmit,
  }: {
    open: boolean;
    onSubmit: (input: PostInput) => Promise<void>;
  }) =>
    open ? (
      <div>
        <p>create post dialog</p>
        <button onClick={() => onSubmit({} as PostInput).catch(() => {})}>
          submit post
        </button>
      </div>
    ) : null,
}));

// counts how many times the "feed" was loaded, so we can see it reload
const loadFeed = vi.fn(async () => []);

// a stand-in for the sidebar button and the feed
function TestPage() {
  const { openCreate } = useCreatePost();
  useQuery({ queryKey: postKeys.feed('main'), queryFn: loadFeed });
  return <button onClick={openCreate}>create post</button>;
}

function renderPage() {
  renderWithQuery(
    <CreatePostProvider>
      <TestPage />
    </CreatePostProvider>,
  );
}

// the steps a user would take
const clickCreatePost = () => fireEvent.click(screen.getByText('create post'));
const clickSubmit = () => fireEvent.click(screen.getByText('submit post'));

describe('CreatePostProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  // shows the page inside it
  it('shows the page inside it', () => {
    renderPage();
    expect(screen.getByText('create post')).toBeTruthy();
  });
  // keeps the dialog closed until someone asks for it
  it('keeps the dialog closed until someone asks for it', () => {
    renderPage();
    expect(screen.queryByText('create post dialog')).toBeNull();
  });
  // opens the dialog when create post is clicked
  it('opens the dialog when create post is clicked', () => {
    renderPage();
    clickCreatePost();
    expect(screen.getByText('create post dialog')).toBeTruthy();
  });
  // saves the post and tells the feeds to reload
  it('saves the post and tells the feeds to reload', async () => {
    vi.mocked(api.createPost).mockResolvedValue({} as Post);
    renderPage();
    await waitFor(() => expect(loadFeed).toHaveBeenCalledTimes(1));

    clickCreatePost();
    clickSubmit();

    // the feed loads again once the save finishes
    await waitFor(() => expect(loadFeed).toHaveBeenCalledTimes(2));
    expect(api.createPost).toHaveBeenCalledTimes(1);
  });
  // does not reload the feeds when saving fails
  it('does not reload the feeds when saving fails', async () => {
    vi.mocked(api.createPost).mockRejectedValue(new Error('save failed'));
    renderPage();
    await waitFor(() => expect(loadFeed).toHaveBeenCalledTimes(1));

    clickCreatePost();
    clickSubmit();

    // wait until the save was tried, then check the feed never reloaded
    await waitFor(() => expect(api.createPost).toHaveBeenCalledTimes(1));
    expect(loadFeed).toHaveBeenCalledTimes(1);
  });
  // throws an error if used outside the provider
  it('throws an error if used outside the provider', () => {
    // react logs the expected error, so hide it to keep the output clean
    const hideErrors = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestPage />)).toThrow();
    hideErrors.mockRestore();
  });
});
