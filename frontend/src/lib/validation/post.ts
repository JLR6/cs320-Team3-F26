import { z } from 'zod';
import { DIFFICULTIES } from '../constants';
import { parseTags, isLeetCodeUrl } from '../posts/post-utils';

// Rules for the create/edit post form.
//
// The form keeps everything as plain text, so this schema does two jobs:
//   1. CHECK the text (required fields, valid number, leetcode.com link...)
//   2. CONVERT it into a real PostInput (number, list of tags, no empty link)
// Each message below is shown right under its field.
// Validation rules for the post form (every field is a string to keep the form simple)
export const postFormSchema = z.object({
  problemNumber: z
    .string()
    .trim()
    .regex(/^[1-9]\d*$/, 'Enter a number greater than 0')
    .transform(Number),
  problemName: z.string().trim().min(1, 'Enter the problem name'),
  difficulty: z.enum(DIFFICULTIES),
  solutionUrl: z
    .string()
    .trim()
    .transform((url) => (url === '' ? undefined : url))
    .refine(
      (url) => url === undefined || isLeetCodeUrl(url),
      'Solution link should be a leetcode.com URL.',
    ),
  description: z
    .string()
    .trim()
    .min(1, 'Add a description')
    .max(1000, 'Max 1000 characters'),
  tags: z.string().transform(parseTags), // comma separated, like "Array, Hash Table"
  timeComplexity: z.string().trim(),
  spaceComplexity: z.string().trim(),
});

export type PostFormValues = z.input<typeof postFormSchema>;
