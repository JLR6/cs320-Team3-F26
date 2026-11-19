// The header for LeetMeet, displayed only when the screen is too small for the sidebar

'use client';

import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';

function AppHeader() {
  const { state, isMobile } = useSidebar();

  if (state !== 'collapsed' && !isMobile) {
    return null;
  }

  return (
    <header className="flex h-12.5 items-center gap-2 border-b px-4">
      <SidebarTrigger />
      <h1 className="text-lg font-medium">LeetMeet</h1>
    </header>
  );
}

export { AppHeader };
