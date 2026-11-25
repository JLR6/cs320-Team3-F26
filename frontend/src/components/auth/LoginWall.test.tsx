import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginWall } from './LoginWall';

// A plain <a> stands in for next/link so clicking it doesn't need a Next.js router.
vi.mock('next/link', () => ({
  default: ({
    href,
    onClick,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault(); // jsdom can't navigate
        onClick?.(event);
      }}
      {...rest}
    >
      {children}
    </a>
  ),
}));

describe('LoginWall', () => {
  // nothing on screen until something opens it
  it('renders nothing while closed', () => {
    render(<LoginWall open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  // the content from the Figma "Login wall" frame
  it('shows the title, message and both options', () => {
    render(<LoginWall open onOpenChange={vi.fn()} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('LeetMeet')).toBeInTheDocument();
    expect(
      screen.getByText('Sign up or log in now to access all features'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute(
      'href',
      '/signup',
    );
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  // picking an option closes the popup so it isn't still open on the next page
  it.each(['Sign up', 'Log in'])('closes when %s is clicked', async (name) => {
    const onOpenChange = vi.fn();
    render(<LoginWall open onOpenChange={onOpenChange} />);

    await userEvent.click(screen.getByRole('link', { name }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // the ✕ in the corner closes it too
  it('closes with the close button', async () => {
    const onOpenChange = vi.fn();
    render(<LoginWall open onOpenChange={onOpenChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onOpenChange).toHaveBeenCalled();
    expect(onOpenChange.mock.calls[0][0]).toBe(false);
  });
});
