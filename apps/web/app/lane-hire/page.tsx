'use client';

import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@workspace/ui/components/card";
import { Badge } from "@workspace/ui/components/badge";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import Link from "next/link";
import { ArrowLeft, Clock, Users, Calendar, CheckCircle, Minus, Plus } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/context/auth";
import { isPastSlot } from "@/lib/time";
import { DatePicker } from "@/components/date-picker";
import { RateSchedule } from "@/components/rate-schedule";

interface LaneResource { id: string; name: string; capacity: number }

export default function LaneHirePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [lanes, setLanes] = useState<LaneResource[]>([]);
  const [selectedLaneId, setSelectedLaneId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [slots, setSlots] = useState<Array<{time: string; availableLanes: number; price: string}>>([]);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [totalPrice, setTotalPrice] = useState(0);
  const [loading, setLoading] = useState(false);
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
        const data = await res.json();
        if (data.success) {
          const active: LaneResource[] = data.resources.filter((r: any) => r.active);
          setLanes(active);
          if (active.length > 0) setSelectedLaneId(active[0]!.id);
        }
      } catch (e) {
        console.error('Failed to fetch lanes:', e);
      }
    }
    fetchLanes();
  }, []);

  // Refetch slots when lane or date changes
  useEffect(() => {
    if (selectedDate && selectedLaneId) fetchSlots();
  }, [selectedDate, selectedLaneId]);

  async function fetchSlots() {
    setLoading(true);
    setSlots([]);
    setSelectedSlots([]);
    setTotalPrice(0);
    try {
      const res = await fetch(`/api/slots?resourceType=lane&resourceId=${selectedLaneId}&date=${selectedDate}`);
      const data = await res.json();
      if (data.success && data.dates.length > 0) {
        setSlots(data.dates[0].slots);
      }
    } catch (e) {
      console.error('Failed to fetch slots:', e);
    } finally {
      setLoading(false);
    }
  }

  function switchLane(laneId: string) {
    setSelectedLaneId(laneId);
    setSelectedSlots([]);
    setTotalPrice(0);
    setSlots([]);
  }

  function toggleSlot(time: string) {
    setSelectedSlots(prev =>
      prev.includes(time) ? prev.filter(t => t !== time) : [...prev, time].sort()
    );
  }

  function adjustPlayers(delta: number) {
    setFormData(prev => {
      const next = Math.min(6, Math.max(1, parseInt(prev.players) + delta));
      return { ...prev, players: String(next) };
    });
  }

  useEffect(() => {
    let price = 0;
    selectedSlots.forEach(slotTime => {
      const slot = slots.find(s => s.time === slotTime);
      if (slot) price += parseFloat(slot.price) * parseInt(formData.duration);
    });
    setTotalPrice(price);
  }, [selectedSlots, slots, formData.duration]);

  function formatTime(time: string) {
    const hour = parseInt(time.split(':')[0] ?? '0');
    const min = time.split(':')[1] ?? '00';
    if (hour === 0) return `12:${min} AM`;
    if (hour < 12) return `${hour}:${min} AM`;
    if (hour === 12) return `12:${min} PM`;
    return `${hour - 12}:${min} PM`;
  }

  function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (selectedSlots.length === 0) { alert("Please select at least one time slot."); return; }
    if (totalPrice === 0) { alert("Please ensure selected slots have prices."); return; }
    if (!selectedLaneId) { alert("Please select a lane."); return; }

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
    }));
    router.push('/booking-confirm');
  }

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-muted/30 py-12 md:py-16">
        <div className="container px-4 mx-auto">
          <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
          <div className="max-w-3xl">
            <Badge className="mb-4">Lane Hire</Badge>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
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
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold">12-Hour Access</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Open 12 PM to 12 AM, 7 days a week
              </p>
            </Card>
            <Card className="p-6">
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
            <Card className="p-6">
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
            <Card className="p-6">
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
      <section className="py-12 md:py-16">
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
                <form className="space-y-6" onSubmit={handleSubmit}>
                  <div className="space-y-2">
                    <Label>Preferred Date</Label>
                    <DatePicker
                      id="date"
                      value={formData.date}
                      onChange={(value) => {
                        setFormData({...formData, date: value});
                        setSelectedDate(value);
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Available Slots</Label>
                    {loading ? (
                      <div className="flex items-center justify-center h-24">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : !formData.date ? (
                      <p className="text-muted-foreground text-sm">Select a date to see available slots.</p>
                    ) : slots.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No slots available for this lane on the selected date.</p>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                        {slots.map((slot) => {
                          const booked = slot.availableLanes === 0;
                          const isPast = isPastSlot(slot.time, selectedDate);
                          const disabled = booked || isPast;
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
                              <span className="opacity-70 mt-0.5">{booked ? 'Booked' : isPast ? 'Past' : 'Available'}</span>
                              <span className="font-medium mt-0.5">£{parseFloat(slot.price).toFixed(2)}/hr</span>
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
                        disabled={selectedSlots.length === 0}
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
                    <span>Total:</span>
                    <span>£{totalPrice.toFixed(2)}</span>
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