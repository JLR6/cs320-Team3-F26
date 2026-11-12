'use client';

import * as React from 'react';
import { Avatar } from '@base-ui/react/avatar';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from 'cn';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverMenuButton,
  PopoverTrigger,
} from '@/components/ui/popover';

/** Structural subsets of the /families owner and admin responses. */
export interface LeaderboardFamilyRole {
  family_id: string;
  user_id: string;
}

export interface LeaderboardMember {
  user_id: string;
  /** Display name; accepts the username returned by /users. */
  username: string;
  profile_picture?: string | null;
  /** Supplied by the caller; the families API does not calculate points. */
  points: number;
}

export interface LeaderboardData {
  family: { id: string; name: string };
  owner: LeaderboardFamilyRole | null;
  admins?: readonly LeaderboardFamilyRole[];
  members: readonly LeaderboardMember[];
}

export interface LeaderboardProps extends React.ComponentProps<'section'> {
  data: LeaderboardData;
  /** Controlled period: the caller supplies the corresponding members/points. */
  period?: string;
  periods?: readonly { value: string; label: string }[];
  onPeriodChange?: (period: string) => void;
  emptyMessage?: string;
}

const defaultPeriods = [{ value: 'week', label: 'This Week' }];

/** Compact family leaderboard. Equal scores share a competition rank (1, 1, 3). */
function Leaderboard({
  data,
  period = 'week',
  periods = defaultPeriods,
  onPeriodChange,
  emptyMessage = 'No members yet.',
  className,
  ...props
}: LeaderboardProps) {
  const [open, setOpen] = React.useState(false);
  const members = [...data.members].sort((a, b) => b.points - a.points);
  const owner =
    data.owner?.family_id === data.family.id ? data.owner.user_id : null;
  const admins = new Set(
    data.admins
      ?.filter((admin) => admin.family_id === data.family.id)
      .map((admin) => admin.user_id),
  );
  const periodLabel =
    periods.find((option) => option.value === period)?.label ?? period;

  return (
    <section
      data-slot="leaderboard"
      aria-label={`${data.family.name} leaderboard`}
      className={cn(
        'w-full bg-background p-2 text-[10px] leading-4 text-black dark:text-foreground',
        className,
      )}
      {...props}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          disabled={!onPeriodChange || periods.length < 2}
          render={<Button variant="ghost" />}
          className="mb-4 h-3.5 gap-1 rounded-sm px-1 py-0 text-[10px] font-semibold disabled:opacity-100 [&_svg]:size-2.5"
          aria-label={`Leaderboard period: ${periodLabel}`}
        >
          {periodLabel}
          <ChevronDown aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent className="w-36" aria-label="Leaderboard period">
          {periods.map((option) => (
            <PopoverMenuButton
              key={option.value}
              aria-pressed={period === option.value}
              onClick={() => {
                onPeriodChange?.(option.value);
                setOpen(false);
              }}
            >
              <span className="flex-1">{option.label}</span>
              {period === option.value && <Check aria-hidden="true" />}
            </PopoverMenuButton>
          ))}
        </PopoverContent>
      </Popover>

      <ol className="m-0 list-none space-y-px p-0" aria-label="Rankings">
        {members.map((member) => {
          const rank =
            members.findIndex((entry) => entry.points === member.points) + 1;
          const role =
            member.user_id === owner
              ? 'Owner'
              : admins.has(member.user_id)
                ? 'Admin'
                : 'Member';

          return (
            <li
              key={member.user_id}
              data-slot="leaderboard-row"
              className="flex min-h-[38.5px] items-center gap-2 rounded-sm py-1 px-3 odd:bg-[#f9f9f9] dark:odd:bg-secondary/50"
            >
              <span
                className="min-w-3 shrink-0 font-semibold tabular-nums"
                aria-label={`Rank ${rank}`}
              >
                {rank}.
              </span>
              <Avatar.Root className="relative flex size-7 shrink-0 overflow-hidden rounded-full bg-[#c4c4c4]">
                <Avatar.Image
                  src={member.profile_picture ?? undefined}
                  alt=""
                  className="size-full object-cover"
                />
                <Avatar.Fallback
                  className="relative size-full"
                  aria-hidden="true"
                >
                  <span className="absolute top-[5px] left-2 size-3 rounded-full bg-white" />
                  <span className="absolute -bottom-1 left-1 h-4 w-5 rounded-t-full bg-white" />
                </Avatar.Fallback>
              </Avatar.Root>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span
                  className="truncate font-semibold"
                  title={member.username}
                >
                  {member.username}
                </span>
                <span aria-hidden="true" className="text-[#808080]">
                  •
                </span>
                <span className="shrink-0 text-[#808080] dark:text-muted-foreground">
                  {role}
                </span>
              </div>
              <span className="ml-auto shrink-0 pr-1.5 font-semibold text-[#ff9500] tabular-nums dark:text-primary">
                {member.points} {member.points === 1 ? 'point' : 'points'}
              </span>
            </li>
          );
        })}
      </ol>
      {members.length === 0 && (
        <p className="px-3 py-4 text-muted-foreground" role="status">
          {emptyMessage}
        </p>
      )}
    </section>
  );
}

export { Leaderboard };
