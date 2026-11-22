import { createClient } from '@/lib/supabase/client';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// send the session token so the api can verify the caller
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const { data } = await createClient().auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (typeof init.body === 'string')
    headers.set('Content-Type', 'application/json');

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}${path}`, {
    ...init,
    headers,
  });
  if (!res.ok) throw new ApiError(res.status, await readError(res));
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

// Nest sends errors as JSON like { message: 'Comment not found' }, where message
// can also be a list (validation errors). Fall back to the raw text otherwise.
async function readError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const { message } = JSON.parse(text);
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
  } catch {
    // not JSON, use the text as is
  }
  return text || `Request failed (${res.status})`;
}
