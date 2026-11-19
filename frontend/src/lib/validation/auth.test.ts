import { describe, it, expect } from 'vitest';
import { signupSchema } from './auth';

// to test, spread operator on this object and replace individual fields with test values
const valid = {
  email: 'alex@example.com',
  username: 'alex_dev',
  password: 'password123',
  confirmPassword: 'password123',
  leetcodeUsername: '',
};

describe('email validation', () => {
  it('rejects an invalid email', () => {
    // spread operator on valid and replace with email here
    expect(signupSchema.safeParse({ ...valid, email: 'nope' }).success).toBe(
      false,
    );
  });
});

describe('username validation', () => {
  it('accepts a valid username', () => {
    expect(
      signupSchema.safeParse({ ...valid, username: 'valid_username' }).success,
    ).toBe(true);
    expect(
      signupSchema.safeParse({ ...valid, username: 'valid-username' }).success,
    ).toBe(true);
  });
  it('rejects a username that is too short', () => {
    expect(signupSchema.safeParse({ ...valid, username: 'ab' }).success).toBe(
      false,
    );
  });

  it('rejects a username with invalid characters', () => {
    expect(
      signupSchema.safeParse({ ...valid, username: 'bad name!' }).success,
    ).toBe(false);
    expect(
      signupSchema.safeParse({ ...valid, username: 'bad\\name' }).success,
    ).toBe(false);
    expect(
      signupSchema.safeParse({ ...valid, username: 'bad.name' }).success,
    ).toBe(false);
  });
});

describe('leetcodeUsername validation', () => {
  it('accepts an empty LeetCode username', () => {
    expect(
      signupSchema.safeParse({ ...valid, leetcodeUsername: '' }).success,
    ).toBe(true);
  });

  it('accepts a valid LeetCode username', () => {
    expect(
      signupSchema.safeParse({ ...valid, leetcodeUsername: 'valid_user' })
        .success,
    ).toBe(true);
  });

  it('rejects a LeetCode username with invalid characters', () => {
    expect(
      signupSchema.safeParse({ ...valid, leetcodeUsername: 'bad name!' })
        .success,
    ).toBe(false);
    expect(
      signupSchema.safeParse({ ...valid, leetcodeUsername: 'bad\\name' })
        .success,
    ).toBe(false);
    expect(
      signupSchema.safeParse({ ...valid, leetcodeUsername: 'bad.name' })
        .success,
    ).toBe(false);
  });
});

describe('password validation', () => {
  it('accepts a valid password', () => {
    expect(
      signupSchema.safeParse({
        ...valid,
        password: 'validPassword123',
        confirmPassword: 'validPassword123',
      }).success,
    ).toBe(true);
  });

  it('rejects a password that is too short', () => {
    expect(
      signupSchema.safeParse({
        ...valid,
        password: 'short',
        confirmPassword: 'short',
      }).success,
    ).toBe(false);
  });

  expect(
    signupSchema.safeParse({
      ...valid,
      password: '',
      confirmPassword: '',
    }).success,
  ).toBe(false);

  it('rejects mismatched passwords and flags the confirm field', () => {
    const result = signupSchema.safeParse({
      ...valid,
      confirmPassword: 'different123',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['confirmPassword']);
    }
  });
});
