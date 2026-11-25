'use client';

import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// Shared look for the two full-width pill buttons (from the Figma "Login wall" frame)
const PILL = 'h-[39px] w-full rounded-[20px] text-base font-bold';

// The "Sign up or log in" popup shown when a logged-out visitor tries to do
// something that needs an account (like a post, follow someone, ...).
export function LoginWall({ open, onOpenChange }: Props) {
  // close the popup when they pick an option, so it isn't still open on the next page
  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 rounded-[15px] px-6 pt-16 pb-16 text-center shadow-[0_0_20px_rgba(0,0,0,0.1)] ring-0 sm:max-w-[600px]">
        {/* same wordmark style as the sidebar until we have a logo */}
        <DialogTitle className="text-[32px] leading-tight font-medium">
          LeetMeet
        </DialogTitle>
        <DialogDescription className="mt-2 text-xl text-foreground">
          Sign up or log in now to access all features
        </DialogDescription>

        <div className="mx-auto mt-7 flex w-full max-w-[415px] flex-col gap-2">
          <Link
            href="/signup"
            onClick={close}
            className={cn(
              buttonVariants(),
              PILL,
              'bg-primary text-primary-foreground hover:bg-primary/90',
            )}
          >
            Sign up
          </Link>
          <Link
            href="/login"
            onClick={close}
            className={cn(
              buttonVariants({ variant: 'secondary' }),
              PILL,
              'text-muted-foreground',
            )}
          >
            Log in
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
