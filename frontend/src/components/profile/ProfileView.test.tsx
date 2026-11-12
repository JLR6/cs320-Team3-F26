import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { renderWithQuery } from '../../../test/render-with-query';
import { ProfileView } from './ProfileView';

const {
  authGetUser,
  getUser,
  getUserByUsername,
  getUserPosts,
  getFollowing,
  followUser,
  unfollowUser,
} = vi.hoisted(() => ({
  // control the logged-in user and every API call the profile makes
  authGetUser: vi.fn(),
  getUser: vi.fn(),
  getUserByUsername: vi.fn(),
  getUserPosts: vi.fn(),
  getFollowing: vi.fn(),
  followUser: vi.fn(),
  unfollowUser: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getUser: authGetUser } }),
}));
vi.mock('@/lib/api/users', () => ({ getUser, getUserByUsername }));
vi.mock('@/lib/api/profile-posts', () => ({ getUserPosts }));
vi.mock('@/lib/api/follows', () => ({
  getFollowing,
  followUser,
  unfollowUser,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Megana is logged in; Elizabeth is someone else, like the Figma frames
const MEGANA = {
  user_id: 'u1',
  username: 'Megana L.',
  leetcode_username: 'mling06',
};
const ELIZABETH = { user_id: 'u2', username: 'Elizabeth S.' };
const page = (posts: object[], nextCursor: string | null = null) => ({
  posts,
  nextCursor,
  hasMore: nextCursor !== null,
});
const post = (id: string) => ({
  id,
  author: { id: 'u2', username: 'Elizabeth S.' },
  problemNumber: 42,
  problemName: `Problem ${id}`,
  difficulty: 'Hard',
  description: 'Solved it',
  tags: [],
  likeCount: 0,
  comments: [],
  createdAt: null,
});

const loggedInAs = (id: string | null) =>
  authGetUser.mockResolvedValue({ data: { user: id ? { id } : null } });

describe('ProfileView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loggedInAs('u1');
    getUser.mockResolvedValue(MEGANA);
    getUserByUsername.mockResolvedValue(ELIZABETH);
    getUserPosts.mockResolvedValue(page([]));
    getFollowing.mockResolvedValue([]);
    followUser.mockResolvedValue(undefined);
    unfollowUser.mockResolvedValue(undefined);
  });

  // "Profile - Mine": your details, Settings, both tabs, no posts yet
  it('shows your own profile with Settings and both tabs', async () => {
    renderWithQuery(<ProfileView />);

    expect(
      await screen.findByRole('heading', { name: 'Megana L.' }),
    ).toBeInTheDocument();
    expect(getUser).toHaveBeenCalledWith('u1');
    expect(screen.getByText('mling06 on LeetCode')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Posts' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(await screen.findByText('0 Posts')).toBeInTheDocument();
    expect(screen.getByText('This account has no posts')).toBeInTheDocument();
  });

  // "Profile - Following": switching tabs shows the following list
  it('switches to the Following tab', async () => {
    renderWithQuery(<ProfileView />);

    await userEvent.click(
      await screen.findByRole('tab', { name: 'Following' }),
    );

    expect(screen.getByRole('tab', { name: 'Following' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      screen.getByPlaceholderText('Enter a username to follow'),
    ).toBeInTheDocument();
  });

  it('asks you to log in when nobody is logged in', async () => {
    loggedInAs(null);
    renderWithQuery(<ProfileView />);
    expect(await screen.findByRole('link', { name: 'Log in' })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(getUser).not.toHaveBeenCalled();
  });

  it('asks you to log in when checking who you are fails', async () => {
    authGetUser.mockRejectedValue(new Error('offline'));
    renderWithQuery(<ProfileView />);
    expect(
      await screen.findByRole('link', { name: 'Log in' }),
    ).toBeInTheDocument();
  });

  // "Profile - Other (not followed)": only a Posts tab and a Follow button
  it('follows someone from their profile', async () => {
    // after following, the reloaded list includes them
    getFollowing.mockResolvedValueOnce([]).mockResolvedValue([ELIZABETH]);
    getUserPosts.mockResolvedValue(page([post('p1')]));
    renderWithQuery(<ProfileView username="Elizabeth S." />);

    expect(await screen.findByText('1 Post')).toBeInTheDocument();
    expect(getUserByUsername).toHaveBeenCalledWith('Elizabeth S.');
    expect(screen.queryByRole('tab', { name: 'Following' })).toBeNull();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Follow' }),
    );

    expect(followUser).toHaveBeenCalledWith('u2');
    // "Profile - Other (followed)"
    expect(
      await screen.findByRole('button', { name: 'Following' }),
    ).toBeInTheDocument();
  });

  // clicking Following unfollows
  it('unfollows someone you already follow', async () => {
    getFollowing.mockResolvedValue([ELIZABETH]);
    renderWithQuery(<ProfileView username="Elizabeth S." />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Following' }),
    );
    await waitFor(() => expect(unfollowUser).toHaveBeenCalledWith('u2'));
  });

  it('tells you when following fails', async () => {
    followUser.mockRejectedValue(new Error('boom'));
    renderWithQuery(<ProfileView username="Elizabeth S." />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Follow' }),
    );
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Couldn't follow Elizabeth S."),
    );
  });

  it('tells you when unfollowing fails', async () => {
    getFollowing.mockResolvedValue([ELIZABETH]);
    unfollowUser.mockRejectedValue(new Error('boom'));
    renderWithQuery(<ProfileView username="Elizabeth S." />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Following' }),
    );
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Couldn't unfollow Elizabeth S.",
      ),
    );
  });

  // visiting your own username still counts as your profile
  it('treats your own username as your profile', async () => {
    getUserByUsername.mockResolvedValue(MEGANA);
    renderWithQuery(<ProfileView username="Megana L." />);
    expect(
      await screen.findByRole('link', { name: 'Settings' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Follow' })).toBeNull();
  });

  // logged-out visitors can look but get no follow button
  it('hides the follow button when logged out', async () => {
    loggedInAs(null);
    renderWithQuery(<ProfileView username="Elizabeth S." />);
    expect(
      await screen.findByRole('heading', { name: 'Elizabeth S.' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Follow' })).toBeNull();
    expect(getFollowing).not.toHaveBeenCalled();
  });

  // more than one page: "+" on the count, then Load more fetches the next page
  it('loads more posts with the next cursor', async () => {
    getUserPosts
      .mockResolvedValueOnce(page([post('p1')], 'c1'))
      .mockResolvedValueOnce(page([post('p2')]));
    renderWithQuery(<ProfileView username="Elizabeth S." />);

    expect(await screen.findByText('1+ Posts')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('2 Posts')).toBeInTheDocument();
    expect(getUserPosts).toHaveBeenLastCalledWith('u2', 'c1');
    expect(
      screen.getByRole('link', { name: '42. Problem p2' }),
    ).toBeInTheDocument();
  });

  it('says when the user does not exist', async () => {
    getUserByUsername.mockRejectedValue(new ApiError(404, 'Not found'));
    renderWithQuery(<ProfileView username="ghost" />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'User not found',
    );
  });

  it('shows an error when the profile fails to load', async () => {
    getUserByUsername.mockRejectedValue(new ApiError(500, 'boom'));
    renderWithQuery(<ProfileView username="Elizabeth S." />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't load this profile.",
    );
  });

  it('shows a loading line until the profile arrives', () => {
    getUserByUsername.mockReturnValue(new Promise(() => {})); // never resolves
    renderWithQuery(<ProfileView username="Elizabeth S." />);
    expect(screen.getByText('Loading profile...')).toBeInTheDocument();
  });
});
