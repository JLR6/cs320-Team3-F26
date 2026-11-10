import { Providers } from '../providers';

import { AppSidebar } from '@/components/app-sidebar';
import { AppHeader } from '@/components/app-header';

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export default function MainLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-background text-foreground font-sans antialiased">
        <SidebarProvider>
          <AppSidebar />

          <SidebarInset>
            <AppHeader />
            <Providers>{children}</Providers>
          </SidebarInset>
        </SidebarProvider>
      </body>
    </html>
  );
}
