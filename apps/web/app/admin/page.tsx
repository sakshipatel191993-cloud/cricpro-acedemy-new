'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowUpRight, CalendarDays, CheckCircle2, Clock3, Eye, MessageSquare, PoundSterling, Users } from 'lucide-react';

type Stats = {
  totalBookings: number; confirmedBookings: number; pendingBookings: number;
  totalInquiries: number; newInquiries: number; totalGroupBookings: number; totalRevenue: string;
  visitsToday: number;
};
type Booking = {
  id: string; booking_reference: string; customer_name: string; start_at: string; end_at: string;
  status: string; amount: string; resource: { name: string } | { name: string }[] | null;
};
type Resource = { id: string; name: string; type: string; active: boolean; bookings: number };
type Day = { date: string; bookings: number; revenue: number };
type VisitDay = { date: string; visits: number };
type DashboardData = { stats: Stats; dailyActivity: Day[]; dailyVisits: VisitDay[]; todaysBookings: Booking[]; upcomingBookings: Booking[]; resourceUtilization: Resource[] };

const money = (amount: string | number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 2 }).format(Number(amount));
const date = (value: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short' }).format(new Date(value));
const time = (value: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const resourceName = (booking: Booking) => Array.isArray(booking.resource) ? booking.resource[0]?.name ?? 'Lane' : booking.resource?.name ?? 'Lane';

function BookingRow({ booking, showDate = false }: { booking: Booking; showDate?: boolean }) {
  return <li className="flex min-w-0 items-start justify-between gap-3 border-b border-border/60 py-4 last:border-0">
    <div className="min-w-0">
      <p className="truncate font-semibold text-foreground">{booking.customer_name}</p>
      <p className="mt-1 text-sm text-muted-foreground">{resourceName(booking)} · {showDate && `${date(booking.start_at)} · `}{time(booking.start_at)}–{time(booking.end_at)}</p>
      <p className="mt-1 font-mono text-xs text-muted-foreground">{booking.booking_reference}</p>
    </div>
    <span className="shrink-0 font-semibold tabular-nums">{money(booking.amount)}</span>
  </li>;
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin/stats', { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error(response.status === 401 ? 'Your admin session has expired. Sign in again.' : 'Dashboard data is unavailable.');
        return response.json();
      })
      .then(result => { if (!result.success) throw new Error('Dashboard data is unavailable.'); setData(result); setError(null); })
      .catch(cause => { if (cause.name !== 'AbortError') setError(cause.message); });
    return () => controller.abort();
  }, [reload]);

  if (error) return <div role="alert" className="mx-auto max-w-xl rounded-xl border border-border bg-card p-6 text-center"><h1 className="text-xl font-semibold">Dashboard unavailable</h1><p className="mt-2 text-sm text-muted-foreground">{error}</p><div className="mt-5 flex justify-center gap-3"><button className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground" onClick={() => { setError(null); setReload(value => value + 1); }}>Try again</button><Link href="/admin/login" className="rounded-md border border-border px-4 py-2 font-medium">Sign in</Link></div></div>;
  if (!data) return <div role="status" className="space-y-5"><div className="h-9 w-48 animate-pulse rounded bg-muted" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <div key={i} className={`h-28 animate-pulse rounded-xl bg-muted ${i === 0 ? 'col-span-2 lg:col-span-1' : ''}`} />)}</div><div className="h-64 animate-pulse rounded-xl bg-muted" /><span className="sr-only">Loading dashboard</span></div>;

  const { stats, dailyActivity, dailyVisits, todaysBookings, upcomingBookings, resourceUtilization } = data;
  const metrics = [
    { label: 'Visits today', value: stats.visitsToday.toLocaleString('en-GB'), detail: 'Anonymous site sessions · London time', icon: Eye, feature: true },
    { label: 'Paid revenue', value: money(stats.totalRevenue), detail: 'Last 30 days', icon: PoundSterling, feature: true },
    { label: 'Confirmed', value: stats.confirmedBookings.toLocaleString('en-GB'), detail: 'Resource bookings · all time', icon: CheckCircle2 },
    { label: 'Pending', value: stats.pendingBookings.toLocaleString('en-GB'), detail: 'Awaiting payment', icon: Clock3 },
    { label: 'New enquiries', value: stats.newInquiries.toLocaleString('en-GB'), detail: `${stats.totalInquiries} total`, icon: MessageSquare },
  ];
  const chartDays = dailyActivity.map(day => ({ ...day, label: new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${day.date}T12:00:00Z`)) }));
  const visitChartDays = dailyVisits.map(day => ({ ...day, label: new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${day.date}T12:00:00Z`)) }));
  const chartResources = resourceUtilization.filter(resource => resource.active).sort((a, b) => b.bookings - a.bookings).slice(0, 6);

  return <div className="mx-auto max-w-7xl space-y-6 pb-10 sm:space-y-8">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Centre operations</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Overview</h1><p className="mt-2 text-sm text-muted-foreground">Site visits, bookings, revenue and the next sessions at a glance.</p></div>
      <Link href="/admin/bookings" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 text-sm font-semibold hover:bg-muted">Manage bookings <ArrowUpRight className="h-4 w-4" /></Link>
    </header>

    <section aria-label="Key figures" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {metrics.map((metric, index) => <div key={metric.label} className={`min-w-0 rounded-xl border p-4 sm:p-5 ${index === 0 ? 'col-span-2 lg:col-span-1' : ''} ${metric.feature ? 'border-primary/35 bg-primary/10' : 'border-border bg-card'}`}>
        <div className="flex items-center justify-between gap-2"><span className="text-xs font-medium text-muted-foreground sm:text-sm">{metric.label}</span><metric.icon className="h-4 w-4 shrink-0 text-primary" /></div>
        <p className="mt-4 break-words text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">{metric.value}</p><p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p>
      </div>)}
    </section>

    <section aria-labelledby="visits-title" className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h2 id="visits-title" className="text-lg font-semibold tracking-tight">Daily site visits</h2><p className="text-sm text-muted-foreground">Anonymous browser sessions · last 7 days · Europe/London</p></div><p className="text-xs text-muted-foreground">Tracking begins when this feature is enabled</p></div>
      <div role="img" aria-label={`Daily site visits: ${dailyVisits.map(day => `${day.date}: ${day.visits}`).join(', ')}`} className="h-56 w-full min-w-0 sm:h-64">
        <ResponsiveContainer width="100%" height="100%"><BarChart data={visitChartDays} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}><CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} /><Tooltip contentStyle={{ background: 'var(--card)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: 8 }} formatter={(value) => [`${value} visits`, 'Visits']} /><Bar dataKey="visits" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={48} /></BarChart></ResponsiveContainer>
      </div>
    </section>

    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
      <section aria-labelledby="activity-title" className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-6">
        <div className="mb-5"><h2 id="activity-title" className="text-lg font-semibold tracking-tight">Paid bookings</h2><p className="text-sm text-muted-foreground">Confirmed bookings by creation date · last 7 days</p></div>
        <div role="img" aria-label={`Paid bookings in the last seven days: ${dailyActivity.map(day => `${day.date}: ${day.bookings}`).join(', ')}`} className="h-56 w-full min-w-0 sm:h-64">
          <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartDays} margin={{ top: 12, right: 4, left: -25, bottom: 0 }}><CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} /><Tooltip contentStyle={{ background: 'var(--card)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: 8 }} formatter={(value) => [`${value} bookings`, 'Paid']} /><Area type="monotone" dataKey="bookings" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.16} strokeWidth={2.5} dot={{ r: 3, fill: 'var(--primary)' }} /></AreaChart></ResponsiveContainer>
        </div>
      </section>

      <section aria-labelledby="resources-title" className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-6">
        <div className="mb-5"><h2 id="resources-title" className="text-lg font-semibold tracking-tight">Bookings by resource</h2><p className="text-sm text-muted-foreground">Confirmed sessions · last 30 days</p></div>
        {chartResources.length ? <div role="img" aria-label={chartResources.map(resource => `${resource.name}: ${resource.bookings} bookings`).join(', ')} className="h-56 w-full min-w-0 sm:h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartResources} layout="vertical" margin={{ top: 2, right: 18, left: 0, bottom: 2 }}><CartesianGrid horizontal={false} stroke="var(--border)" strokeOpacity={0.6} /><XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} /><YAxis dataKey="name" type="category" width={92} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} /><Tooltip contentStyle={{ background: 'var(--card)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: 8 }} formatter={(value) => [`${value} bookings`, 'Confirmed']} /><Bar dataKey="bookings" fill="var(--primary)" radius={[0, 4, 4, 0]} maxBarSize={20} /></BarChart></ResponsiveContainer></div> : <p className="py-16 text-center text-sm text-muted-foreground">No active resources yet.</p>}
      </section>
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <section aria-labelledby="today-title" className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-6"><div className="flex items-center justify-between gap-3"><div><h2 id="today-title" className="text-lg font-semibold tracking-tight">Today’s schedule</h2><p className="text-sm text-muted-foreground">{todaysBookings.length} confirmed resource bookings</p></div><CalendarDays className="h-5 w-5 text-primary" /></div>{todaysBookings.length ? <ul className="mt-3">{todaysBookings.map(booking => <BookingRow key={booking.id} booking={booking} />)}</ul> : <p className="mt-5 rounded-lg bg-muted/40 px-4 py-6 text-sm text-muted-foreground">No confirmed resource bookings today.</p>}</section>
      <section aria-labelledby="upcoming-title" className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-6"><div className="flex items-center justify-between gap-3"><div><h2 id="upcoming-title" className="text-lg font-semibold tracking-tight">Coming up</h2><p className="text-sm text-muted-foreground">Next 7 days · first 10 resource bookings</p></div><Users className="h-5 w-5 text-primary" /></div>{upcomingBookings.length ? <ul className="mt-3">{upcomingBookings.map(booking => <BookingRow key={booking.id} booking={booking} showDate />)}</ul> : <p className="mt-5 rounded-lg bg-muted/40 px-4 py-6 text-sm text-muted-foreground">No upcoming confirmed resource bookings.</p>}</section>
    </div>
  </div>;
}
