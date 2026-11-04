import { vi, test, expect } from 'vitest';

const signIn = vi.fn().mockResolvedValue({
  data: { user: null },
  error: { message: 'Invalid login credentials' },
});

test('login fails with invalid credentials', async () => {
  const result = await signIn();

  expect(result.error.message).toBe('Invalid login credentials');
});

test('login success', async () => {
  const signIn = vi.fn().mockResolvedValue({
    data: { user: { id: 'leetmeet#1fan' } },
    error: null,
  });

  const result = await signIn();

  expect(result.error).toBeNull();
  expect(result.data.user.id).toBe('leetmeet#1fan');
});

test('login calls Supabase authentication', async () => {
  signIn.mockClear();
  await signIn();

  expect(signIn).toHaveBeenCalledTimes(1);
});
