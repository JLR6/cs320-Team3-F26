import * as React from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import {
  getUser,
  getUserByUsername,
  getProfilePictureUrl,
  updateUser,
  updateProfilePicture,
  deleteUser,
} from '@/lib/api/users';

export function useUser() {
  const [authUser, setAuthUser] = React.useState<User | null>(null);
  // const [dbUser, setDbUser] = React.useState<any | null>(null);

  React.useEffect(() => {
    const supabase = createClient();
    // const getDbUser = async (username: string) => {
    //   const response = await getUserByUsername(username);
    //   setDbUser(response);
    // };
    // const getUser = (user: User | null) => {
    //   setAuthUser(user);

    //   if (user?.user_metadata?.username) {
    //     getDbUser(user.user_metadata.username);
    //   } else {
    //     setDbUser(null);
    //   }
    // };

    supabase.auth.getUser().then(({ data }) => {
      setAuthUser(data.user);
      // getUser(data.user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
      // getUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return authUser;
  // return { authUser, dbUser };
}
