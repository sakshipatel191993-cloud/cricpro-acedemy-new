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
            <h1 className="mb-4 text-3xl font-bold md:text-4xl lg:text-5xl">
              Get in Touch
            </h1>
            <p className="text-lg text-muted-foreground">
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
                <h2 className="mb-6 text-2xl font-bold">Contact Information</h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="mb-1 font-semibold">Location</h3>
                      <p className="text-muted-foreground">
                        Cricpro Centre of Excellence
                        <br />
                        [Address Coming Soon]
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Phone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="mb-1 font-semibold">Phone</h3>
                      <p className="text-muted-foreground">[Coming Soon]</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="mb-1 font-semibold">Email</h3>
                      <p className="text-muted-foreground">
                        info@cricprocoe.com
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
                        Monday - Sunday
                        <br />
                        12:00 PM - 12:00 AM
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-6">
                  <MessageCircle className="mb-3 h-8 w-8 text-primary" />
                  <h3 className="mb-2 font-semibold">Quick Enquiries</h3>
                  <p className="mb-4 text-sm text-muted-foreground">
                    For the fastest response, use the contact form or message us
                    on social media.
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled>
                      Facebook (Soon)
                    </Button>
                    <Button size="sm" variant="outline" disabled>
                      Instagram (Soon)
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Contact Form */}
            <Card>
              <CardHeader>
                <CardTitle>Send us a Message</CardTitle>
                <CardDescription>
                  Fill in the form below and we'll get back to you
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" placeholder="Your full name" />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="your@email.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone (Optional)</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="07xxx xxx xxx"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Select>
                      <SelectTrigger id="subject">
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
                      placeholder="How can we help you?"
                      className="min-h-[150px]"
                    />
                  </div>

                  <Button type="submit" size="lg" className="w-full">
                    Send Message
                  </Button>
                </form>
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
