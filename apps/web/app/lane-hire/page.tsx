'use client';

import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@workspace/ui/components/card";
import { Badge } from "@workspace/ui/components/badge";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import Link from "next/link";
import { ArrowLeft, Clock, Users, Calendar, CheckCircle, Minus, Plus } from "lucide-react";
import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/context/auth";
import { DatePicker } from "@/components/date-picker";
import { RateSchedule } from "@/components/rate-schedule";
import { blockBookingDates, blockBookingMaxEndDate } from "@/lib/block-booking";

interface LaneResource { id: string; name: string; capacity: number }

function subscribeBookingQuery(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  return () => window.removeEventListener('popstate', onChange);
}

function bookingModeFromUrl(): 'single' | 'block' {
  return new URLSearchParams(window.location.search).get('booking') === 'block' ? 'block' : 'single';
}

async function readApiJson(response: Response, fallback: string) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(fallback);
  }
}

export default function LaneHirePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [lanes, setLanes] = useState<LaneResource[]>([]);
  const [lanesLoading, setLanesLoading] = useState(true);
  const [lanesError, setLanesError] = useState('');
  const [selectedLaneId, setSelectedLaneId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [slots, setSlots] = useState<Array<{time: string; availableLanes: number; price: string; priceLabel?: string; standardPrice?: string}>>([]);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [totalPrice, setTotalPrice] = useState(0);
  const [standardTotalPrice, setStandardTotalPrice] = useState(0);
  const [loading, setLoading] = useState(false);
  const [slotsError, setSlotsError] = useState('');
  const requestedBookingMode = useSyncExternalStore(subscribeBookingQuery, bookingModeFromUrl, () => 'single');
  const [bookingModeOverride, setBookingModeOverride] = useState<'single' | 'block' | null>(null);
  const bookingMode = bookingModeOverride ?? requestedBookingMode;
  const [blockEndDate, setBlockEndDate] = useState('');
  const [blockWeekdays, setBlockWeekdays] = useState<number[]>([]);
  const slotsRequestId = useRef(0);
  const blockWeekdaysKey = blockWeekdays.join(',');
  const [formData, setFormData] = useState({
    date: '',
    duration: '1',
    players: '1',
    name: '',
    email: '',
    phone: '',
    notes: ''
  });

  // Pre-fill form from logged-in user
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.user_metadata?.full_name ?? prev.name,
        email: user.email ?? prev.email,
        phone: user.user_metadata?.phone ?? prev.phone,
      }));
    }
  }, [user]);

  // Fetch active lanes on mount
  useEffect(() => {
    async function fetchLanes() {
      try {
        const res = await fetch('/api/resources?type=lane');
        const data = await readApiJson(res, 'Lanes could not be loaded. Please refresh the page.');
        if (!res.ok || !data.success) throw new Error('Lanes could not be loaded. Please refresh the page.');
        const active: LaneResource[] = data.resources.filter((r: any) => r.active);
        setLanes(active);
        if (active.length > 0) setSelectedLaneId(active[0]!.id);
        else setLanesError('No lanes are currently available for online booking.');
      } catch (e) {
        console.error('Failed to fetch lanes:', e);
        setLanesError(e instanceof Error ? e.message : 'Lanes could not be loaded. Please refresh the page.');
      } finally {
        setLanesLoading(false);
      }
    }
    fetchLanes();
  }, []);

  let availabilityDate = selectedDate;
  if (bookingMode === 'block' && formData.date && blockEndDate && blockWeekdays.length > 0) {
    try {
      // The selected range can start before its first requested weekday. Show
      // the same slots and price as a single booking on that first occurrence.
      availabilityDate = blockBookingDates({ startDate: formData.date, endDate: blockEndDate, weekdays: blockWeekdays })[0] ?? selectedDate;
    } catch {
      availabilityDate = selectedDate;
    }
  }

  useEffect(() => {
    if (availabilityDate && selectedLaneId) fetchSlots(availabilityDate);
  }, [availabilityDate, selectedLaneId, formData.duration, blockWeekdaysKey]);

  async function fetchSlots(date: string) {
    const requestId = ++slotsRequestId.current;
    setLoading(true);
    setSlotsError('');
    setSlots([]);
    setSelectedSlots([]);
    setTotalPrice(0);
    setStandardTotalPrice(0);
    try {
      const hasBlockSchedule = bookingMode === 'block' && formData.date && blockEndDate && blockWeekdays.length > 0;
      const res = hasBlockSchedule
        ? await fetch('/api/block-bookings/slots', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resourceId: selectedLaneId, startDate: formData.date, endDate: blockEndDate, weekdays: blockWeekdays, durationMinutes: Number(formData.duration) * 60 }),
          })
        : await fetch(`/api/slots?resourceType=lane&resourceId=${selectedLaneId}&date=${date}&durationMinutes=${Number(formData.duration) * 60}`);
      const data = await readApiJson(res, 'Availability is temporarily unavailable. Please try again.');
      if (requestId !== slotsRequestId.current) return;
      if (!res.ok || !data.success) throw new Error(typeof data.error === 'string' ? data.error : 'Availability could not be checked. Please try again.');
      if (hasBlockSchedule) {
        setSlots(data.slots.map((slot: { time: string; amountPence: number; standardAmountPence: number }) => {
          const total = slot.amountPence / 100;
          const standardTotal = slot.standardAmountPence / 100;
          return { time: slot.time, availableLanes: 1, price: total.toFixed(2), priceLabel: `£${total.toFixed(2)} block total`, ...(standardTotal > total ? { standardPrice: standardTotal.toFixed(2) } : {}) };
        }));
      } else if (data.dates.length > 0) {
        setSlots(data.dates[0].slots);
      }
    } catch (e) {
      if (requestId === slotsRequestId.current) setSlotsError(e instanceof Error ? e.message : 'Availability could not be checked. Please try again.');
    } finally {
      if (requestId === slotsRequestId.current) setLoading(false);
    }
  }

  function resetBookingData() {
    slotsRequestId.current += 1;
    setSelectedDate('');
    setSlots([]);
    setSelectedSlots([]);
    setTotalPrice(0);
    setStandardTotalPrice(0);
    setSlotsError('');
    setLoading(false);
    setBlockEndDate('');
    setBlockWeekdays([]);
    setFormData(prev => ({ ...prev, date: '', duration: '1', players: '1', notes: '' }));
    sessionStorage.removeItem('pendingBooking');
  }

  function switchLane(laneId: string) {
    setSelectedLaneId(laneId);
    resetBookingData();
  }

  function switchBookingMode(mode: 'single' | 'block') {
    if (mode === bookingMode) return;
    setBookingModeOverride(mode);
    resetBookingData();
  }

  function toggleSlot(time: string) {
    setSelectedSlots(prev =>
      prev.includes(time) ? [] : [time]
    );
  }

  function adjustPlayers(delta: number) {
    setFormData(prev => {
      const next = Math.min(6, Math.max(1, parseInt(prev.players) + delta));
      return { ...prev, players: String(next) };
    });
  }

  const blockMaxEndDate = blockBookingMaxEndDate(formData.date);
  useEffect(() => {
    let cancelled = false;
    const singlePrice = () => {
      let price = 0;
      selectedSlots.forEach(slotTime => {
        const slot = slots.find(s => s.time === slotTime);
        if (slot) price += parseFloat(slot.price);
      });
      setTotalPrice(price);
      setStandardTotalPrice(price);
    };
    if (bookingMode !== 'block' || selectedSlots.length !== 1 || !selectedLaneId || !formData.date || !blockEndDate || blockWeekdays.length === 0) {
      singlePrice();
      return () => { cancelled = true; };
    }
    try { blockBookingDates({ startDate: formData.date, endDate: blockEndDate, weekdays: blockWeekdays }); }
    catch { setTotalPrice(0); setStandardTotalPrice(0); return () => { cancelled = true; }; }
    setTotalPrice(0);
    setStandardTotalPrice(0);
    setSlotsError('');
    const controller = new AbortController();
    void fetch('/api/block-bookings/preview', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({ resourceId: selectedLaneId, startDate: formData.date, endDate: blockEndDate, weekdays: blockWeekdays, startTime: selectedSlots[0], durationMinutes: Number(formData.duration) * 60 }),
    }).then(async (response) => {
      const data = await readApiJson(response, 'Availability is temporarily unavailable. Please try again.');
      if (!response.ok || !data.success) throw new Error(data.error || 'Availability could not be checked.');
      if (!cancelled) {
        setTotalPrice(data.quote.amountPence / 100);
        setStandardTotalPrice((data.quote.standardAmountPence ?? data.quote.amountPence) / 100);
      }
    }).catch((error) => {
      if (!cancelled) {
        setTotalPrice(0);
        setStandardTotalPrice(0);
        setSlotsError(error instanceof Error ? error.message : 'Availability could not be checked.');
      }
    });
    return () => { cancelled = true; controller.abort(); };
  }, [bookingMode, selectedSlots, selectedLaneId, formData.date, formData.duration, blockEndDate, blockWeekdays, slots]);

  function formatTime(time: string) {
    const hour = Number(time.slice(0, 2));
    const minute = time.slice(3, 5);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    return `${hour % 12 || 12}:${minute} ${suffix}`;
  }

  function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (selectedSlots.length === 0) { alert("Please select one start time."); return; }
    if (totalPrice === 0) { alert("Please ensure selected slots have prices."); return; }
    if (!selectedLaneId) { alert("Please select a lane."); return; }

    let blockDates: string[] = [];
    if (bookingMode === 'block') {
      try { blockDates = blockBookingDates({ startDate: formData.date, endDate: blockEndDate, weekdays: blockWeekdays }); }
      catch (error) { alert(error instanceof Error ? error.message : 'Check your block booking dates.'); return; }
    }
    const lane = lanes.find(l => l.id === selectedLaneId);
    sessionStorage.setItem('pendingBooking', JSON.stringify({
      serviceType: 'lane_hire',
      serviceLabel: `Lane Hire — ${lane?.name ?? 'Lane'}`,
      resourceId: selectedLaneId,
      bookingDate: formData.date,
      selectedSlots,
      slots,
      duration: formData.duration,
      totalPrice,
      customerName: formData.name,
      customerEmail: formData.email,
      customerPhone: formData.phone,
      playerCount: parseInt(formData.players),
      notes: formData.notes,
      bookingMode,
      ...(bookingMode === 'block' ? { blockSchedule: { endDate: blockEndDate, weekdays: blockWeekdays, dates: blockDates } } : {}),
    }));
    router.push('/booking-confirm');
  }

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="public-page-hero">
        <div className="container px-4 mx-auto">
          <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
          <div className="max-w-3xl">
            <Badge className="mb-4">Lane Hire</Badge>
            <h1 className="mb-4 text-4xl font-semibold leading-tight tracking-tight md:text-5xl lg:text-6xl">
              Practice at Your Own Pace
            </h1>
            <p className="text-lg text-muted-foreground">
              Book our premium indoor lanes for solo practice or play with friends.
              Professional environment with floodlight-quality lighting.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-12 md:py-16">
        <div className="container px-4 mx-auto">
          <div className="max-w-md mx-auto">
            <RateSchedule offPeakPrice={15} peakPrice={25} />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 md:py-16 bg-muted/20">
        <div className="container px-4 mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">What You Get</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            <Card className="public-feature-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold">Extended Hours</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Weekdays 3 PM–11 PM · Weekends 9 AM–11 PM
              </p>
            </Card>
            <Card className="public-feature-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold">Up to 6 Players</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Perfect for groups or team practice
              </p>
            </Card>
            <Card className="public-feature-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold">Flexible Booking</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Book 1-3 hours at a time
              </p>
            </Card>
            <Card className="public-feature-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold">Professional Lanes</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                4 indoor lanes with premium setup
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Booking Form Section */}
      <section id="booking-form" className="py-12 md:py-16 scroll-mt-24">
        <div className="container px-4 mx-auto">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-center">Book a Lane</h2>

            {/* Lane Tabs */}
            {lanes.length > 0 && (
              <div className="flex gap-2 mb-6 border-b border-border">
                {lanes.map((lane) => (
                  <button
                    key={lane.id}
                    onClick={() => switchLane(lane.id)}
                    className={`px-5 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
                      selectedLaneId === lane.id
                        ? 'border-primary text-primary bg-primary/5'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                    }`}
                  >
                    {lane.name}
                    {/* <span className="ml-1.5 text-xs opacity-60">Up to {lane.capacity} players</span> */}
                  </button>
                ))}
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle>
                  {lanes.find(l => l.id === selectedLaneId)?.name ?? 'Book Your Lane'}
                </CardTitle>
                <CardDescription>
                  Select date, check availability, and confirm your booking
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="public-form space-y-6" onSubmit={handleSubmit}>
                  <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Booking type">
                      <Button type="button" variant={bookingMode === 'single' ? 'default' : 'outline'} size="sm" onClick={() => switchBookingMode('single')}>Single booking</Button>
                      <Button type="button" variant={bookingMode === 'block' ? 'default' : 'outline'} size="sm" onClick={() => switchBookingMode('block')}>Block booking</Button>
                    </div>
                    <p className="text-sm text-muted-foreground">{bookingMode === 'block' ? 'Repeat the same lane, time and duration on selected weekdays for up to four months.' : 'Book one session.'}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Preferred Date</Label>
                    <DatePicker
                      id="date"
                      value={formData.date}
                      onChange={(value) => {
                        setFormData({...formData, date: value});
                        setSelectedDate(value);
                        if (blockEndDate && (!value || blockEndDate > (blockBookingMaxEndDate(value) ?? ''))) setBlockEndDate('');
                      }}
                    />
                  </div>

                  {bookingMode === 'block' && <div className="space-y-4 rounded-lg border border-border p-4">
                    <div className="space-y-2">
                      <Label>Repeat until</Label>
                      <DatePicker id="repeat-until" value={blockEndDate} minDate={formData.date || undefined} maxDate={blockMaxEndDate ?? undefined} onChange={setBlockEndDate} />
                      {blockMaxEndDate && <p className="text-xs text-muted-foreground">Choose a date up to {new Date(`${blockMaxEndDate}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>}
                    </div>
                    <div className="space-y-2"><Label>Repeat on</Label><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((label, day) => <Button key={label} type="button" variant={blockWeekdays.includes(day) ? 'default' : 'outline'} size="sm" onClick={() => setBlockWeekdays((value) => value.includes(day) ? value.filter((item) => item !== day) : [...value, day])}>{label}</Button>)}
                    </div></div>
                    {formData.date && blockEndDate && blockWeekdays.length > 0 && <p className="text-sm text-muted-foreground">{(() => { try { return `${blockBookingDates({ startDate: formData.date, endDate: blockEndDate, weekdays: blockWeekdays }).length} sessions will be checked before payment.` } catch (error) { return error instanceof Error ? error.message : 'Check your dates.' } })()}</p>}
                  </div>}

                  <div className="space-y-2">
                    <Label>Available Slots{bookingMode === 'block' && availabilityDate ? ` · first session ${availabilityDate}` : ''}</Label>
                    {lanesError ? (
                      <p role="alert" className="text-destructive text-sm">{lanesError}</p>
                    ) : lanesLoading ? (
                      <p className="text-muted-foreground text-sm">Loading lanes…</p>
                    ) : loading ? (
                      <div className="flex items-center justify-center h-24">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : !formData.date ? (
                      <p className="text-muted-foreground text-sm">Select a date to see available slots. Choose one start time per checkout; prices include the selected duration.</p>
                    ) : slotsError ? (
                      <p role="alert" className="text-destructive text-sm">{slotsError}</p>
                    ) : slots.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No slots available for this lane on the selected date.</p>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                        {slots.map((slot) => {
                          const booked = slot.availableLanes === 0;
                          // Past/blocked intervals are already excluded by the London-time server quote.
                          const disabled = booked;
                          const selected = selectedSlots.includes(slot.time);
                          return (
                            <button
                              key={slot.time}
                              type="button"
                              onClick={() => !disabled && toggleSlot(slot.time)}
                              disabled={disabled}
                              className={`flex flex-col items-center py-2 px-1 rounded-md border text-xs transition-colors ${
                                disabled
                                  ? 'border-border/30 bg-muted/20 text-muted-foreground/40 cursor-not-allowed line-through'
                                  : selected
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-border hover:border-primary/60 hover:bg-primary/5'
                              }`}
                            >
                              <span className="font-semibold text-sm">{formatTime(slot.time)}</span>
                              <span className="opacity-70 mt-0.5">{booked ? 'Unavailable' : 'Available'}</span>
                              {slot.priceLabel ? <span className="font-medium mt-0.5">{slot.standardPrice && <span className="mr-1 opacity-70 line-through">£{slot.standardPrice}</span>}<span>{slot.priceLabel}</span></span> : <span className="font-medium mt-0.5">£{parseFloat(slot.price).toFixed(2)} total</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="duration">Duration</Label>
                      <Select
                        value={formData.duration}
                        onValueChange={(value) => setFormData({...formData, duration: value})}
                        disabled={loading}
                      >
                        <SelectTrigger id="duration">
                          <SelectValue placeholder="Select duration" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 Hour</SelectItem>
                          <SelectItem value="2">2 Hours</SelectItem>
                          <SelectItem value="3">3 Hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Number of Players</Label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => adjustPlayers(-1)}
                          disabled={parseInt(formData.players) <= 1}
                          aria-label="Decrease number of players"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <div className="flex-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-center">
                          <span className="text-lg font-semibold tabular-nums" aria-live="polite">
                            {formData.players}
                          </span>
                          <span className="ml-1.5 text-sm text-muted-foreground">
                            {formData.players === "1" ? "Player" : "Players"}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => adjustPlayers(1)}
                          disabled={parseInt(formData.players) >= 6}
                          aria-label="Increase number of players"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">Up to 6 players per lane</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      placeholder="Enter your name"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="your@email.com"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="07xxx xxx xxx"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Special Requests (Optional)</Label>
                    <Input
                      id="notes"
                      placeholder="Any special requirements"
                      value={formData.notes}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    />
                  </div>

                  <div className="flex justify-between items-center text-lg font-bold border-t border-border pt-4">
                    <span>{bookingMode === 'block' && standardTotalPrice > totalPrice ? 'Discounted block total:' : bookingMode === 'block' ? 'Block total:' : 'Total:'}</span>
                    <span>{bookingMode === 'block' && standardTotalPrice > totalPrice && <span className="mr-2 text-sm font-medium text-muted-foreground line-through">£{standardTotalPrice.toFixed(2)}</span>}£{totalPrice.toFixed(2)}</span>
                  </div>

                  <Button type="submit" size="lg" className="w-full" disabled={selectedSlots.length === 0 || totalPrice === 0}>
                    Confirm Booking
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 bg-muted/20">
        <div className="container px-4 text-center">
          <h3 className="text-xl font-semibold mb-4">Questions about lane hire?</h3>
          <p className="text-muted-foreground mb-6">
            Our team is happy to help you plan your training session
          </p>
          <Button asChild variant="outline">
            <Link href="/contact">Contact Us</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
