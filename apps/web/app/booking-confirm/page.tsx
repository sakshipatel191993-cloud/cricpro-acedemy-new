'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@workspace/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card';
import { Calendar, CreditCard, ArrowLeft, Loader2 } from 'lucide-react';
import { LocationDirections } from '@/components/location-directions';
import { WhatsAppOptIn } from '@/components/whatsapp-opt-in';
import { supabase } from '@/lib/services/supabase';
import { CouponField } from '@/components/coupon-field';
import type { CouponSelection } from '@/lib/coupons';

interface PendingBooking {
  serviceType: string; serviceLabel: string; resourceId?: string; bookingDate: string;
  selectedSlots: string[]; duration: string; customerName: string; customerEmail: string;
  customerPhone?: string; playerCount?: number; notes?: string;
  totalPrice?: number;
  bookingMode?: 'single' | 'block';
  blockSchedule?: { endDate: string; weekdays: number[]; dates: string[] };
}
interface ReviewedQuote {
  id: string; expiresAt: string; amountPence: number; resourceName: string;
  standardAmountPence?: number; discountPence?: number;
  startAt: string; endAt: string;
  dates?: string[];
  occurrences?: { bookingDate: string; amountPence: number; standardAmountPence?: number; discountPence?: number }[];
  breakdown: { startTime: string; endTime: string; hourlyPence: number; minutes: number }[];
}

