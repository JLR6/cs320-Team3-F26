// this code is boilerplate for TanStack which we have planned for the future

'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppHeader } from '@/components/app-header';
import { AppSidebar } from '@/components/app-sidebar';
import { ThemeProvider } from '@/components/ThemeProvider';
import { CreatePostProvider } from '@/components/posts/CreatePostProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <ThemeProvider>
      <CreatePostProvider>
        <SidebarProvider>
          <AppSidebar />

          <SidebarInset>
            <AppHeader />
            <QueryClientProvider client={queryClient}>
              {children}
            </QueryClientProvider>
          </SidebarInset>
        </SidebarProvider>
      </CreatePostProvider>
    </ThemeProvider>
  );
}
