'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card';
import { Badge } from '@workspace/ui/components/badge';
import { CalendarDays, CheckCircle, Clock, MessageSquare, BellRing, PoundSterling } from 'lucide-react';

interface Stats {
  totalBookings: number;
  confirmedBookings: number;
  pendingBookings: number;
  totalInquiries: number;
  newInquiries: number;
  totalRevenue: string;
}

interface Booking {
  id: string;
  booking_reference: string;
  customer_name: string;
  customer_email: string;
  start_at: string;
  end_at: string;
  status: string;
  amount: string;
  resource: { name: string; type: string };
}

interface ResourceUtil {
  id: string;
  name: string;
  type: string;
  active: boolean;
  bookings: number;
}

const statCards = [
  { key: 'totalBookings', label: 'Total Bookings', icon: CalendarDays, format: (v: number) => v },
  { key: 'confirmedBookings', label: 'Confirmed', icon: CheckCircle, format: (v: number) => v },
  { key: 'pendingBookings', label: 'Pending', icon: Clock, format: (v: number) => v },
  { key: 'totalInquiries', label: 'Total Inquiries', icon: MessageSquare, format: (v: number) => v },
  { key: 'newInquiries', label: 'New Inquiries', icon: BellRing, format: (v: number) => v },
  { key: 'totalRevenue', label: 'Revenue (30d)', icon: PoundSterling, format: (v: number | string) => `£${v}` },
];

function statusBadge(status: string) {
  if (status === 'confirmed') return <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30 hover:bg-green-500/15">{status}</Badge>;
  if (status === 'cancelled') return <Badge variant="destructive">{status}</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [todaysBookings, setTodaysBookings] = useState<Booking[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [resources, setResources] = useState<ResourceUtil[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setStats(data.stats);
          setTodaysBookings(data.todaysBookings || []);
          setUpcomingBookings(data.upcomingBookings || []);
          setResources(data.resourceUtilization || []);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map(({ key, label, icon: Icon, format }) => {
          const raw = stats ? (stats as any)[key] : 0;
          return (
            <Card key={key} className="relative overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground font-medium">{label}</p>
                  <Icon className="h-4 w-4 text-primary/60" />
                </div>
                <p className="text-2xl font-bold">{format(raw)}</p>
              </CardContent>
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary/30" />
            </Card>
          );
        })}
      </div>

      {/* Schedule + Resources */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Today's Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            {todaysBookings.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-6">No bookings today</p>
            ) : (
              <div className="space-y-2">
                {todaysBookings.map(b => (
                  <div key={b.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                    <div>
                      <p className="font-medium text-sm">{b.resource.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(b.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} –{' '}
                        {new Date(b.end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}
                        {' · '}{b.customer_name}
                      </p>
                    </div>
                    {statusBadge(b.status)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Resource Utilization</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {resources.map(r => (
                <div key={r.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${r.active ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
                    <span className="text-sm font-medium">{r.name}</span>
                    <span className="text-xs text-muted-foreground capitalize">({r.type.replace('_', ' ')})</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{r.bookings} bookings</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Bookings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Upcoming Bookings (Next 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingBookings.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">No upcoming bookings</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Reference</th>
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Customer</th>
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Resource</th>
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Date</th>
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Amount</th>
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {upcomingBookings.map(b => (
                    <tr key={b.id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-3 px-3 font-mono font-medium text-xs">{b.booking_reference}</td>
                      <td className="py-3 px-3 text-foreground">{b.customer_name}</td>
                      <td className="py-3 px-3 text-muted-foreground">{b.resource?.name}</td>
                      <td className="py-3 px-3 text-muted-foreground">
                        {new Date(b.start_at).toLocaleDateString('en-GB', { timeZone: 'UTC' })}
                      </td>
                      <td className="py-3 px-3 font-medium">£{b.amount}</td>
                      <td className="py-3 px-3">{statusBadge(b.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
