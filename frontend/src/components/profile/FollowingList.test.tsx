import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { renderWithQuery } from '../../../test/render-with-query';
import { FollowingList } from './FollowingList';

const { getFollowing, followUser, unfollowUser, getUserByUsername } =
  vi.hoisted(() => ({
    // control every API call the Following tab makes
    getFollowing: vi.fn(),
    followUser: vi.fn(),
    unfollowUser: vi.fn(),
    getUserByUsername: vi.fn(),
  }));

vi.mock('@/lib/api/follows', () => ({
  getFollowing,
  followUser,
  unfollowUser,
}));
vi.mock('@/lib/api/users', () => ({ getUserByUsername }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// the three people from the Figma frame
const ELIZABETH = {
  user_id: 'u2',
  username: 'Elizabeth S.',
  last_posted_at: new Date(Date.now() - 3 * 3_600_000).toISOString(),
};
const LEON = { user_id: 'u3', username: 'Leon L.', last_posted_at: null };

const input = () => screen.getByPlaceholderText('Enter a username to follow');
const followButton = () => screen.getByRole('button', { name: 'Follow' });

describe('FollowingList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getFollowing.mockResolvedValue([ELIZABETH, LEON]);
  });

  // each row links to their profile and says when they last posted
  it('lists who you follow', async () => {
    renderWithQuery(<FollowingList meId="u1" />);

    expect(
      await screen.findByRole('link', { name: 'Elizabeth S.' }),
    ).toHaveAttribute('href', '/profile/Elizabeth%20S.');
    expect(screen.getByText('Posted 3h ago')).toBeInTheDocument();
    expect(screen.getByText('No posts')).toBeInTheDocument();
    expect(getFollowing).toHaveBeenCalledWith('u1');
  });

  it('shows a loading line first', () => {
    getFollowing.mockReturnValue(new Promise(() => {})); // never resolves
    renderWithQuery(<FollowingList meId="u1" />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('explains how to follow people when the list is empty', async () => {
    getFollowing.mockResolvedValue([]);
    renderWithQuery(<FollowingList meId="u1" />);
    expect(
      await screen.findByText(/aren't following anyone yet/),
    ).toBeInTheDocument();
  });

  it('shows an error when the list fails to load', async () => {
    getFollowing.mockRejectedValue(new Error('down'));
    renderWithQuery(<FollowingList meId="u1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't load who you follow",
    );
  });

  // the Follow button stays disabled until a username is typed
  it('disables Follow while the box is empty', async () => {
    renderWithQuery(<FollowingList meId="u1" />);
    expect(followButton()).toBeDisabled();
    await userEvent.type(input(), '   ');
    expect(followButton()).toBeDisabled();
  });

  // happy path from the "Add following" frame
  it('follows someone by username', async () => {
    getUserByUsername.mockResolvedValue({
      user_id: 'u5',
      username: 'Arjya M.',
    });
    followUser.mockResolvedValue(undefined);
    renderWithQuery(<FollowingList meId="u1" />);
    await screen.findByText('Leon L.');

    await userEvent.type(input(), ' Arjya M. ');
    await userEvent.click(followButton());

    await waitFor(() => expect(followUser).toHaveBeenCalledWith('u5'));
    expect(getUserByUsername).toHaveBeenCalledWith('Arjya M.');
    expect(toast.success).toHaveBeenCalledWith('Following Arjya M.');
    await waitFor(() => expect(input()).toHaveValue(''));
    // the list reloads so the new person shows up
    await waitFor(() => expect(getFollowing).toHaveBeenCalledTimes(2));
  });

  // unknown usernames get a clear message, which clears when typing again
  it('says when no user has that name', async () => {
    getUserByUsername.mockRejectedValue(new ApiError(404, 'Not found'));
    renderWithQuery(<FollowingList meId="u1" />);

    await userEvent.type(input(), 'nobody');
    await userEvent.click(followButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No user named "nobody"',
    );
    expect(followUser).not.toHaveBeenCalled();

    await userEvent.type(input(), 'x');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  // any other failure gets a retry message
  it('shows a general error when following fails', async () => {
    getUserByUsername.mockResolvedValue({
      user_id: 'u5',
      username: 'Arjya M.',
    });
    followUser.mockRejectedValue(new ApiError(500, 'boom'));
    renderWithQuery(<FollowingList meId="u1" />);
    await screen.findByText('Leon L.');

    await userEvent.type(input(), 'Arjya M.');
    await userEvent.click(followButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't follow that user",
    );
  });

  it("won't follow yourself", async () => {
    getUserByUsername.mockResolvedValue({
      user_id: 'u1',
      username: 'Megana L.',
    });
    renderWithQuery(<FollowingList meId="u1" />);

    await userEvent.type(input(), 'Megana L.');
    await userEvent.click(followButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "You can't follow yourself",
    );
    expect(followUser).not.toHaveBeenCalled();
  });

  it("won't follow someone twice", async () => {
    getUserByUsername.mockResolvedValue({
      user_id: 'u2',
      username: 'Elizabeth S.',
    });
    renderWithQuery(<FollowingList meId="u1" />);
    await screen.findByText('Leon L.');

    await userEvent.type(input(), 'Elizabeth S.');
    await userEvent.click(followButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You already follow Elizabeth S.',
    );
    expect(followUser).not.toHaveBeenCalled();
  });

  // Unfollow removes them and reloads the list
  it('unfollows someone', async () => {
    unfollowUser.mockResolvedValue(undefined);
    renderWithQuery(<FollowingList meId="u1" />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Unfollow Leon L.' }),
    );

    await waitFor(() => expect(unfollowUser).toHaveBeenCalledWith('u3'));
    await waitFor(() => expect(getFollowing).toHaveBeenCalledTimes(2));
  });

  it('tells you when unfollowing fails', async () => {
    unfollowUser.mockRejectedValue(new Error('boom'));
    renderWithQuery(<FollowingList meId="u1" />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Unfollow Leon L.' }),
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Couldn't unfollow Leon L."),
    );
  });
});
