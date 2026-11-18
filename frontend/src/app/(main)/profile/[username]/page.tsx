import { ProfileView } from '@/components/profile/ProfileView';

// /profile/<username> -> anyone's profile, with a Follow / Following button.
// In this Next.js version params is a Promise, so the page awaits it.
export default async function UserProfilePage({
  params,
}: PageProps<'/profile/[username]'>) {
  const { username } = await params;
  return <ProfileView username={decodeURIComponent(username)} />;
}
