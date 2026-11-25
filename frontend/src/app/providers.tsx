// this code is boilerplate for TanStack which we have planned for the future

'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppHeader } from '@/components/app-header';
import { AppSidebar } from '@/components/app-sidebar';
import { ThemeProvider } from '@/components/ThemeProvider';
import { CreatePostProvider } from '@/components/posts/CreatePostProvider';
import { LoginWallProvider } from '@/components/auth/LoginWallProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <ThemeProvider>
      {/* lets any button open the "Sign up or log in" popup for logged-out visitors */}
      <LoginWallProvider>
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
      </LoginWallProvider>
    </ThemeProvider>
  );
}
