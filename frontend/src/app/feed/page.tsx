'use client';

import { useQuery } from '@tanstack/react-query';
import { getUser } from '@/src/lib/api/users';

export function Welcome({ userId }: { userId: string }) {
  const { data } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => getUser(userId),
  });
  return <h1 className="text-2xl font-semibold">Welcome, {data?.username ?? '…'}</h1>;
}