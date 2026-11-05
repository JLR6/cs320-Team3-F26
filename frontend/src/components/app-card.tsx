// card styles specific to LeetMeet, to let us customize without touching card.tsx itself
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';

function AppCard({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <Card className={cn('w-96 rounded-md px-2 gap-0', className)} {...props} />
  );
}

const appCardHeaderVariants = cva('font-semibold flex items-center', {
  variants: {
    size: {
      default: 'text-base font-bold mt-2',
      sm: 'text-sm',
      lg: 'mt-4 text-lg font-medium justify-center text-center',
    },
  },
  defaultVariants: {
    size: 'default',
  },
});

function AppCardHeader({
  size = 'default',
  className,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof appCardHeaderVariants>) {
  return (
    <CardHeader
      className={cn(appCardHeaderVariants({ size }), className)}
      {...props}
    />
  );
}

function AppCardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <CardContent className={className} {...props} />;
}

function AppCardInput({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <Input className={cn('rounded-sm font-light mt-5', className)} {...props} />
  );
}

const appCardButtonVariants = cva('font-semibold rounded-sm mt-5', {
  variants: {
    variant: {
      black:
        'bg-foreground text-background hover:bg-foreground/80 focus:border-foreground',
      blue: 'bg-[#027BFF] text-primary-foreground hover:bg-[#027BFF]/80 focus:border-[#027BFF] ',
    },
    size: {
      default: 'h-10 px-4 text-base',
      sm: '',
      lg: 'h-9 w-full text-center',
    },
  },
  defaultVariants: {
    variant: 'black',
    size: 'default',
  },
});

function AppCardButton({
  size = 'default',
  variant = 'black',
  className,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof appCardButtonVariants>) {
  return (
    <Button
      className={cn(appCardButtonVariants({ size, variant }), className)}
      {...props}
    />
  );
}

export { AppCard, AppCardHeader, AppCardContent, AppCardInput, AppCardButton };
