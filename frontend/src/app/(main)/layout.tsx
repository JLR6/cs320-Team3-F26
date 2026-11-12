import { Providers } from '../providers';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section>
      <Providers>{children}</Providers>
    </section>
  );
}
