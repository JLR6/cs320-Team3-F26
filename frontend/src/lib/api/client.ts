import { createClient } from '@/src/lib/supabase/client';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Sends the logged-in user's Supabase token so the backend knows who is asking.
// Reading the token here is fine: the backend is the one that verifies it.
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await createClient().auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (typeof init.body === 'string') headers.set('Content-Type', 'application/json');

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, { ...init, headers });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}