'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner, type ToasterProps } from 'sonner';
import {
  CheckIcon,
  InfoIcon,
  CircleAlertIcon,
  XIcon,
  Loader2Icon,
  type LucideIcon,
} from 'lucide-react';
import { cn } from 'cn';

const ToasterIcon = (Icon: LucideIcon, className?: string ) => {
  return (
    <span className={cn("flex items-center justify-center size-4 rounded-full bg-emerald-500 text-primary-foreground", className)}>
      <Icon className="size-2.5" strokeWidth={3}></Icon>
    </span>
  )
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      icons={{
        success: ToasterIcon(CheckIcon, "bg-emerald-500"),
        info: <InfoIcon className="size-4" />,
        warning: <CircleAlertIcon className="size-4" />,
        error: ToasterIcon(XIcon, "bg-destructive"),
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: 'cn-toast h-9 max-h-9',
        },
      }}
      position="top-center"
      {...props}
    />
  );
};

export { Toaster };
