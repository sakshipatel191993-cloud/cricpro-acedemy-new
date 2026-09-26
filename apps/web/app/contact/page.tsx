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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import Link from "next/link"
import {
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  Clock,
  MessageCircle,
} from "lucide-react"
import { Metadata } from "next"
import { LOCATION } from "@/lib/location"
import { OPERATING_HOURS } from "@/lib/hours"
import { GOOGLE_REVIEWS_URL, INSTAGRAM_URL } from "@/lib/social-links"
import { ContactForm } from "@/components/contact-form"

export const metadata: Metadata = {
  title: "Contact Us | Cricpro Centre of Excellence",
  description:
    "Get in touch with Cricpro Centre of Excellence. Questions about lane hire, coaching, or bookings? We'd love to hear from you.",
}

export default function ContactPage() {
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
            <Badge className="mb-4">Contact Us</Badge>
            <h1 className="mb-4 text-4xl font-semibold leading-tight tracking-tight md:text-5xl lg:text-6xl">
              Get in Touch
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
              Have questions? We'd love to hear from you. Send us a message and
              we'll respond as soon as possible.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Info & Form */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-2">
            {/* Contact Info */}
            <div className="space-y-8">
              <div>
                <h2 className="mb-6 text-2xl font-semibold tracking-tight">Contact Information</h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="mb-1 font-semibold">Location</h3>
                      <p className="text-muted-foreground">
                        {LOCATION.name}
                        <br />
                        <a
                          href={LOCATION.googleMapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="transition-colors hover:text-primary"
                        >
                          {LOCATION.address}
                        </a>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Phone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="mb-1 font-semibold">Phone</h3>
                      <a href="tel:+447728478115" className="text-muted-foreground hover:text-primary">+44 7728 478115</a>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="mb-1 font-semibold">Email</h3>
                      <p className="text-muted-foreground">
                        <a href="mailto:info@cricprocoe.com">info@cricprocoe.com</a>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="mb-1 font-semibold">Opening Hours</h3>
                      <p className="text-muted-foreground">
                        {OPERATING_HOURS.weekday.label}
                        <br />
                        {OPERATING_HOURS.weekday.hours}
                        <br />
                        {OPERATING_HOURS.weekend.label}
                        <br />
                        {OPERATING_HOURS.weekend.hours}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-6">
                  <MessageCircle className="mb-3 h-8 w-8 text-primary" />
                  <h3 className="mb-2 font-semibold">Connect with us</h3>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Ask us a question on WhatsApp or Instagram, or share your experience on Google.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" asChild>
                      <a href="https://wa.me/447728478115" target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">Instagram<span className="sr-only"> (opens in a new tab)</span></a>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <a href={GOOGLE_REVIEWS_URL} target="_blank" rel="noopener noreferrer">Google reviews<span className="sr-only"> (opens in a new tab)</span></a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Contact Form */}
            <Card className="border-border/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-semibold tracking-tight md:text-2xl">Send us a Message</CardTitle>
                <CardDescription>
                  Tell us what you need and we’ll get back to you.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ContactForm>
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" name="name" required maxLength={200} autoComplete="name" placeholder="Your full name" />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        name="email"
                        required
                        maxLength={254}
                        autoComplete="email"
                        type="email"
                        placeholder="your@email.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone <span className="font-normal text-muted-foreground">(optional)</span></Label>
                      <Input
                        id="phone"
                        name="phone"
                        maxLength={40}
                        autoComplete="tel"
                        type="tel"
                        placeholder="07xxx xxx xxx"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Select name="subject" defaultValue="general">
                      <SelectTrigger id="subject" className="w-full">
                        <SelectValue placeholder="Select a subject" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General Enquiry</SelectItem>
                        <SelectItem value="lane-hire">Lane Hire</SelectItem>
                        <SelectItem value="group-sessions">
                          Group Sessions
                        </SelectItem>
                        <SelectItem value="coaching">Coaching</SelectItem>
                        <SelectItem value="birthday">
                          Birthday Parties
                        </SelectItem>
                        <SelectItem value="corporate">
                          Corporate / Team Bookings
                        </SelectItem>
                        <SelectItem value="feedback">Feedback</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      name="message"
                      required
                      maxLength={10000}
                      placeholder="How can we help you?"
                      className="min-h-[150px]"
                    />
                  </div>

                  <Button type="submit" size="lg" className="w-full">
                    Send Message
                  </Button>
                </ContactForm>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-muted/20 py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-6 text-center text-2xl font-bold">
              Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              <Card className="p-4">
                <h3 className="mb-2 font-semibold">
                  What should I bring to a session?
                </h3>
                <p className="text-sm text-muted-foreground">
                  Just bring your cricket gear (bat, pads, gloves if you have
                  them). We provide balls, stumps, and protective equipment if
                  needed.
                </p>
              </Card>
              <Card className="p-4">
                <h3 className="mb-2 font-semibold">Can I book on the day?</h3>
                <p className="text-sm text-muted-foreground">
                  Subject to availability, yes. We recommend booking in advance
                  to secure your preferred time.
                </p>
              </Card>
              <Card className="p-4">
                <h3 className="mb-2 font-semibold">
                  Is there parking available?
                </h3>
                <p className="text-sm text-muted-foreground">
                  Yes, we have free on-site parking for all customers.
                </p>
              </Card>
              <Card className="p-4">
                <h3 className="mb-2 font-semibold">
                  What age can children start?
                </h3>
                <p className="text-sm text-muted-foreground">
                  Our group sessions are suitable for ages 6-18. Younger
                  children can use lane hire with parental supervision.
                </p>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
