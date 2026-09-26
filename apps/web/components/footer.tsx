import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight, Camera, Clock, Mail, MapPin, Phone, Star } from "lucide-react"
import { LOCATION } from "@/lib/location"
import { OPERATING_HOURS } from "@/lib/hours"
import { GOOGLE_REVIEWS_URL, INSTAGRAM_URL } from "@/lib/social-links"

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
const linkStyle = "inline-flex min-h-11 items-center text-[15px] text-foreground/70 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"

export function Footer() {
  return (
    <footer aria-label="Site footer" className="border-t border-border/60 bg-card/40">
      <div className="mx-auto max-w-7xl px-4 pt-12 pb-6 sm:px-8 lg:pt-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr_1.15fr] lg:gap-12">
          <div>
            <Link href="/" aria-label="Cricpro Centre of Excellence home" className="inline-flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-primary">
              <span className="relative block h-20 w-20 shrink-0 overflow-hidden sm:h-24 sm:w-24">
                <Image src="/crircpro-coe-logo-header.png" alt="" fill sizes="(max-width: 640px) 80px, 96px" className="object-contain" />
              </span>
              <span>
                <span className="block text-[1.35rem] font-extrabold leading-none tracking-[-0.045em] sm:text-2xl">CRIC<span className="text-primary">PRO</span></span>
                <span className="mt-2 block max-w-36 text-[10px] font-medium uppercase leading-4 tracking-[0.18em] text-muted-foreground">Centre of Excellence</span>
              </span>
            </Link>
            <p className="mt-7 max-w-md text-2xl font-semibold leading-tight tracking-[-0.04em]">Practice to <span className="text-primary">Perfection.</span></p>
            <p className="mt-3 max-w-sm text-[15px] leading-7 text-muted-foreground">
              Your space to train, develop and enjoy cricket. Premium indoor lanes
              and expert coaching for every stage of your game.
            </p>
            <p className="mt-5 inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" />
              4 indoor lanes · Open 7 days
            </p>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1">
              <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-foreground/75 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
                <Camera aria-hidden="true" className="h-4 w-4" /> Instagram<span className="sr-only"> (opens in a new tab)</span>
              </a>
              <a href={GOOGLE_REVIEWS_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-foreground/75 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
                <Star aria-hidden="true" className="h-4 w-4" /> Google reviews<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-8">
            <nav aria-label="Footer services">
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Train with us</h2>
              <ul className="space-y-0.5">
                {quickLinks.map(link => <li key={link.href}><Link href={link.href} className={linkStyle}>{link.label}</Link></li>)}
              </ul>
            </nav>
            <nav aria-label="Footer company">
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Explore</h2>
              <ul className="space-y-0.5">
                {companyLinks.map(link => <li key={link.href}><Link href={link.href} className={linkStyle}>{link.label}</Link></li>)}
              </ul>
            </nav>
          </div>

          <section aria-labelledby="footer-visit-heading" className="rounded-xl border border-border/70 bg-background/60 p-6">
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
