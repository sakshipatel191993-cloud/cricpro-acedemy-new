'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CalendarDays, Layers, Ban, Users, MessageSquare, ExternalLink, LogOut } from 'lucide-react';
import { Button } from '@workspace/ui/components/button';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/bookings', label: 'Bookings', icon: CalendarDays },
  { href: '/admin/resources', label: 'Resources', icon: Layers },
  { href: '/admin/blocked-slots', label: 'Blocked Slots', icon: Ban },
  { href: '/admin/group-sessions', label: 'Group Sessions', icon: Users },
  { href: '/admin/masterclass', label: 'Masterclass', icon: Users },
  { href: '/admin/inquiries', label: 'Inquiries', icon: MessageSquare },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="bg-background border-b border-border sticky top-0 z-40">
      <div className="container px-4 mx-auto">
        <div className="flex items-center justify-between h-14">
          {/* Brand */}
          <Link href="/admin" className="text-sm font-bold text-foreground tracking-wide shrink-0 mr-6">
            NGCA Admin
          </Link>

          {/* Nav links */}
          <div className="flex items-center gap-1 overflow-x-auto flex-1 scrollbar-none">
            {navItems.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== '/admin' && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground gap-1.5">
              <Link href="/">
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">View Site</span>
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
              onClick={async () => {
                await fetch('/api/admin/auth', { method: 'DELETE' });
                window.location.href = '/admin/login';
              }}
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
