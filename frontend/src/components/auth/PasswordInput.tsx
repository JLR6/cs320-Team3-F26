'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function PasswordInput({
  className,
  ...props
}: Omit<React.ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = React.useState(false);

  // toggle visibility without changing the field value
  return (
    <div className="flex group mt-5 rounded-sm border border-input focus-within:border-foreground">
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        className={cn('pr-10 rounded-r-none border-0', className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        className="h-9 mt-auto inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-sm text-foreground opacity-0 group-hover:opacity-100 aria-pressed:opacity-100"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
