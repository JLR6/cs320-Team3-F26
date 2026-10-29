'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DIFFICULTIES } from '@/lib/constants';
import { postFormSchema, type PostFormValues } from '@/lib/validation/post';
import type { Post, PostInput } from '@/types/post';

// One error message per field, e.g. { problemName: "Problem name is required." }
type FieldErrors = Partial<Record<keyof PostFormValues, string>>;

interface PostFormProps {
  initial?: Post; // pass a post to EDIT it, leave out to CREATE a new one
  onSubmit: (input: PostInput) => Promise<void> | void;
  onCancel?: () => void;
}

// Small helper: shows a field's error message (renders nothing if there isn't one).
function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-destructive">{message}</p> : null;
}

// One form for both creating and editing a post.
// The rules live in lib/post-schema.ts (zod). This file only holds the fields and shows errors.
export function PostForm({ initial, onSubmit, onCancel }: PostFormProps) {
  // Every field is plain text while typing. When editing, start with the post's current values.
  const [values, setValues] = useState<PostFormValues>({
    problemNumber: initial?.problemNumber.toString() ?? '',
    problemName: initial?.problemName ?? '',
    difficulty: initial?.difficulty ?? 'Easy',
    description: initial?.description ?? '',
    tags: initial?.tags.map((t) => `#${t}`).join(' ') ?? '',
    timeComplexity: initial?.timeComplexity ?? '',
    spaceComplexity: initial?.spaceComplexity ?? '',
    solutionUrl: initial?.solutionUrl ?? '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null); // error from saving (not a field)
  const [submitting, setSubmitting] = useState(false);

  // Update one field, and clear that field's error once the user starts fixing it.
  function setField<K extends keyof PostFormValues>(
    key: K,
    value: PostFormValues[K],
  ) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); // stop the browser's default page reload
    setFormError(null);

    // Check the text with zod. On success, result.data is a ready-to-save PostInput.
    const result = postFormSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof PostFormValues;
        if (!fieldErrors[field]) fieldErrors[field] = issue.message; // keep the first message per field
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    setSubmitting(true);
    try {
      await onSubmit(result.data);
    } catch {
      setFormError("Couldn't save your post. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // noValidate: turns off the browser's own popups so our zod messages are the only ones shown
  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* PROBLEM: number + name */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label htmlFor="problemNumber">Problem #</Label>
          <Input
            id="problemNumber"
            inputMode="numeric"
            value={values.problemNumber}
            onChange={(e) => setField('problemNumber', e.target.value)}
            aria-invalid={!!errors.problemNumber}
          />
          <FieldError message={errors.problemNumber} />
        </div>
        <div className="col-span-2 space-y-1">
          <Label htmlFor="problemName">Problem name</Label>
          <Input
            id="problemName"
            value={values.problemName}
            onChange={(e) => setField('problemName', e.target.value)}
            aria-invalid={!!errors.problemName}
          />
          <FieldError message={errors.problemName} />
        </div>
      </div>

      {/* DIFFICULTY */}
      <div className="space-y-1">
        <Label>Difficulty</Label>
        <Select
          value={values.difficulty}
          onValueChange={(v) =>
            setField('difficulty', v as PostFormValues['difficulty'])
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DIFFICULTIES.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* DESCRIPTION */}
      <div className="space-y-1">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          rows={4}
          value={values.description}
          onChange={(e) => setField('description', e.target.value)}
          aria-invalid={!!errors.description}
        />
        <FieldError message={errors.description} />
      </div>

      {/* TAGS: typed as text, split into a list by the schema */}
      <div className="space-y-1">
        <Label htmlFor="tags">Tags</Label>
        <Input
          id="tags"
          placeholder="#BFS #HashTable"
          value={values.tags}
          onChange={(e) => setField('tags', e.target.value)}
        />
      </div>

      {/* COMPLEXITY: time + space (optional) */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="time">Time complexity</Label>
          <Input
            id="time"
            placeholder="O(n)"
            value={values.timeComplexity}
            onChange={(e) => setField('timeComplexity', e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="space">Space complexity</Label>
          <Input
            id="space"
            placeholder="O(1)"
            value={values.spaceComplexity}
            onChange={(e) => setField('spaceComplexity', e.target.value)}
          />
        </div>
      </div>

      {/* SOLUTION LINK (optional) */}
      <div className="space-y-1">
        <Label htmlFor="url">LeetCode solution link (optional)</Label>
        <Input
          id="url"
          type="url"
          value={values.solutionUrl}
          onChange={(e) => setField('solutionUrl', e.target.value)}
          aria-invalid={!!errors.solutionUrl}
        />
        <FieldError message={errors.solutionUrl} />
      </div>

      {/* SAVE ERROR (not tied to one field) */}
      {formError && <p className="text-sm text-destructive">{formError}</p>}

      {/* BUTTONS */}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {initial ? 'Save changes' : 'Post'}
        </Button>
      </div>
    </form>
  );
}
