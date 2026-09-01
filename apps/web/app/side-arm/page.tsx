'use client';

import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@workspace/ui/components/card";
import { Badge } from "@workspace/ui/components/badge";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import Link from "next/link";
import { ArrowLeft, Flame, Trophy, TrendingUp, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/context/auth";
import { isPastSlot } from "@/lib/time";
import { DatePicker } from "@/components/date-picker";


export default function SideArmPage() {
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
      const res = await fetch(`/api/slots?resourceType=side_arm&date=${selectedDate}`);
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
      serviceType: 'side_arm',
      serviceLabel: 'Side Arm Session',
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
            <Badge className="mb-4">Side Arm Sessions</Badge>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
              Match Simulation Training
            </h1>
            <p className="text-lg text-muted-foreground">
              High-intensity batting practice with match-like deliveries.
              Take your game to the next level with realistic match simulation.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-12 md:py-16">
        <div className="container px-4 mx-auto">
          <div className="max-w-md mx-auto">
            <Card className="border-2 border-primary">
              <CardHeader className="text-center">
                <CardTitle><Badge className="bg-primary">Session Rate</Badge></CardTitle>
                <CardDescription>High-intensity training</CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-5xl font-bold text-primary mb-2">£30</div>
                <p className="text-muted-foreground">per hour</p>
                <ul className="mt-6 space-y-3 text-left">
                  <li className="flex items-center gap-2">
                    <Badge variant="outline" className="h-5 w-5 p-0 justify-center text-[10px]">1</Badge>
                    <span>Realistic match-paced deliveries</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Badge variant="outline" className="h-5 w-5 p-0 justify-center text-[10px]">2</Badge>
                    <span>Variable pace and bounce</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Badge variant="outline" className="h-5 w-5 p-0 justify-center text-[10px]">3</Badge>
                    <span>Reaction time improvement</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Badge variant="outline" className="h-5 w-5 p-0 justify-center text-[10px]">4</Badge>
                    <span>Match scenario practice</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-12 md:py-16 bg-muted/20">
        <div className="container px-4 mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">Why Choose Side Arm Training?</h2>
          <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Card className="p-6">
              <Flame className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold mb-2">High Intensity</h3>
              <p className="text-sm text-muted-foreground">Fast-paced training that mimics match conditions</p>
            </Card>
            <Card className="p-6">
              <TrendingUp className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold mb-2">Skill Development</h3>
              <p className="text-sm text-muted-foreground">Improve timing, placement, and shot selection</p>
            </Card>
            <Card className="p-6">
              <Trophy className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold mb-2">Competition Ready</h3>
              <p className="text-sm text-muted-foreground">Build confidence for match day performance</p>
            </Card>
          </div>
        </div>
      </section>

      {/* Requirements */}
      <section className="py-12 md:py-16">
        <div className="container px-4 mx-auto">
          <div className="max-w-2xl mx-auto">
            <Card className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
              <CardContent className="flex gap-4 p-6">
                <AlertCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold mb-1">Recommended for Intermediate+ Players</h3>
                  <p className="text-sm text-muted-foreground">
                    Side arm sessions are best suited for players who have some cricket experience.
                    If you're new to cricket, we recommend starting with lane hire or group sessions first.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Booking */}
      <section id="booking-form" className="py-12 md:py-16 scroll-mt-24">
        <div className="container px-4 mx-auto">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-center">Book Side Arm Session</h2>
            <Card>
              <CardHeader>
                <CardTitle>Book Side Arm Session</CardTitle>
                <CardDescription>All equipment provided. Full safety briefing included.</CardDescription>
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
                      <Label htmlFor="experience">Playing Experience</Label>
                      <Select
                        value={formData.experience}
                        onValueChange={(value) => setFormData({...formData, experience: value})}
                      >
                        <SelectTrigger id="experience">
                          <SelectValue placeholder="Select your level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="intermediate">Club Cricketer</SelectItem>
                          <SelectItem value="advanced">Advanced / Representative</SelectItem>
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
                    Book Side Arm Session
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
            Not sure if side arm is right for you? We can help you decide.
          </p>
          <Button asChild variant="outline">
            <Link href="/contact">Contact Us</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
