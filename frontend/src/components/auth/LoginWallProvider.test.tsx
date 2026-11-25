import { describe, it, expect, vi } from 'vitest';
import { render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LikeButton } from '@/components/posts/LikeButton';
import { LoginWallProvider, useLoginWall } from './LoginWallProvider';

const MESSAGE = 'Sign up or log in now to access all features';

describe('LoginWallProvider', () => {
  // without a provider there is nothing to open, so callers can fall back
  it('useLoginWall returns null outside the provider', () => {
    const { result } = renderHook(() => useLoginWall());
    expect(result.current).toBeNull();
  });

  // a logged-out like opens the popup instead of liking
  it('opens the login wall when a logged-out visitor clicks like', async () => {
    const onLike = vi.fn();
    render(
      <LoginWallProvider>
        <LikeButton count={3} liked={false} disabled onClick={onLike} />
      </LoginWallProvider>,
    );

    expect(screen.queryByText(MESSAGE)).toBeNull();
    const like = screen.getByRole('button', { name: '3' });
    expect(like).toBeEnabled();
    expect(like).toHaveAttribute('title', 'Log in to like');

    await userEvent.click(like);

    expect(await screen.findByText(MESSAGE)).toBeInTheDocument();
    expect(onLike).not.toHaveBeenCalled();
  });

  // logged in: the like works as normal and no popup appears
  it('likes normally when logged in', async () => {
    const onLike = vi.fn();
    render(
      <LoginWallProvider>
        <LikeButton count={3} liked={false} onClick={onLike} />
      </LoginWallProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: '3' }));

    expect(onLike).toHaveBeenCalledOnce();
    expect(screen.queryByText(MESSAGE)).toBeNull();
  });

  // any component can open it through the hook
  it('can be opened from any component with useLoginWall', async () => {
    function FollowButton() {
      const loginWall = useLoginWall();
      return (
        <button type="button" onClick={() => loginWall?.openLoginWall()}>
          Follow
        </button>
      );
    }
    render(
      <LoginWallProvider>
        <FollowButton />
      </LoginWallProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Follow' }));
    expect(await screen.findByText(MESSAGE)).toBeInTheDocument();
  });
});
