import { z } from 'zod';

export const signupSchema = z
  .object({
    email: z.email('Enter a valid email address'),
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .max(20, 'Username must be 20 characters or fewer')
      .regex(
        /^[a-zA-Z0-9_-]+$/,
        'Use only letters, numbers, underscores, and hyphens',
      ),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    // allow an empty optional name
    leetcodeUsername: z
      .string()
      .trim()
      .max(40, 'That username is too long')
      .regex(
        /^[a-zA-Z0-9_-]*$/,
        'Use only letters, numbers, underscores, and hyphens',
      )
      .optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

export const passResetSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type LoginValues = z.infer<typeof loginSchema>;

export type SignupValues = z.infer<typeof signupSchema>;

export type PassResetValues = z.infer<typeof passResetSchema>;
