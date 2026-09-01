"use client";

import { useState, useEffect } from "react";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@workspace/ui/components/card";
import { Badge } from "@workspace/ui/components/badge";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import Link from "next/link";
import { ArrowLeft, Users, Calendar, Clock, CheckCircle, Star, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { DbGroupSession } from "@/lib/db/schema";

export default function GroupSessionsPage() {
  const [sessions, setSessions] = useState<DbGroupSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [booked, setBooked] = useState(false);

  useEffect(() => {
    async function fetchSessions() {
      try {
        const response = await fetch("/api/group-sessions");
        const data = await response.json();
        if (data.success) {
          setSessions(data.sessions);
        }
      } catch (error) {
        console.error("Failed to fetch sessions:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchSessions();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      session_id: formData.get("session_id"),
      player_name: formData.get("player_name"),
      player_age: formData.get("player_age"),
      skill_level: formData.get("skill_level"),
      parent_name: formData.get("parent_name"),
      parent_phone: formData.get("parent_phone"),
      parent_email: formData.get("parent_email"),
      emergency_contact: formData.get("emergency_contact"),
    };

    try {
      const response = await fetch("/api/group-session-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Booking successful!");
        setBooked(true);
      } else {
        toast.error(data.error || "Failed to book session");
      }
    } catch (error) {
      toast.error("An error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (booked) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-8">
          <div className="flex justify-center mb-6">
            <div className="bg-green-100 dark:bg-green-500/20 p-3 rounded-full">
              <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold mb-2">Booking Confirmed!</h1>
          <p className="text-muted-foreground mb-8">
            Thank you for booking a group session. We've sent a confirmation email to your address.
          </p>
          <Button asChild className="w-full">
            <Link href="/">Return to Home</Link>
          </Button>
        </Card>
      </main>
    );
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
            <Badge className="mb-4">Group Sessions</Badge>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
              Level Up Together
            </h1>
            <p className="text-lg text-muted-foreground">
              Structured coaching sessions for young cricketers aged 6-18.
              Build skills, make friends, and develop your game in a supportive environment.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing & Schedule */}
      <section className="py-12 md:py-16">
        <div className="container px-4 mx-auto">
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
                <div className="text-5xl font-bold text-primary mb-2">£12.50</div>
                <p className="text-muted-foreground">per session</p>
                <ul className="mt-6 space-y-3">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span>Structured coaching format</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span>Max 12 players per session</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span>Ages 6-18 welcome</span>
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
                    {sessions.length > 0 ? (
                      sessions.map((session) => (
                        <div key={session.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                          <div>
                            <span className="font-medium">{session.title}</span>
                            <p className="text-xs text-muted-foreground">{session.age_group}</p>
                          </div>
                          <Badge variant="secondary">{session.schedule}</Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-muted-foreground py-4">No sessions scheduled currently.</p>
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
                <CardTitle>Book a Session</CardTitle>
                <CardDescription>
                  Sign up for our upcoming group coaching sessions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="session_id">Select Session</Label>
                    <Select name="session_id" required>
                      <SelectTrigger id="session_id">
                        <SelectValue placeholder="Choose a session" />
                      </SelectTrigger>
                      <SelectContent>
                        {sessions.map((session) => (
                          <SelectItem key={session.id} value={session.id}>
                            {session.title} ({session.schedule}) - {session.max_players - session.current_players} spots left
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="player_name">Player's Name</Label>
                      <Input id="player_name" name="player_name" placeholder="Child's full name" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="player_age">Player's Age</Label>
                      <Select name="player_age" required>
                        <SelectTrigger id="player_age">
                          <SelectValue placeholder="Select age" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 13 }, (_, i) => i + 6).map((age) => (
                            <SelectItem key={age} value={age.toString()}>{age} years</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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

                  <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Book Session - £12.50"
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
          <h3 className="text-xl font-semibold mb-4">Questions about group sessions?</h3>
          <p className="text-muted-foreground mb-6">
            We're happy to help find the right session for your child
          </p>
          <Button asChild variant="outline">
            <Link href="/contact">Contact Us</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}