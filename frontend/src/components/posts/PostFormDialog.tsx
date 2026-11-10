'use client';
import { useEffect, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { errorMessage } from '@/lib/utils';
import { postFormSchema, type PostFormValues } from '@/lib/validation/post';
import { z } from 'zod';
import type { Post, PostInput } from '@/types/post';

const empty: PostFormValues = {
  problemNumber: '',
  problemName: 'unknown',
  difficulty: 'Easy',
  solutionUrl: '',
  description: '',
  tags: '',
  timeComplexity: '',
  spaceComplexity: 'unknown',
};

// Post -> form values (for editing)
const toForm = (p: Post): PostFormValues => ({
  problemNumber: String(p.problem.number),
  problemName: p.problem.title,
  difficulty: p.problem.difficulty ?? 'Easy',
  solutionUrl: p.solution,
  description: p.description,
  tags: p.problem.tags.map((tag) => `#${tag}`).join(' '),
  timeComplexity: p.timeComplexity,
  spaceComplexity: 'unknown',
});

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post?: Post;
  onSubmit: (input: PostInput) => Promise<void>;
};

// Create form (no `post`) or edit form (with `post`)
export function PostFormDialog({ open, onOpenChange, post, onSubmit }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PostFormValues, undefined, z.output<typeof postFormSchema>>({
    resolver: zodResolver(postFormSchema),
    defaultValues: empty,
  });

  // Fill the form each time it opens
  useEffect(() => {
    if (open) reset(post ? toForm(post) : empty);
  }, [open, post, reset]);

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit({
        problemNumber: Number(values.problemNumber),
        description: values.description,
        solutionUrl: values.solutionUrl ?? '',
        timeComplexity: values.timeComplexity,
      });
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't save the post"));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{post ? 'Edit Post' : 'Create New Post'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field
            label="LeetCode Problem Number"
            error={errors.problemNumber?.message}
          >
            <Input
              inputMode="numeric"
              placeholder="1"
              {...register('problemNumber')}
            />
          </Field>
          <Field
            label="LeetCode Solution Link"
            error={errors.solutionUrl?.message}
          >
            <Input
              placeholder="https://leetcode.com/problems/two-sum/solutions/..."
              {...register('solutionUrl')}
            />
          </Field>
          <Field label="Description" error={errors.description?.message}>
            <Textarea rows={4} {...register('description')} />
          </Field>
          <Field label="Time Complexity" error={errors.timeComplexity?.message}>
            <Input placeholder="O(n)" {...register('timeComplexity')} />
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {post ? 'Save' : 'Post'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
