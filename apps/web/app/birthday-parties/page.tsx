import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import Link from "next/link"
import {
  ArrowLeft,
  Gift,
  PartyPopper,
  Gamepad2,
  Users,
  Calendar,
  Sparkles,
} from "lucide-react"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Birthday Parties | Cricpro Centre of Excellence",
  description:
    "Cricket-themed birthday parties for kids. Active, fun-filled celebrations in our professional indoor facility. Up to 20 guests.",
}

export default function BirthdayPartiesPage() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="bg-muted/30 py-12 md:py-16">
        <div className="container mx-auto px-4">
          <Link
            href="/"
            className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
          <div className="max-w-3xl">
            <Badge className="mb-4">Birthday Parties</Badge>
            <h1 className="mb-4 text-3xl font-bold md:text-4xl lg:text-5xl">
              Cricket Parties Kids Love
            </h1>
            <p className="text-lg text-muted-foreground">
              Give your child an unforgettable birthday celebration with active,
              fun-filled cricket activities in our professional indoor facility.
            </p>
          </div>
        </div>
      </section>

      {/* What's Included */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-8 text-center text-2xl font-bold md:text-3xl">
            Party Experience
          </h2>
          <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-6">
              <Gamepad2 className="mb-3 h-8 w-8 text-primary" />
              <h3 className="mb-2 font-semibold">Active Games</h3>
              <p className="text-sm text-muted-foreground">
                Cricket-themed activities and games for all abilities
              </p>
            </Card>
            <Card className="p-6">
              <Users className="mb-3 h-8 w-8 text-primary" />
              <h3 className="mb-2 font-semibold">Qualified Coaches</h3>
              <p className="text-sm text-muted-foreground">
                Professional coaching staff to run activities
              </p>
            </Card>
            <Card className="p-6">
              <Sparkles className="mb-3 h-8 w-8 text-primary" />
              <h3 className="mb-2 font-semibold">Premium Facility</h3>
              <p className="text-sm text-muted-foreground">
                Indoor lanes with professional setup
              </p>
            </Card>
            <Card className="p-6">
              <Gift className="mb-3 h-8 w-8 text-primary" />
              <h3 className="mb-2 font-semibold">Celebration Space</h3>
              <p className="text-sm text-muted-foreground">
                Room for cake and presents after activities
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Party Details */}
      <section className="bg-muted/20 py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl">
            <div className="grid gap-6 sm:grid-cols-3">
              <Card className="p-6 text-center">
                <Calendar className="mx-auto mb-3 h-8 w-8 text-primary" />
                <h3 className="mb-1 font-semibold">Duration</h3>
                <p className="text-sm text-muted-foreground">2-3 hours</p>
              </Card>
              <Card className="p-6 text-center">
                <Users className="mx-auto mb-3 h-8 w-8 text-primary" />
                <h3 className="mb-1 font-semibold">Capacity</h3>
                <p className="text-sm text-muted-foreground">Up to 20 guests</p>
              </Card>
              <Card className="p-6 text-center">
                <PartyPopper className="mx-auto mb-3 h-8 w-8 text-primary" />
                <h3 className="mb-1 font-semibold">Age Range</h3>
                <p className="text-sm text-muted-foreground">6-14 years</p>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Enquiry Form */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle>Plan Your Party</CardTitle>
                <CardDescription>
                  Tell us about your party and we'll create a custom quote
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="parent-name">Parent's Name</Label>
                      <Input id="parent-name" placeholder="Your full name" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact">Contact Number</Label>
                      <Input
                        id="contact"
                        type="tel"
                        placeholder="07xxx xxx xxx"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="child-name">Birthday Child's Name</Label>
                      <Input id="child-name" placeholder="Child's name" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="age">Age Turning</Label>
                      <Input id="age" type="number" placeholder="Age" />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="date">Preferred Date</Label>
                      <Input id="date" type="date" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="guests">Expected Guests</Label>
                      <Input
                        id="guests"
                        type="number"
                        placeholder="Number of guests"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="duration">Preferred Duration</Label>
                    <Input id="duration" placeholder="e.g., 2 hours, 3 hours" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="requirements">Special Requirements</Label>
                    <Textarea
                      id="requirements"
                      placeholder="Dietary requirements, accessibility needs, special requests..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="source">How did you hear about us?</Label>
                    <Input
                      id="source"
                      placeholder="e.g., Friend, Facebook, Search"
                    />
                  </div>

                  <Button type="submit" size="lg" className="w-full">
                    Submit Party Enquiry
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-muted/20 py-12">
        <div className="container px-4 text-center">
          <p className="mb-4 text-muted-foreground">
            Want to chat before booking? We're happy to discuss your party
            ideas.
          </p>
          <Button asChild variant="outline">
            <Link href="/contact">Contact Us</Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
