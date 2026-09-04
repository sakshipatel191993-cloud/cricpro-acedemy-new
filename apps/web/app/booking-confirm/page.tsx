'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@workspace/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card';
import { Badge } from '@workspace/ui/components/badge';
import { Separator } from '@workspace/ui/components/separator';
import { Calendar, Clock, User, Mail, Phone, CreditCard, ArrowLeft, Loader2 } from 'lucide-react';
import { LocationDirections } from '@/components/location-directions';

interface PendingBooking {
  serviceType: string;
  serviceLabel: string;
  resourceId?: string;
  bookingDate: string;
  selectedSlots: string[];
  slots: Array<{ time: string; price: string }>;
  duration: string;
  totalPrice: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  playerCount?: number;
  notes?: string;
}

function formatTime(time: string) {
  const hour = parseInt(time.split(':')[0] ?? '0');
  const min = time.split(':')[1] ?? '00';
  if (hour === 0) return `12:${min} AM`;
  if (hour < 12) return `${hour}:${min} AM`;
  if (hour === 12) return `12:${min} PM`;
  return `${hour - 12}:${min} PM`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export default function BookingConfirmPage() {
  const router = useRouter();
  const [booking, setBooking] = useState<PendingBooking | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const raw = sessionStorage.getItem('pendingBooking');
    if (!raw) { router.replace('/'); return; }
    try { setBooking(JSON.parse(raw)); } catch { router.replace('/'); }
  }, [router]);

  async function handlePayNow() {
    if (!booking) return;
    setSubmitting(true);
    setError('');

    try {
      const bookingPromises = booking.selectedSlots.map(async (slotTime) => {
        const startDateTime = `${booking.bookingDate}T${slotTime}:00`;
        const endHour = parseInt(slotTime.split(':')[0] ?? '0') + parseInt(booking.duration);
        const endMin = slotTime.split(':')[1] ?? '00';
        const endDateTime = `${booking.bookingDate}T${endHour.toString().padStart(2, '0')}:${endMin}:00`;
        const slot = booking.slots.find(s => s.time === slotTime);

        const res = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(booking.resourceId ? { resourceId: booking.resourceId } : {}),
            serviceType: booking.serviceType,
            bookingDate: booking.bookingDate,
            startAt: startDateTime,
            endAt: endDateTime,
            customerName: booking.customerName,
            customerEmail: booking.customerEmail,
            customerPhone: booking.customerPhone,
            playerCount: booking.playerCount,
            notes: booking.notes,
            amount: slot ? (parseFloat(slot.price) * parseInt(booking.duration)).toFixed(2) : '0',
          }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Failed to create booking');
        return { booking: data.booking, paymentUrl: data.paymentUrl };
      });

      const results = await Promise.all(bookingPromises);
      sessionStorage.removeItem('pendingBooking');

      const firstPaymentUrl = results.find(r => r.paymentUrl)?.paymentUrl;
      if (firstPaymentUrl) {
        window.location.href = firstPaymentUrl;
        return;
      }
      const refs = results.map(r => r.booking.booking_reference).join(',');
      router.push(`/booking-success?ref=${encodeURIComponent(refs)}`);
    } catch (err: any) {
      const msg: string = err.message ?? '';
      const isConflict = msg.toLowerCase().includes('overlap') ||
        msg.toLowerCase().includes('already booked') ||
        msg.toLowerCase().includes('slot is') ||
        msg.toLowerCase().includes('fully booked');
      if (isConflict) {
        setError('One or more slots were just taken. Please go back and choose different times.');
      } else {
        setError(msg || 'Something went wrong. Please try again.');
      }
      setSubmitting(false);
    }
  }

  if (!booking) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </main>
    );
  }

  const durationLabel = booking.duration === '1' ? '1 Hour' : `${booking.duration} Hours`;

  return (
    <main className="min-h-screen py-12 md:py-16">
      <div className="container px-4 mx-auto max-w-2xl">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </button>

        <h1 className="text-2xl md:text-3xl font-bold mb-2">Review Your Booking</h1>
        <p className="text-muted-foreground mb-8">Please check everything looks correct before paying.</p>

        <div className="space-y-4">
          {/* Service & Date */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Session Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <Badge className="mt-0.5 shrink-0">{booking.serviceLabel}</Badge>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{formatDate(booking.bookingDate)}</span>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <div className="flex flex-wrap gap-2">
                    {booking.selectedSlots.map(t => (
                      <span key={t} className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium">
                        {formatTime(t)}
                      </span>
                    ))}
                  </div>
                  <p className="text-muted-foreground mt-1">{durationLabel} per slot</p>
                </div>
              </div>
              {booking.playerCount && (
                <div className="flex items-center gap-3 text-sm">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{booking.playerCount} {booking.playerCount === 1 ? 'Player' : 'Players'}</span>
                </div>
              )}
              {booking.notes && (
                <p className="text-sm text-muted-foreground pl-7">{booking.notes}</p>
              )}
            </CardContent>
          </Card>

          {/* Customer Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Your Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{booking.customerName}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{booking.customerEmail}</span>
              </div>
              {booking.customerPhone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{booking.customerPhone}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Location */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Where to Find Us</CardTitle>
            </CardHeader>
            <CardContent>
              <LocationDirections />
            </CardContent>
          </Card>

          {/* Price Breakdown */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Price Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {booking.selectedSlots.map(slotTime => {
                const slot = booking.slots.find(s => s.time === slotTime);
                const slotTotal = slot ? parseFloat(slot.price) * parseInt(booking.duration) : 0;
                return (
                  <div key={slotTime} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {formatTime(slotTime)} × {durationLabel}
                    </span>
                    <span>£{slotTotal.toFixed(2)}</span>
                  </div>
                );
              })}
              <Separator className="my-2" />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>£{Number(booking.totalPrice).toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Error */}
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Pay Now */}
          <Button
            size="lg"
            className="w-full"
            onClick={handlePayNow}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Pay Now · £{Number(booking.totalPrice).toFixed(2)}
              </>
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            You'll be redirected to Stripe's secure checkout to complete your payment.
          </p>
        </div>
      </div>
    </main>
  );
}
