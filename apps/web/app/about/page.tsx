import { Card, CardContent } from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import Link from "next/link"
import {
  ArrowLeft,
  MapPin,
  Clock,
  Phone,
  Mail,
  Star,
  Award,
  Users,
  Target,
} from "lucide-react"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "About Us | Cricpro Centre of Excellence",
  description:
    "Learn about Cricpro Centre of Excellence - our mission, facilities, and qualified coaching team. Premium indoor cricket training.",
}

export default function AboutPage() {
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
            <Badge className="mb-4">About Us</Badge>
            <h1 className="mb-4 text-3xl font-bold md:text-4xl lg:text-5xl">
              Cricpro Centre of Excellence
            </h1>
            <p className="text-lg text-muted-foreground">
              Where passion meets professional training. We're dedicated to
              helping cricketers of all ages and abilities reach their full
              potential.
            </p>
          </div>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-6 text-2xl font-bold md:text-3xl">Our Story</h2>
            <div className="space-y-4 text-muted-foreground">
              <p>
                At Cricpro Centre of Excellence, our mission is simple — to
                deliver elite cricket training in a premium environment built
                for players who want to develop their game to the highest
                standard.
              </p>
              <p>
                We believe every cricketer should have access to professional
                coaching, high-quality facilities, and the right support system,
                whether they’re picking up a bat for the first time or
                progressing towards county-level cricket.
              </p>
              <p>
                Our state-of-the-art indoor facility provides year-round
                training in all conditions, featuring professional lanes,
                quality equipment, and experienced coaches dedicated to helping
                every player improve with confidence.
              </p>
              <p>
                As the season moves into summer, players also benefit from
                access to our outdoor training facilities, creating the perfect
                environment to develop every aspect of the game
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="bg-muted/20 py-12 md:py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-8 text-center text-2xl font-bold md:text-3xl">
            Why Train With Us
          </h2>
          <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="p-6">
              <Award className="mb-3 h-8 w-8 text-primary" />
              <h3 className="mb-2 font-semibold">Qualified Coaches</h3>
              <p className="text-sm text-muted-foreground">
                Our team has years of cricket experience and coaching
                qualifications
              </p>
            </Card>
            <Card className="p-6">
              <Target className="mb-3 h-8 w-8 text-primary" />
              <h3 className="mb-2 font-semibold">Modern Facilities</h3>
              <p className="text-sm text-muted-foreground">
                4 indoor lanes with professional lighting and equipment
              </p>
            </Card>
            <Card className="p-6">
              <Users className="mb-3 h-8 w-8 text-primary" />
              <h3 className="mb-2 font-semibold">All Abilities</h3>
              <p className="text-sm text-muted-foreground">
                From beginners to representative players, we cater for everyone
              </p>
            </Card>
            <Card className="p-6">
              <Clock className="mb-3 h-8 w-8 text-primary" />
              <h3 className="mb-2 font-semibold">Flexible Hours</h3>
              <p className="text-sm text-muted-foreground">
                Open 12pm-midnight, 7 days a week for maximum convenience
              </p>
            </Card>
            <Card className="p-6">
              <Star className="mb-3 h-8 w-8 text-primary" />
              <h3 className="mb-2 font-semibold">Proven Results</h3>
              <p className="text-sm text-muted-foreground">
                Players improve rapidly with our structured training approach
              </p>
            </Card>
            <Card className="p-6">
              <MapPin className="mb-3 h-8 w-8 text-primary" />
              <h3 className="mb-2 font-semibold">Easy Access</h3>
              <p className="text-sm text-muted-foreground">
                Convenient location with ample parking
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Facility Info */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-8 text-center text-2xl font-bold md:text-3xl">
              Our Facility
            </h2>
            <div className="grid gap-6 sm:grid-cols-2">
              <Card className="p-6">
                <h3 className="mb-4 font-semibold">Training Lanes</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• 4 professional indoor lanes</li>
                  <li>• Floodlight-quality lighting</li>
                  <li>• Professional cricket surfaces</li>
                  <li>• Full-length nets</li>
                </ul>
              </Card>
              <Card className="p-6">
                <h3 className="mb-4 font-semibold">Equipment</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Professional bowling machines</li>
                  <li>• Side arm bowling equipment</li>
                  <li>• Protective gear available</li>
                  <li>• Video analysis tools</li>
                </ul>
              </Card>
              <Card className="p-6">
                <h3 className="mb-4 font-semibold">Amenities</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Clean changing facilities</li>
                  <li>• Reception & waiting area</li>
                  <li>• Refreshment area</li>
                  <li>• Free parking</li>
                </ul>
              </Card>
              <Card className="p-6">
                <h3 className="mb-4 font-semibold">Operating Hours</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Monday - Sunday</li>
                  <li>• 12:00 PM - 12:00 AM</li>
                  <li>• 7 days a week</li>
                  <li>• Bank holidays included</li>
                </ul>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-muted/20 py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="mb-6 text-2xl font-bold md:text-3xl">Our Values</h2>
            <div className="grid gap-6 sm:grid-cols-3">
              <div>
                <h3 className="mb-2 font-semibold">Excellence</h3>
                <p className="text-sm text-muted-foreground">
                  We strive for the highest standards in everything we do
                </p>
              </div>
              <div>
                <h3 className="mb-2 font-semibold">Inclusivity</h3>
                <p className="text-sm text-muted-foreground">
                  Cricket is for everyone, regardless of age or ability
                </p>
              </div>
              <div>
                <h3 className="mb-2 font-semibold">Development</h3>
                <p className="text-sm text-muted-foreground">
                  We focus on long-term player growth and improvement
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
