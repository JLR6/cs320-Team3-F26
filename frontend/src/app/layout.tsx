import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { Providers } from './providers';
import { ThemeProvider } from '@/components/ThemeProvider';

import { Inter, JetBrains_Mono } from 'next/font/google';
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono-face',
});

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground font-sans antialiased">
        <ThemeProvider>
          <Providers>{children}</Providers>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
