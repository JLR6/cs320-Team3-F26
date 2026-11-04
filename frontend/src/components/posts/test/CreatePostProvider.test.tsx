import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreatePostProvider, useCreatePost } from '../CreatePostProvider';
import * as api from '@/lib/posts-api';
import type { Post, PostInput } from '@/types/post';

// swap the real api for a fake so no data is really saved
vi.mock('@/lib/posts-api', () => ({ createPost: vi.fn() }));

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

// a stand-in for the sidebar button and the feed, both read from the provider
function TestPage() {
  const { postsVersion, openCreate } = useCreatePost();
  return (
    <div>
      <p>posts version: {postsVersion}</p>
      <button onClick={openCreate}>create post</button>
    </div>
  );
}

function renderPage() {
  render(
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

  it('shows the page inside it', () => {
    renderPage();
    expect(screen.getByText('create post')).toBeTruthy();
  });

  it('keeps the dialog closed until someone asks for it', () => {
    renderPage();
    expect(screen.queryByText('create post dialog')).toBeNull();
  });

  it('opens the dialog when create post is clicked', () => {
    renderPage();
    clickCreatePost();
    expect(screen.getByText('create post dialog')).toBeTruthy();
  });

  it('saves the post and tells the feeds to reload', async () => {
    vi.mocked(api.createPost).mockResolvedValue({} as Post);
    renderPage();
    expect(screen.getByText('posts version: 0')).toBeTruthy();

    clickCreatePost();
    clickSubmit();

    // the version goes up once the save finishes
    await waitFor(() =>
      expect(screen.getByText('posts version: 1')).toBeTruthy(),
    );
    expect(api.createPost).toHaveBeenCalledTimes(1);
  });

  it('does not reload the feeds when saving fails', async () => {
    vi.mocked(api.createPost).mockRejectedValue(new Error('save failed'));
    renderPage();

    clickCreatePost();
    clickSubmit();

    // wait until the save was tried, then check the version never moved
    await waitFor(() => expect(api.createPost).toHaveBeenCalledTimes(1));
    expect(screen.getByText('posts version: 0')).toBeTruthy();
  });

  it('throws an error if used outside the provider', () => {
    // react logs the expected error, so hide it to keep the output clean
    const hideErrors = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestPage />)).toThrow();
    hideErrors.mockRestore();
  });
});
