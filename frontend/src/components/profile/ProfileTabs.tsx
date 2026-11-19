import { cn } from '@/lib/utils';

export type ProfileTab = 'posts' | 'following';

const LABELS: Record<ProfileTab, string> = {
  posts: 'Posts',
  following: 'Following',
};

type Props = {
  tabs: ProfileTab[]; // other people's profiles only get "Posts"
  active: ProfileTab;
  onChange: (tab: ProfileTab) => void;
};

// Underlined tabs at the top of the profile (Posts / Following)
export function ProfileTabs({ tabs, active, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Profile sections"
      className="flex max-w-[418px] border-b"
    >
      {tabs.map((tab) => {
        const selected = tab === active;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab)}
            className={cn(
              // -mb-px lets the active underline sit on top of the grey border
              '-mb-px border-b-[3px] px-4 py-3 text-base font-bold transition-colors',
              selected
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {LABELS[tab]}
          </button>
        );
      })}
    </div>
  );
}
