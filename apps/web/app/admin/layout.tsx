import { Metadata } from 'next';
import { AdminNav } from '@/components/admin/admin-nav';

export const metadata: Metadata = {
  title: 'Admin Dashboard | Cricpro Centre of Excellence',
  description: 'Manage bookings, resources, and inquiries',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <main className="mx-auto min-w-0 max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
