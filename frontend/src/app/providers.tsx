'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppHeader } from '@/components/app-header';
import { AppSidebar } from '@/components/app-sidebar';
import { ThemeProvider } from '@/components/ThemeProvider';
import { CreatePostProvider } from '@/components/posts/CreatePostProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  // One React Query cache for the app. It wraps everything (not just the page)
  // so the sidebar's "New Post" dialog can refresh the feed too.
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <CreatePostProvider>
          <SidebarProvider>
            <AppSidebar />

            <SidebarInset>
              <AppHeader />
              {children}
            </SidebarInset>
          </SidebarProvider>
        </CreatePostProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
