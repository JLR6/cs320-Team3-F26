import { AppSidebar } from '@/components/app-sidebar';
import { AppHeader } from '@/components/app-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

// Profile pages get the same sidebar + mobile header as the feed.
// (The root layout already wraps everything in <html>, the theme and react-query.)
export default function ProfileLayout({ children }: LayoutProps<'/profile'>) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
