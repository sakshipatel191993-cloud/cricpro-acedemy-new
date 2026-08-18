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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Textarea } from "@workspace/ui/components/textarea"
import Link from "next/link"
import { ArrowLeft, Award, User, Target, Clock, Star } from "lucide-react"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "One-to-One Coaching | Cricpro Centre of Excellence",
  description:
    "Personalised cricket coaching from experienced coaches. Tailored training programmes to accelerate your development.",
}

export default function CoachingPage() {
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
            <Badge className="mb-4">One-to-One Coaching</Badge>
            <h1 className="mb-4 text-3xl font-bold md:text-4xl lg:text-5xl">
              Elite Development
            </h1>
            <p className="text-lg text-muted-foreground">
              Personalised coaching from experienced coaches. Accelerate your
              development with tailored feedback and training programmes
              designed around your goals.
            </p>
          </div>
        </div>
      </section>

      {/* What's Included */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-8 text-center text-2xl font-bold md:text-3xl">
            What You'll Get
          </h2>
          <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-6">
              <User className="mb-3 h-8 w-8 text-primary" />
              <h3 className="mb-2 font-semibold">Personalised Attention</h3>
              <p className="text-sm text-muted-foreground">
                One coach, one player - 100% focused on your development
              </p>
            </Card>
            <Card className="p-6">
              <Target className="mb-3 h-8 w-8 text-primary" />
              <h3 className="mb-2 font-semibold">Goal-Focused</h3>
              <p className="text-sm text-muted-foreground">
                Training tailored to your specific ambitions
              </p>
            </Card>
            <Card className="p-6">
              <Award className="mb-3 h-8 w-8 text-primary" />
              <h3 className="mb-2 font-semibold">Expert Feedback</h3>
              <p className="text-sm text-muted-foreground">
                Detailed analysis and technique improvement
              </p>
            </Card>
            <Card className="p-6">
              <Clock className="mb-3 h-8 w-8 text-primary" />
              <h3 className="mb-2 font-semibold">Flexible Scheduling</h3>
              <p className="text-sm text-muted-foreground">
                Sessions scheduled around your availability
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Coming Soon */}
      <section className="bg-muted/20 py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <Card className="border-primary">
              <CardContent className="p-8">
                <Badge className="mb-4">Coming Soon</Badge>
                <h3 className="mb-4 text-2xl font-bold">One-to-One Coaching</h3>
                <p className="mb-6 text-muted-foreground">
                  We're finalising our coaching programmes and pricing. Submit
                  an enquiry to be notified when we launch and get priority
                  booking.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Enquiry Form */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle>Enquire About Coaching</CardTitle>
                <CardDescription>
                  Tell us about yourself and we'll be in touch with more details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Your Name</Label>
                      <Input id="name" placeholder="Full name" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="age">Age (if under 18)</Label>
                      <Input
                        id="age"
                        type="number"
                        placeholder="Player's age"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="level">Current Skill Level</Label>
                    <Select>
                      <SelectTrigger id="level">
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">
                          Beginner - New to cricket
                        </SelectItem>
                        <SelectItem value="social">
                          Social Player - Casual cricket
                        </SelectItem>
                        <SelectItem value="club">
                          Club Cricketer - Regular club player
                        </SelectItem>
                        <SelectItem value="county">County Age Group</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="focus">Primary Focus Area</Label>
                    <Select>
                      <SelectTrigger id="focus">
                        <SelectValue placeholder="What do you want to improve?" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="batting">Batting</SelectItem>
                        <SelectItem value="bowling">Bowling</SelectItem>
                        <SelectItem value="allround">All-Round</SelectItem>
                        <SelectItem value="keeping">Wicketkeeping</SelectItem>
                        <SelectItem value="fitness">
                          Fitness & Conditioning
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="goals">Goals & Expectations</Label>
                    <Textarea
                      id="goals"
                      placeholder="What do you want to achieve from coaching?"
                    />
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
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="07xxx xxx xxx"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="club">Current Club (Optional)</Label>
                      <Input id="club" placeholder="Your club" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="availability">Preferred Times</Label>
                      <Select>
                        <SelectTrigger id="availability">
                          <SelectValue placeholder="When can you train?" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weekday-am">
                            Weekday mornings
                          </SelectItem>
                          <SelectItem value="weekday-pm">
                            Weekday evenings
                          </SelectItem>
                          <SelectItem value="weekend-am">
                            Weekend mornings
                          </SelectItem>
                          <SelectItem value="weekend-pm">
                            Weekend afternoons
                          </SelectItem>
                          <SelectItem value="flexible">Flexible</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button type="submit" size="lg" className="w-full">
                    Submit Enquiry
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </main>
  )
}
