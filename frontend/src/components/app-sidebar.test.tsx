import { describe, it, expect, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './app-sidebar';
import { useUser } from '@/hooks/use-user';
import { getProfilePictureUrl } from '@/lib/api/users';
import { apiFetch } from '@/lib/api/client';
import userEvent from '@testing-library/user-event';

// test data
const testAuthUser = {
  id: '111-111',
  aud: 'authenticated',
  created_at: '00:00:00',
  user_metadata: { username: 'testuser' },
  app_metadata: {},
};

// mocking necessary hooks and api calls
vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/hooks/use-user', () => ({
  useUser: vi.fn(),
}));
const mockedUseUser = vi.mocked(useUser);

vi.mock('@/lib/api/client', () => ({
  apiFetch: vi.fn(),
}));
const mockedApiFetch = vi.mocked(apiFetch);

vi.mock('@/lib/api/users', () => ({
  getProfilePictureUrl: vi.fn(),
}));
const mockedGetProfilePictureUrl = vi.mocked(getProfilePictureUrl);

describe('AppSidebar', () => {
  it('does not refetch sidebar data after a render', async () => {
    mockedUseUser.mockReturnValue(testAuthUser);
    mockedApiFetch.mockClear().mockResolvedValue([]);
    mockedGetProfilePictureUrl.mockClear().mockResolvedValue('');
    const sidebar = (
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>
    );
    const { rerender } = render(sidebar);
    await waitFor(() => expect(mockedApiFetch).toHaveBeenCalled());
    await act(async () => {});
    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
    expect(mockedGetProfilePictureUrl).toHaveBeenCalledTimes(1);
    rerender(
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>,
    );
    await act(async () => {});
    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
    expect(mockedGetProfilePictureUrl).toHaveBeenCalledTimes(1);
  });

  it('keeps the sidebar usable when its requests fail', async () => {
    mockedUseUser.mockReturnValue(testAuthUser);
    mockedApiFetch.mockRejectedValue(new TypeError('Failed to fetch'));
    mockedGetProfilePictureUrl.mockRejectedValue(
      new TypeError('Failed to fetch'),
    );
    render(
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>,
    );
    await act(async () => {});
    expect(screen.getByRole('link', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      'https://assets.leetcode.com/users/default_avatar.jpg',
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Could not load sidebar data. Please refresh to try again.',
    );
  });

  it('renders the logged out state', () => {
    // mocking the logged out state and rendering
    mockedUseUser.mockReturnValue(null);
    render(
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>,
    );

    // logo
    const logo = screen.getByRole('link', { name: 'LeetMeet' });
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute('href', '/');

    // home
    const home = screen.getByRole('link', { name: 'Home' });
    expect(home).toBeInTheDocument();
    expect(home).toHaveAttribute('href', '/');

    // sign up
    const signUp = screen.getByRole('link', { name: 'Sign up' });
    expect(signUp).toBeInTheDocument();
    expect(signUp).toHaveAttribute('href', '/signup');

    // log in
    const logIn = screen.getByRole('link', { name: 'Log in' });
    expect(logIn).toBeInTheDocument();
    expect(logIn).toHaveAttribute('href', '/login');

    // only those links
    expect(screen.getAllByRole('link').length).toEqual(4);
  });

  // helper function that verifies the constants in the logged in state
  async function expectLoggedInSidebar(username: string) {
    const logo = screen.getByRole('link', { name: 'LeetMeet' });
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute('href', '/');

    // home
    const home = screen.getByRole('link', { name: 'Home' });
    expect(home).toBeInTheDocument();
    expect(home).toHaveAttribute('href', '/');

    // profile
    const profile = screen.getByRole('link', { name: 'Profile' });
    expect(profile).toBeInTheDocument();
    expect(profile).toHaveAttribute('href', `/profile/${username}`);

    // create post
    const newPost = screen.getByRole('button', { name: 'New Post' });
    expect(newPost).toBeInTheDocument();

    // footer
    expect(screen.getByText(username)).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByText('Sign out'));
    await user.click(screen.getByRole('button', { name: 'More' }));
  }

  it('renders the logged in state (no families or pfp)', async () => {
    // mocking the logged in state and rendering
    mockedUseUser.mockReturnValue(testAuthUser);
    mockedApiFetch.mockResolvedValue([]);
    mockedGetProfilePictureUrl.mockResolvedValue('');
    render(
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>,
    );

    await expectLoggedInSidebar(testAuthUser.user_metadata.username);

    // default pfp
    expect(await screen.findByRole('img')).toHaveAttribute(
      'src',
      'https://assets.leetcode.com/users/default_avatar.jpg',
    );

    // no families or other links
    expect((await screen.findAllByRole('link')).length).toEqual(3);
  });

  it('renders the logged in state (families)', async () => {
    // mocking the logged in state and rendering
    mockedUseUser.mockReturnValue(testAuthUser);
    mockedApiFetch.mockResolvedValue([
      { name: 'aaa-AAA' },
      { name: 'BBB-bbb' },
    ]);
    mockedGetProfilePictureUrl.mockResolvedValue('');
    render(
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>,
    );

    await expectLoggedInSidebar(testAuthUser.user_metadata.username);

    // linked families
    const familyA = await screen.findByRole('link', { name: 'aaa-AAA' });
    expect(familyA).toBeInTheDocument();

    const familyB = await screen.findByRole('link', { name: 'BBB-bbb' });
    expect(familyB).toBeInTheDocument();

    // no other links
    expect((await screen.findAllByRole('link')).length).toEqual(5);
  });

  it('renders the logged in state (pfp)', async () => {
    // mocking the logged in state and rendering
    mockedUseUser.mockReturnValue(testAuthUser);
    mockedApiFetch.mockResolvedValue([]);
    mockedGetProfilePictureUrl.mockResolvedValue(
      'localhost:3000/this_is_a_fake_url',
    );
    render(
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>,
    );

    await expectLoggedInSidebar(testAuthUser.user_metadata.username);

    // specified pfp
    expect(await screen.findByRole('img')).toHaveAttribute(
      'src',
      'localhost:3000/this_is_a_fake_url',
    );
  });
});
