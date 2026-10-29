import { z } from 'zod';
import { DIFFICULTIES } from '../constants';
import { parseTags, isLeetCodeUrl } from '../post-utils';

// Rules for the create/edit post form.
//
// The form keeps everything as plain text, so this schema does two jobs:
//   1. CHECK the text (required fields, valid number, leetcode.com link...)
//   2. CONVERT it into a real PostInput (number, list of tags, no empty link)
// Each message below is shown right under its field.
export const postFormSchema = z.object({
  problemNumber: z
    .string()
    .trim()
    .regex(/^[1-9]\d*$/, 'Enter a valid problem number.') // whole number, 1 or more
    .transform(Number), // "42" -> 42

  problemName: z.string().trim().min(1, 'Problem name is required.'),

  difficulty: z.enum(DIFFICULTIES),

  description: z.string().trim().min(1, 'Add a short description.'),

  tags: z.string().transform(parseTags), // "#BFS #DP" -> ["BFS", "DP"]

  // Optional: an empty string is fine
  timeComplexity: z.string().trim(),
  spaceComplexity: z.string().trim(),

  // Optional: empty is fine, otherwise it must be a leetcode.com link
  solutionUrl: z
    .string()
    .trim()
    .refine(
      (url) => url === '' || isLeetCodeUrl(url),
      'Solution link should be a leetcode.com URL.',
    )
    .transform((url) => url || undefined), // "" -> undefined
});

// What the form fields hold while the user is typing (all text).
export type PostFormValues = z.input<typeof postFormSchema>;
