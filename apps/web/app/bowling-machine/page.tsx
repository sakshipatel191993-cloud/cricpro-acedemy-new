'use client';

import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@workspace/ui/components/card";
import { Badge } from "@workspace/ui/components/badge";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import Link from "next/link";
import { ArrowLeft, Target, Zap, Clock, Shield } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/context/auth";
import { isPastSlot } from "@/lib/time";
import { DatePicker } from "@/components/date-picker";
import { RateSchedule } from "@/components/rate-schedule";


export default function BowlingMachinePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState('');
  const [slots, setSlots] = useState<Array<{time: string; availableLanes: number; price: string}>>([]);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [totalPrice, setTotalPrice] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    duration: '1',
    name: '',
    email: '',
    phone: '',
    experience: '',
  });

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

  useEffect(() => {
    if (selectedDate) fetchSlots();
  }, [selectedDate]);

  async function fetchSlots() {
    setLoading(true);
    setSlots([]);
    setSelectedSlots([]);
    setTotalPrice(0);
    try {
      const res = await fetch(`/api/slots?resourceType=bowling_machine&date=${selectedDate}`);
      const data = await res.json();
      if (data.success && data.dates.length > 0) setSlots(data.dates[0].slots);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function toggleSlot(time: string) {
    setSelectedSlots(prev =>
      prev.includes(time) ? prev.filter(t => t !== time) : [...prev, time].sort()
    );
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

    sessionStorage.setItem('pendingBooking', JSON.stringify({
      serviceType: 'bowling_machine',
      serviceLabel: 'Bowling Machine',
      bookingDate: selectedDate,
      selectedSlots,
      slots,
      duration: formData.duration,
      totalPrice,
      customerName: formData.name,
      customerEmail: formData.email,
      customerPhone: formData.phone,
      notes: formData.experience ? `Experience: ${formData.experience}` : '',
    }));
    router.push('/booking-confirm');
  }

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="bg-muted/30 py-12 md:py-16">
        <div className="container px-4 mx-auto">
          <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
          <div className="max-w-3xl">
            <Badge className="mb-4">Bowling Machine</Badge>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
              Precision Training
            </h1>
            <p className="text-lg text-muted-foreground">
              Refine your batting technique with focused repetition using our professional
              bowling machine. Perfect for building consistency and confidence.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-12 md:py-16">
        <div className="container px-4 mx-auto">
          <div className="max-w-md mx-auto">
            <RateSchedule offPeakPrice={22} peakPrice={32} />
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-12 md:py-16 bg-muted/20">
        <div className="container px-4 mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">Why Use a Bowling Machine?</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            <Card className="p-6">
              <Target className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold mb-2">Consistent Deliveries</h3>
              <p className="text-sm text-muted-foreground">Practice against repeatable bowling for muscle memory</p>
            </Card>
            <Card className="p-6">
              <Zap className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold mb-2">Rapid Improvement</h3>
              <p className="text-sm text-muted-foreground">More balls faced in an hour than a net session</p>
            </Card>
            <Card className="p-6">
              <Clock className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold mb-2">Flexible Pacing</h3>
              <p className="text-sm text-muted-foreground">Control your own session, take breaks as needed</p>
            </Card>
            <Card className="p-6">
              <Shield className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold mb-2">Safe Environment</h3>
              <p className="text-sm text-muted-foreground">Professional setup with proper safety measures</p>
            </Card>
          </div>
        </div>
      </section>

      {/* Booking */}
      <section id="booking-form" className="py-12 md:py-16 scroll-mt-24">
        <div className="container px-4 mx-auto">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-center">Book Bowling Machine</h2>
            <Card>
              <CardHeader>
                <CardTitle>Book Bowling Machine</CardTitle>
                <CardDescription>Machine hire includes lane access and safety briefing</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-6" onSubmit={handleSubmit}>
                  <div className="space-y-2">
                    <Label>Preferred Date</Label>
                    <DatePicker
                      id="date"
                      value={selectedDate}
                      onChange={setSelectedDate}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Available Slots</Label>
                    {loading ? (
                      <div className="flex items-center justify-center h-24">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : !selectedDate ? (
                      <p className="text-muted-foreground text-sm">Select a date to see available slots.</p>
                    ) : slots.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No slots available on the selected date.</p>
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
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="experience">Experience Level</Label>
                      <Select
                        value={formData.experience}
                        onValueChange={(value) => setFormData({...formData, experience: value})}
                      >
                        <SelectTrigger id="experience">
                          <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="beginner">Beginner</SelectItem>
                          <SelectItem value="intermediate">Intermediate</SelectItem>
                          <SelectItem value="advanced">Advanced</SelectItem>
                        </SelectContent>
                      </Select>
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

                  <div className="flex justify-between items-center text-lg font-bold border-t border-border pt-4">
                    <span>Total:</span>
                    <span>£{totalPrice.toFixed(2)}</span>
                  </div>

                  <Button type="submit" size="lg" className="w-full" disabled={selectedSlots.length === 0 || totalPrice === 0}>
                    Book Bowling Machine
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 bg-muted/20">
        <div className="container px-4 text-center">
          <p className="text-muted-foreground mb-4">
            First time using a bowling machine? We'll provide a full safety briefing.
          </p>
          <Button asChild variant="outline">
            <Link href="/contact">Have Questions?</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
