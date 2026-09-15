'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle,
  Loader2,
  Calendar,
  Clock,
  MapPin,
  CreditCard,
} from 'lucide-react';
import { Button } from '@workspace/ui/components/button';
import { LocationDirections } from '@/components/location-directions';

interface VerifiedBooking {
  booking_reference?: string;
  service_type?: string;
  booking_date?: string;
  start_at?: string;
  end_at?: string;
  amount?: number | string;
  resource_name?: string | null;
  schedule?: string;
  coach_name?: string;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        // Stored as wall-clock UK time (naive → UTC); render in UTC to avoid a BST offset.
        timeZone: 'UTC',
      });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
}

function formatAmount(amount: number | string | undefined) {
  if (amount == null) return '';
  const n = Number(amount);
  return Number.isNaN(n) ? String(amount) : `£${n.toFixed(2)}`;
}

export function BookingSuccessView({
  bookingRef,
  sessionId,
}: {
  bookingRef: string;
  sessionId: string;
}) {
  const refs = bookingRef ? decodeURIComponent(bookingRef).split(',') : [];
  const [status, setStatus] = useState<'verifying' | 'confirmed' | 'idle'>(
    sessionId ? 'verifying' : 'idle'
  );
  const [retry, setRetry] = useState(0);
  const [booking, setBooking] = useState<VerifiedBooking | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    fetch('/api/payments/verify-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setStatus(data.success ? 'confirmed' : 'idle');
        if (data.success && data.booking) setBooking(data.booking);
      })
      .catch(() => {
        if (!cancelled) setStatus('idle');
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, retry]);

  const displayRefs =
    refs.length > 0
      ? refs
      : booking?.booking_reference
      ? [booking.booking_reference]
      : [];

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 sm:py-16">
      <div className="min-w-0 max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-green-100 p-4">
            {status === 'confirmed' ? <CheckCircle className="h-12 w-12 text-green-600" /> : <CreditCard className="h-12 w-12 text-muted-foreground" />}
          </div>
        </div>
        <h1 className="text-2xl font-bold mb-2">{status === "confirmed" ? "Booking Confirmed!" : status === "verifying" ? "Verifying Payment" : "Payment Not Confirmed"}</h1>
        <p className="text-muted-foreground mb-4">
          {status === 'confirmed' ? 'Your payment was successful and your booking is confirmed.' : status === 'verifying' ? 'Please wait while we check your payment with Stripe.' : 'We could not verify your payment. If you have paid, retry verification or contact us before paying again.'}
        </p>

        {displayRefs.length > 0 && (
          <div className="bg-muted/40 rounded-lg px-4 py-3 mb-6 space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              {displayRefs.length === 1 ? 'Booking Reference' : 'Booking References'}
            </p>
            {displayRefs.map((r) => (
              <p key={r} className="break-words text-lg font-bold font-mono tracking-wider">
                {r}
              </p>
            ))}
          </div>
        )}

        {status === "confirmed" && booking && (
          <div className="bg-muted/40 rounded-lg px-4 py-4 mb-6 text-left space-y-2.5">
            {booking.schedule && <p className="text-sm">{booking.schedule}</p>}
            {booking.coach_name && <p className="text-sm">Coach: {booking.coach_name}</p>}
            {booking.booking_date && (
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{formatDate(booking.booking_date)}</span>
              </div>
            )}
            {booking.start_at && (
              <div className="flex items-center gap-3 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>
                  {formatTime(booking.start_at)}
                  {booking.end_at ? ` – ${formatTime(booking.end_at)}` : ''}
                </span>
              </div>
            )}
            {booking.resource_name && (
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{booking.resource_name}</span>
              </div>
            )}
            {formatAmount(booking.amount) && (
              <div className="flex items-center gap-3 text-sm font-semibold">
                <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{formatAmount(booking.amount)}</span>
              </div>
            )}
          </div>
        )}

        <div className="bg-muted/40 rounded-lg px-4 py-4 mb-6 text-left">
          <LocationDirections />
        </div>

        {status === 'verifying' && (
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-6">
            <Loader2 className="h-4 w-4 animate-spin" />
            Confirming your booking…
          </p>
        )}

        {status === 'idle' && sessionId && <Button className="mb-4 w-full" onClick={() => { setStatus('verifying'); setRetry(value => value + 1); }}>Retry Verification</Button>}
        <div className="space-y-3">
          <Button asChild className="w-full">
            <Link href="/">Back to Home</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href={booking?.service_type === "masterclass" ? "/masterclass" : booking?.service_type === "group_session" ? "/group-sessions" : "/lane-hire"}>Book Another Session</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
