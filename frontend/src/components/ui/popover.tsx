// imported from shadcn, https://ui.shadcn.com/docs/components/base/popover
// slightly modified PopoverContent and added PopoverMenuButton, PopoverTriggerMore, and PopoverTriggerDropdown

'use client';

import * as React from 'react';
import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Ellipsis, ChevronDown } from 'lucide-react';

function Popover({ ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

// modified: adjusted default padding and alignment
function PopoverContent({
  className,
  align = 'start',
  alignOffset = 0,
  side = 'bottom',
  sideOffset = 4,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<
    PopoverPrimitive.Positioner.Props,
    'align' | 'alignOffset' | 'side' | 'sideOffset'
  >) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            'z-50 flex origin-(--transform-origin) flex-col gap-2.5 bg-popover text-sm text-popover-foreground shadow-md duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
            'rounded-sm p-1 w-55.5 ml-0.5 my-1',
            className,
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

function PopoverHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="popover-header"
      className={cn('flex flex-col gap-0.5 text-sm', className)}
      {...props}
    />
  );
}

function PopoverTitle({ className, ...props }: PopoverPrimitive.Title.Props) {
  return (
    <PopoverPrimitive.Title
      data-slot="popover-title"
      className={cn('font-medium', className)}
      {...props}
    />
  );
}

function PopoverDescription({
  className,
  ...props
}: PopoverPrimitive.Description.Props) {
  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      className={cn('text-muted-foreground', className)}
      {...props}
    />
  );
}

/**
 * The button used in our popover menus
 */
function PopoverMenuButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      {...props}
      className={cn(
        'h-7 w-full text-sm font-semibold bg-transparent text-foreground hover:bg-secondary hover:text-secondary-foreground mb-0 pl-1.5 py-4 gap-2.5 flex items-center justify-start overflow-hidden rounded-sm text-left transition-[width,height,padding] disabled:pointer-events-none [&_svg]:shrink-0 [&>span:last-child]:truncate',
        className,
      )}
    />
  );
}

/**
 * An ellipsis PopoverTrigger
 */
function PopoverTriggerMore({
  className,
  ...props
}: PopoverPrimitive.Trigger.Props) {
  return (
    <PopoverTrigger
      render={
        <Button
          className={cn(
            'h-8 text-base w-fit mr-2 mt-2 ml-auto mb-1 p-2 rounded-full bg-transparent text-foreground hover:bg-secondary hover:text-secondary-foreground flex items-center overflow-hidden transition-[width,height,padding] disabled:pointer-events-none [&_svg]:size-4.5 [&_svg]:shrink-0 [&>span:last-child]:truncate',
            className,
          )}
        >
          <Ellipsis />
        </Button>
      }
      {...props}
    />
  );
}

/**
 * An dropdown icon PopoverTrigger-- suggested use with a single icon as the child
 */
function PopoverTriggerDropdown({
  className,
  children,
}: PopoverPrimitive.Trigger.Props) {
  return (
    <PopoverTrigger
      render={
        <Button
          className={cn(
            'h-7 w-fit text-left text-sm py-4.5 pl-2 pr-1 ml-auto gap-0.5 bg-transparent text-foreground hover:bg-secondary hover:text-secondary-foreground overflow-hidden rounded-sm transition-[width,height,padding] disabled:pointer-events-none aria-disabled:pointer-events-none [&_svg]:shrink-0 [&>span:last-child]:truncate',
            className,
          )}
        >
          <span className="[&_svg]:size-4.5!">{children}</span>
          <ChevronDown className="h-3! w-3! text-secondary-foreground" />
        </Button>
      }
    />
  );
}

export {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
  PopoverMenuButton,
  PopoverTriggerMore,
  PopoverTriggerDropdown,
};
