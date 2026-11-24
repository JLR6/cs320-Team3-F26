import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileCard, type ProfileAction } from './ProfileCard';

const user = { user_id: 'u2', username: 'Elizabeth S.', profile_picture: null };

// render the card with sensible defaults; each test overrides what it checks
function renderCard(
  overrides: Partial<Parameters<typeof ProfileCard>[0]> & {
    action?: ProfileAction;
  } = {},
) {
  const onFollow = vi.fn();
  const onUnfollow = vi.fn();
  render(
    <ProfileCard
      user={user}
      postCount="1 Post"
      action="follow"
      onFollow={onFollow}
      onUnfollow={onUnfollow}
      {...overrides}
    />,
  );
  return { onFollow, onUnfollow };
}

describe('ProfileCard', () => {
  // the basics from the design: name, LeetCode status, post count, default picture
  it('shows the name, post count and "LeetCode not linked"', () => {
    renderCard();
    expect(
      screen.getByRole('heading', { name: 'Elizabeth S.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('LeetCode not linked')).toBeInTheDocument();
    expect(screen.getByText('1 Post')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: "Elizabeth S.'s profile picture" }),
    ).toBeInTheDocument();
  });

  // a linked account links to the LeetCode profile in a new tab
  it('links a LeetCode username to their LeetCode profile', () => {
    renderCard({ user: { ...user, leetcode_username: 'mling06' } });
    const link = screen.getByRole('link', { name: 'mling06 on LeetCode' });
    expect(link).toHaveAttribute('href', 'https://leetcode.com/u/mling06/');
    expect(link).toHaveAttribute('target', '_blank');
  });

  // a real picture URL is shown as an image
  it('shows the profile picture when there is one', () => {
    renderCard({
      user: { ...user, profile_picture: 'https://cdn.example/me.jpg' },
    });
    expect(
      screen.getByRole('img', { name: "Elizabeth S.'s profile picture" }),
    ).toHaveAttribute('src', 'https://cdn.example/me.jpg');
  });

  // not followed yet: the green Follow button follows
  it('Follow calls onFollow', async () => {
    const { onFollow, onUnfollow } = renderCard({ action: 'follow' });
    await userEvent.click(screen.getByRole('button', { name: 'Follow' }));
    expect(onFollow).toHaveBeenCalledOnce();
    expect(onUnfollow).not.toHaveBeenCalled();
  });

  // already followed: the Following button unfollows
  it('Following calls onUnfollow', async () => {
    const { onFollow, onUnfollow } = renderCard({ action: 'following' });
    await userEvent.click(screen.getByRole('button', { name: 'Following' }));
    expect(onUnfollow).toHaveBeenCalledOnce();
    expect(onFollow).not.toHaveBeenCalled();
  });

  // buttons are disabled while a request is in flight
  it('disables the button while busy', () => {
    renderCard({ action: 'follow', busy: true });
    expect(screen.getByRole('button', { name: 'Follow' })).toBeDisabled();
  });

  // your own profile links to settings instead
  it('shows a Settings link on your own profile', () => {
    renderCard({ action: 'settings' });
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/settings',
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  // logged out: no action button at all
  it('shows no button when there is no action', () => {
    renderCard({ action: 'none' });
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Settings' })).toBeNull();
  });
});