export default function BookingConfirmPage() {
  const router = useRouter();
  const [booking, setBooking] = useState<PendingBooking | null>(null);
  const [quote, setQuote] = useState<ReviewedQuote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [whatsappConsent, setWhatsappConsent] = useState(false);
  const [notice, setNotice] = useState('');
  const [coupon, setCoupon] = useState<CouponSelection | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);

  async function fetchQuote(pending: PendingBooking) {
    setLoadingQuote(true); setQuote(null); setCoupon(null); setCouponBusy(false); setError('');
    try {
      if (!Array.isArray(pending.selectedSlots) || pending.selectedSlots.length !== 1) throw new Error('Please go back and choose one start time per checkout.');
      const response = await fetch(pending.bookingMode === 'block' ? '/api/block-bookings/quote' : '/api/quotes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceType: pending.serviceType, resourceId: pending.resourceId,
          bookingDate: pending.bookingDate, startTime: pending.selectedSlots[0],
          durationMinutes: Number(pending.duration) * 60,
          ...(pending.bookingMode === 'block' ? { startDate: pending.bookingDate, endDate: pending.blockSchedule?.endDate, weekdays: pending.blockSchedule?.weekdays } : {}) }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not load your quote.');
      setQuote(data.quote);
      sessionStorage.setItem('reviewedBookingQuote', JSON.stringify({ pending: JSON.stringify(pending), quote: data.quote }));
      setNotice('This is the current server-calculated price. Please review it before paying. A quote does not reserve availability.');
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not load your quote. Your selected booking is still saved.'); }
    finally { setLoadingQuote(false); }
  }

  useEffect(() => {
    const raw = sessionStorage.getItem('pendingBooking');
    if (!raw) { router.replace('/'); return; }
    try {
      const pending = JSON.parse(raw) as PendingBooking;
      setBooking(pending);
      const saved = JSON.parse(sessionStorage.getItem('reviewedBookingQuote') || 'null');
      if (saved?.pending === JSON.stringify(pending) && saved?.quote?.id && (pending.bookingMode !== 'block' || Array.isArray(saved.quote.occurrences)) && Date.parse(saved.quote.expiresAt) > Date.now()) setQuote(saved.quote);
      else void fetchQuote(pending);
    } catch { router.replace('/'); }
  }, [router]);

  async function handlePayNow() {
    if (!booking || !quote || submitting || couponBusy) return;
    if (Date.parse(quote.expiresAt) <= Date.now()) {
      setError('Your quote has expired. Please return to choose your time again before paying.');
      return;
    }
    setSubmitting(true); setError('');
    try {
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(booking.bookingMode === 'block' ? '/api/block-bookings' : '/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session.session?.access_token ? { Authorization: `Bearer ${session.session.access_token}` } : {}) },
        body: JSON.stringify({ quoteId: quote.id, customerName: booking.customerName, customerEmail: booking.customerEmail,
          customerPhone: booking.customerPhone, playerCount: booking.playerCount, notes: booking.notes, whatsappConsent,
          ...(coupon && booking.bookingMode !== 'block' && booking.serviceType === 'lane_hire' ? { couponCode: coupon.code, couponVersion: coupon.version } : {}) }),
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.paymentUrl) throw new Error(data.error || 'Could not start checkout.');
      // Keep the scoped quote in this tab for retry after interrupted navigation.
      window.location.assign(data.paymentUrl);
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not start checkout. Please retry.'); setSubmitting(false); }
  }

  if (!booking) return <main className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" aria-label="Loading booking" /></main>;
  const money = (pence: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);
  const savedTotalPence = Math.round((booking.totalPrice ?? 0) * 100);
  const displayedDates = quote?.dates ?? booking.blockSchedule?.dates ?? [];
  return (
    <main className="min-h-screen py-12 md:py-16">
      <div className="container px-4 mx-auto max-w-2xl space-y-5">
        <Button variant="ghost" onClick={() => router.back()} disabled={submitting}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
        <div><h1 className="text-2xl md:text-3xl font-bold">Review Your Booking</h1><p className="text-muted-foreground mt-2">{booking.bookingMode === 'block' ? 'Review every session in your block before one secure payment.' : 'One session, one payment.'} All session times are UK local time.</p></div>
        <Card><CardHeader><CardTitle>Session details</CardTitle></CardHeader><CardContent className="space-y-3">
          <p className="font-medium">{booking.bookingMode === 'block' ? `Block booking · ${booking.serviceLabel}` : booking.serviceLabel}</p>
          <p className="flex gap-2"><Calendar className="h-5 w-5" />{booking.bookingMode === 'block' && booking.blockSchedule ? `${booking.blockSchedule.dates.length} sessions · ${booking.bookingDate} to ${booking.blockSchedule.endDate}` : `${booking.bookingDate} · ${booking.selectedSlots?.join(', ')} · ${booking.duration} hour(s)`}</p>
          {booking.bookingMode === 'block' && <p className="text-sm text-muted-foreground">{displayedDates.join(', ')}</p>}
          <p>{quote?.resourceName ?? booking.serviceLabel}</p>
          {booking.playerCount && <p>{booking.playerCount} player(s)</p>}
          {booking.notes && <p className="text-muted-foreground">{booking.notes}</p>}
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Your details</CardTitle></CardHeader><CardContent className="space-y-2">
          <p>{booking.customerName}</p><p>{booking.customerEmail}</p><p>{booking.customerPhone}</p>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Where to find us</CardTitle></CardHeader><CardContent><LocationDirections /></CardContent></Card>
        <Card><CardHeader><CardTitle>Price summary</CardTitle></CardHeader><CardContent className="space-y-3">
          {loadingQuote && <p role="status">Checking live price and availability…</p>}
          {quote ? <>
            {booking.bookingMode !== 'block' && quote.breakdown.map((part, index) => <div className="flex justify-between text-sm gap-3" key={index}><span>{part.startTime}–{part.endTime} ({part.minutes} min)</span><span>{money(part.hourlyPence)} / hour</span></div>)}
            <div className="border-t pt-3">
              {booking.bookingMode === 'block' ? <><div className="space-y-2">{quote.occurrences?.map(part => <div key={part.bookingDate} className="flex justify-between text-sm"><span>{part.bookingDate}</span><span>{part.standardAmountPence && part.discountPence ? <><span className="mr-2 text-muted-foreground line-through">{money(part.standardAmountPence)}</span><span className="font-medium text-primary">{money(part.amountPence)}</span></> : money(part.amountPence)}</span></div>)}</div>{quote.discountPence ? <div className="space-y-1"><div className="flex justify-between text-sm text-muted-foreground line-through"><span>Original block total</span><span>{money(quote.standardAmountPence ?? quote.amountPence)}</span></div><div className="flex justify-between text-lg font-bold text-primary"><span>Block total ({quote.dates?.length ?? 0} sessions)</span><span>{money(quote.amountPence)}</span></div></div> : <div className="flex justify-between text-lg font-bold"><span>Block total ({quote.dates?.length ?? 0} sessions)</span><span>{money(quote.amountPence)}</span></div>}</> : coupon ? <>
                <div className="flex justify-between text-sm text-muted-foreground line-through"><span>Original price</span><span>{money(quote.amountPence)}</span></div>
                <div className="mt-1 flex justify-between text-lg font-bold text-primary"><span>Discounted total</span><span>{money(coupon.totalMinor)}</span></div>
              </> : <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{money(quote.amountPence)}</span></div>}
            </div>
            <p className="text-xs text-muted-foreground">Quote valid until {new Date(quote.expiresAt).toLocaleTimeString('en-GB', { timeZone: 'Europe/London' })} UK time. Totals are rounded once to the nearest penny.</p>
          </> : booking.bookingMode === 'block' && savedTotalPence > 0 ? <>
            <div className="space-y-2">{displayedDates.map(date => <div key={date} className="text-sm">{date} · {booking.selectedSlots[0]}</div>)}</div>
            <div className="flex justify-between border-t pt-3 text-lg font-bold"><span>Saved block total ({displayedDates.length} sessions)</span><span>{money(savedTotalPence)}</span></div>
            <p className="text-xs text-muted-foreground">Your selection is saved in this tab. Payment will enable after the secure server quote is available.</p>
          </> : !loadingQuote ? <p>No current quote available.</p> : null}
        </CardContent></Card>
        {notice && <p className="text-sm text-muted-foreground" role="status">{notice}</p>}
        {quote && booking.bookingMode !== 'block' && booking.serviceType === 'lane_hire' && <CouponField key={quote.id} quoteId={quote.id} email={booking.customerEmail} value={coupon} onChange={setCoupon} onBusyChange={setCouponBusy} disabled={submitting || loadingQuote} />}
        {booking.bookingMode === 'block' && <p className="text-sm text-muted-foreground">Weekend sessions in blocks of six weeks or more are automatically reduced from £25.00 to £22.50 per hour. Coupons do not apply to block bookings.</p>}
        {error && <div role="alert" className="space-y-3 rounded-md bg-destructive/10 p-4 text-sm text-destructive"><p>{error}</p><Button type="button" variant="outline" size="sm" onClick={() => void fetchQuote(booking)} disabled={loadingQuote || submitting}>Retry secure quote</Button></div>}
        <WhatsAppOptIn checked={whatsappConsent} onChange={setWhatsappConsent} disabled={submitting} />
        <Button size="lg" className="w-full" onClick={handlePayNow} disabled={!quote || loadingQuote || submitting || couponBusy}>
          {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing…</> : <><CreditCard className="mr-2 h-4 w-4" />Pay now{quote ? ` · ${money(coupon?.totalMinor ?? quote.amountPence)}` : ''}</>}
        </Button>
        <p className="text-center text-xs text-muted-foreground">Continue as a guest. An account is not required. Payment is completed on Stripe’s secure checkout.</p>
      </div>
    </main>
  );
}
