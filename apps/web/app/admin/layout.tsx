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
      <main className="container px-4 mx-auto py-8">
        {children}
      </main>
    </div>
  );
}