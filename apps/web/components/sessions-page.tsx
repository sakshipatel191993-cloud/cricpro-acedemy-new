"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@workspace/ui/components/card";
import { Badge } from "@workspace/ui/components/badge";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import Link from "next/link";
import { ArrowLeft, Calendar, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { DbGroupSession } from "@/lib/db/schema";

import { availableSessions } from '@/lib/session-options';
import { WhatsAppOptIn } from '@/components/whatsapp-opt-in';
import { isSessionAgeAllowed, sessionAgeOptions } from '@/lib/session-age';
import { supabase } from '@/lib/services/supabase';

export default function SessionsPage({ masterclass = false }: { masterclass?: boolean }) {
  const [coach, setCoach] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [playerAge, setPlayerAge] = useState('');
  const [loadError, setLoadError] = useState(false);
  const [sessions, setSessions] = useState<DbGroupSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const checkoutDraft = useRef<{ fingerprint: string; requestId: string } | null>(null);
  const submittingRef = useRef(false);

  const visibleSessions = availableSessions(sessions, masterclass ? 'masterclass' : 'group', coach);
  const selected = visibleSessions.find(session => session.id === sessionId);
  const allowedAges = sessionAgeOptions(selected?.age_group);
  const coaches = [...new Set(sessions.map(session => session.coach_name).filter((name): name is string => !!name))];
  const price = selected ? Number(selected.price).toFixed(2) : null;

  useEffect(() => {
    async function fetchSessions() {
      try {
        const response = await fetch(`/api/group-sessions?kind=${masterclass ? "masterclass" : "group"}`);
        const data = await response.json();
        if (data.success) {
          setSessions(data.sessions);
        } else { setLoadError(true); }
      } catch (error) {
        setLoadError(true);
        console.error("Failed to fetch sessions:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchSessions();
  }, [masterclass]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submittingRef.current) return;
    if (!selected || selected.current_players >= selected.max_players) {
      toast.error('Choose an available session');
      return;
    }
    if (!isSessionAgeAllowed(playerAge, selected.age_group)) {
      toast.error(`Choose a player age matching this session: ${selected.age_group}`);
      return;
    }
    setSubmitting(true);
    submittingRef.current = true;

    const formData = new FormData(e.currentTarget);
    const payload = {
      session_id: formData.get("session_id"),
      player_name: formData.get("player_name"),
      player_age: playerAge,
      skill_level: formData.get("skill_level"),
      parent_name: formData.get("parent_name"),
      parent_phone: formData.get("parent_phone"),
      whatsappConsent: formData.get("whatsappConsent") === "yes",
      parent_email: formData.get("parent_email"),
      emergency_contact: formData.get("emergency_contact"),
    };
    const fingerprint = JSON.stringify(payload);
    if (!checkoutDraft.current || checkoutDraft.current.fingerprint !== fingerprint) {
      checkoutDraft.current = { fingerprint, requestId: crypto.randomUUID() };
    }
    const requestBody = JSON.stringify({ ...payload, requestId: checkoutDraft.current.requestId });

    try {
      const auth = supabase ? (await supabase.auth.getSession()).data.session : null;
      const submit = () => fetch("/api/group-session-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth.access_token}` } : {}) },
        body: requestBody,
      });
      let response = await submit();
      // First request establishes a private HttpOnly browser capability. Repeat
      // once with the SAME request ID, never a new booking ID on network retries.
      if (response.status === 428) response = await submit();

      const data = await response.json();

      if (data.success && data.paymentUrl) {
        window.location.assign(data.paymentUrl);
      } else {
        toast.error(data.error || "Failed to book session");
      }
    } catch {
      toast.error("An error occurred. Please try again.");
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
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
            <Badge className="mb-4">{masterclass ? 'Masterclass' : 'Group Sessions'}</Badge>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
              {masterclass ? 'Learn from the Experts' : 'Level Up Together'}
            </h1>
            <p className="text-lg text-muted-foreground">
              {masterclass ? 'Choose your coach and join a focused cricket masterclass to develop your game.' : 'Choose a session for your age group. Build skills, make friends, and develop your game in a supportive environment.'}
            </p>
          </div>
        </div>
      </section>

      {/* Pricing & Schedule */}
      <section className="py-12 md:py-16">
        <div className="container px-4 mx-auto">
          {masterclass && (
            <div className="max-w-5xl mx-auto mb-8 space-y-2">
              <Label htmlFor="coach_name">Coach Name</Label>
              <select id="coach_name" value={coach} onChange={event => { setCoach(event.target.value); setSessionId(''); setPlayerAge(''); }} className="w-full sm:max-w-sm rounded-md border bg-background px-3 py-2" disabled={loading || submitting}>
                <option value="">All coaches</option>
                {coaches.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
          )}
          <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Pricing */}
            <Card className="border-2 border-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge className="bg-primary">Session Pass</Badge>
                </CardTitle>
                <CardDescription>Per session pricing</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-5xl font-bold text-primary mb-2">{price ? `£${price}` : 'Choose a session'}</div>
                <p className="text-muted-foreground">per session</p>
                <ul className="mt-6 space-y-3">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span>Structured coaching format</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span>{masterclass ? (selected ? `Max ${selected.max_players} players per session` : 'Capacity shown for each class') : 'Max 12 players per session'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span>{selected?.age_group || 'Age group shown for each session'}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span>All skill levels</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Schedule */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Session Schedule
                </CardTitle>
                <CardDescription>Weekly sessions available</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {visibleSessions.length > 0 ? (
                      visibleSessions.map((session) => (
                        <div key={session.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                          <div>
                            <span className="font-medium">{session.title}</span>
                            <p className="text-xs text-muted-foreground">{session.age_group}{masterclass && ` • ${session.coach_name} • £${Number(session.price).toFixed(2)}`}</p>
                          </div>
                          <Badge variant="secondary">{session.schedule}</Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-muted-foreground py-4">{loadError ? 'Unable to load sessions. Please refresh and try again.' : 'No sessions scheduled currently.'}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* What to Expect */}
      <section className="py-12 md:py-16 bg-muted/20">
        <div className="container px-4 mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">What Your Child Will Learn</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Card className="p-6">
              <h3 className="font-semibold mb-2">Batting Fundamentals</h3>
              <p className="text-sm text-muted-foreground">
                Grip, stance, shot selection, and technique development
              </p>
            </Card>
            <Card className="p-6">
              <h3 className="font-semibold mb-2">Bowling Skills</h3>
              <p className="text-sm text-muted-foreground">
                Run-up, action, line and length control
              </p>
            </Card>
            <Card className="p-6">
              <h3 className="font-semibold mb-2">Fielding & Catching</h3>
              <p className="text-sm text-muted-foreground">
                Ground fielding, catches, and throwing accuracy
              </p>
            </Card>
            <Card className="p-6">
              <h3 className="font-semibold mb-2">Game Awareness</h3>
              <p className="text-sm text-muted-foreground">
                Reading the game, positioning, and decision making
              </p>
            </Card>
            <Card className="p-6">
              <h3 className="font-semibold mb-2">Match Practice</h3>
              <p className="text-sm text-muted-foreground">
                Scrimmages and mini-games in a fun environment
              </p>
            </Card>
            <Card className="p-6">
              <h3 className="font-semibold mb-2">Teamwork</h3>
              <p className="text-sm text-muted-foreground">
                Building friendships and learning to work together
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Booking Form */}
      <section id="booking-form" className="py-12 md:py-16 scroll-mt-24">
        <div className="container px-4 mx-auto">
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Book {masterclass ? 'a Masterclass' : 'a Session'}</CardTitle>
                <CardDescription>
                  Sign up for our upcoming {masterclass ? 'masterclasses' : 'group coaching sessions'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="session_id">Select Session</Label>
                    <Select name="session_id" required value={sessionId} disabled={submitting} onValueChange={(value) => { setSessionId(value ?? ""); setPlayerAge(''); }}>
                      <SelectTrigger id="session_id">
                        <SelectValue placeholder="Choose a session" />
                      </SelectTrigger>
                      <SelectContent>
                        {visibleSessions.map((session) => (
                          <SelectItem key={session.id} value={session.id} disabled={session.current_players >= session.max_players}>
                            {session.title} ({session.schedule}) {`— £${Number(session.price).toFixed(2)}`} - {session.max_players - session.current_players} spots left
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="player_name">Player&apos;s Name</Label>
                      <Input id="player_name" name="player_name" placeholder="Child's full name" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="player_age">Player&apos;s Age</Label>
                      <Select key={sessionId} name="player_age" required value={playerAge} onValueChange={(value) => setPlayerAge(value ?? '')} disabled={!allowedAges.length}>
                        <SelectTrigger id="player_age">
                          <SelectValue placeholder={selected ? 'Select age' : 'Choose a session first'} />
                        </SelectTrigger>
                        <SelectContent>
                          {allowedAges.map((age) => (
                            <SelectItem key={age} value={age.toString()}>{age} years</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">{selected ? (allowedAges.length ? `Eligible ages: ${allowedAges[0]}–${allowedAges[allowedAges.length - 1]} years` : 'Age group unavailable. Please contact us before booking.') : 'Select a session to see eligible ages.'}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="skill_level">Skill Level</Label>
                    <Select name="skill_level" required>
                      <SelectTrigger id="skill_level">
                        <SelectValue placeholder="Select skill level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">Beginner - New to cricket</SelectItem>
                        <SelectItem value="intermediate">Intermediate - Playing club cricket</SelectItem>
                        <SelectItem value="advanced">Advanced - Representative level</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="parent_name">Parent/Guardian Name</Label>
                      <Input id="parent_name" name="parent_name" placeholder="Your full name" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="parent_phone">Contact Number</Label>
                      <Input id="parent_phone" name="parent_phone" type="tel" placeholder="07xxx xxx xxx" required />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="parent_email">Email Address</Label>
                    <Input id="parent_email" name="parent_email" type="email" placeholder="your@email.com" required />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="emergency_contact">Emergency Contact</Label>
                    <Input id="emergency_contact" name="emergency_contact" placeholder="Name & number" required />
                  </div>

                  <WhatsAppOptIn disabled={submitting} />
                  <p className="text-sm text-muted-foreground">Your place is confirmed after successful payment through Stripe.</p>
                  <Button type="submit" size="lg" className="w-full" disabled={submitting || loading || !allowedAges.length || (!selected || selected.current_players >= selected.max_players)}>
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      (price ? `Continue to Payment - £${price}` : "Choose a Session")
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 bg-muted/20">
        <div className="container px-4 mx-auto text-center">
          <h3 className="text-xl font-semibold mb-4">Questions about {masterclass ? 'masterclasses' : 'group sessions'}?</h3>
          <p className="text-muted-foreground mb-6">
            We&apos;re happy to help find the right session for your child
          </p>
          <Button asChild variant="outline">
            <Link href="/contact">Contact Us</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
