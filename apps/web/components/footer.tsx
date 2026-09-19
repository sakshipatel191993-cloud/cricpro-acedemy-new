import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight, Clock, Mail, MapPin, Phone } from "lucide-react"
import { LOCATION } from "@/lib/location"
import { OPERATING_HOURS } from "@/lib/hours"

const quickLinks = [
  { href: "/lane-hire", label: "Lane Hire" },
  { href: "/group-sessions", label: "Group Sessions" },
  { href: "/masterclass", label: "Masterclass" },
  { href: "/bowling-machine", label: "Bowling Machine" },
  { href: "/side-arm", label: "Side Arm" },
  { href: "/coaching", label: "Coaching" },
  { href: "/birthday-parties", label: "Birthday Parties" },
]
const companyLinks = [
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact Us" },
  { href: "/login", label: "Sign In" },
  { href: "/signup", label: "Create Account" },
]
const linkStyle = "inline-flex min-h-10 items-center text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"

export function Footer() {
  return (
    <footer aria-label="Site footer" className="border-t border-border/60 bg-card/40">
      <div className="mx-auto max-w-7xl px-5 pt-12 pb-6 sm:px-8 lg:pt-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr_1.15fr] lg:gap-12">
          <div>
            <Link href="/" aria-label="Cricpro Centre of Excellence home" className="inline-flex items-center gap-4 rounded-lg focus-visible:outline-2 focus-visible:outline-primary">
              <span className="relative block h-28 w-28 shrink-0 overflow-hidden">
                <Image src="/crircpro-coe-logo.png" alt="" fill sizes="112px" className="object-cover" />
              </span>
              <span>
                <span className="block text-2xl font-bold tracking-tight">CRIC<span className="text-primary">PRO</span></span>
                <span className="mt-1 block max-w-36 text-xs uppercase tracking-widest text-muted-foreground">Centre of Excellence</span>
              </span>
            </Link>
            <p className="mt-5 text-lg font-semibold">Practice to Perfection.</p>
            <p className="mt-3 max-w-sm text-sm leading-7 text-muted-foreground">
              Your space to train, develop and enjoy cricket. Premium indoor lanes
              and expert coaching for every stage of your game.
            </p>
            <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" />
              4 indoor lanes · Open 7 days
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <nav aria-label="Footer services">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest">Train with us</h2>
              <ul>
                {quickLinks.map(link => <li key={link.href}><Link href={link.href} className={linkStyle}>{link.label}</Link></li>)}
              </ul>
            </nav>
            <nav aria-label="Footer company">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest">Explore</h2>
              <ul>
                {companyLinks.map(link => <li key={link.href}><Link href={link.href} className={linkStyle}>{link.label}</Link></li>)}
              </ul>
            </nav>
          </div>

          <section aria-labelledby="footer-visit-heading" className="rounded-2xl border border-border/70 bg-background/60 p-6">
            <h2 id="footer-visit-heading" className="mb-5 text-xs font-semibold uppercase tracking-widest">Plan your visit</h2>
            <div className="flex gap-3">
              <Clock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <dl className="flex-1 space-y-3 text-sm">
                <div><dt className="text-muted-foreground">{OPERATING_HOURS.weekday.label}</dt><dd className="mt-1 font-medium">{OPERATING_HOURS.weekday.hours}</dd></div>
                <div><dt className="text-muted-foreground">{OPERATING_HOURS.weekend.label}</dt><dd className="mt-1 font-medium">{OPERATING_HOURS.weekend.hours}</dd></div>
              </dl>
            </div>
            <div className="my-5 border-t border-border/60" />
            <div className="flex gap-3">
              <MapPin aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 text-sm">
                <p className="font-medium">{LOCATION.name}</p>
                <p className="mt-1 text-muted-foreground">{LOCATION.address}</p>
                <a href={LOCATION.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-10 items-center gap-2 font-medium text-primary underline-offset-4 hover:underline">
                  Get directions <ArrowUpRight aria-hidden="true" className="h-4 w-4" /><span className="sr-only"> (opens Google Maps in a new tab)</span>
                </a>
              </div>
            </div>
            <a href="mailto:info@cricprocoe.com" className="mt-2 flex min-h-11 items-center gap-3 text-sm hover:text-primary">
              <Mail aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" /><span className="break-all">info@cricprocoe.com</span>
            </a>
            <a href="tel:+447728478115" className="flex min-h-11 items-center gap-3 text-sm hover:text-primary">
              <Phone aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />07728 478115
            </a>
          </section>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-border/60 pt-6 text-xs leading-6 text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Cricpro Centre of Excellence. All rights reserved.</p>
          <p>Indoor cricket. Every season.</p>
        </div>
      </div>
    </footer>
  )
}
