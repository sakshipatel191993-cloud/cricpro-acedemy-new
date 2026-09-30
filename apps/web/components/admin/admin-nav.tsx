'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CalendarDays, Layers, Ban, Users, MessageSquare, ExternalLink, LogOut, Menu, X, Ticket } from 'lucide-react';
import { Button } from '@workspace/ui/components/button';

const navItems = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/bookings', label: 'Bookings', icon: CalendarDays },
  { href: '/admin/resources', label: 'Resources', icon: Layers },
  { href: '/admin/blocked-slots', label: 'Blocked slots', icon: Ban },
  { href: '/admin/group-sessions', label: 'Group sessions', icon: Users },
  { href: '/admin/masterclass', label: 'Masterclass', icon: Users },
  { href: '/admin/inquiries', label: 'Inquiries', icon: MessageSquare },
  { href: '/admin/coupons', label: 'Coupons', icon: Ticket },
];

export function AdminNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => pathname === href || (href !== '/admin' && pathname.startsWith(`${href}/`));

  async function signOut() {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    window.location.href = '/admin/login';
  }

  if (pathname === '/admin/login') return null;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/admin" className="min-w-0 text-sm font-extrabold tracking-tight text-foreground sm:text-base" onClick={() => setOpen(false)}>
          CRIC<span className="text-primary">PRO</span> <span className="ml-1 font-medium text-muted-foreground">/ Admin</span>
        </Link>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm" className="hidden gap-2 lg:inline-flex"><Link href="/"><ExternalLink className="h-4 w-4" /> View site</Link></Button>
          <Button variant="ghost" size="sm" className="hidden gap-2 lg:inline-flex" onClick={signOut}><LogOut className="h-4 w-4" /> Sign out</Button>
          <Button variant="outline" size="icon" className="lg:hidden" aria-label={open ? 'Close admin menu' : 'Open admin menu'} aria-expanded={open} aria-controls="admin-mobile-menu" onClick={() => setOpen(value => !value)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>
      <nav aria-label="Admin navigation" className="hidden border-t border-border/70 lg:block">
        <div className="mx-auto flex max-w-7xl flex-wrap gap-1 px-6 py-2">
          {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={active(href) ? 'page' : undefined} className={`inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors ${active(href) ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><Icon className="h-4 w-4" />{label}</Link>)}
        </div>
      </nav>
      {open && <nav id="admin-mobile-menu" aria-label="Admin mobile navigation" className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-border bg-background px-4 pb-5 pt-3 lg:hidden">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={active(href) ? 'page' : undefined} className={`flex min-h-14 items-center gap-2 rounded-lg border px-3 text-sm font-medium ${active(href) ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-card text-foreground'}`}><Icon className="h-4 w-4 shrink-0" />{label}</Link>)}
        </div>
        <div className="mt-4 flex gap-2 border-t border-border pt-4">
          <Button asChild variant="outline" className="min-w-0 flex-1"><Link href="/" onClick={() => setOpen(false)}><ExternalLink className="h-4 w-4" /> View site</Link></Button>
          <Button variant="outline" className="min-w-0 flex-1" onClick={signOut}><LogOut className="h-4 w-4" /> Sign out</Button>
        </div>
      </nav>}
    </header>
  );
}
