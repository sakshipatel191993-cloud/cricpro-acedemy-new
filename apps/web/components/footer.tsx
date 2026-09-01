import Link from "next/link"
import { Clock, Mail, MapPin, Phone } from "lucide-react"

const quickLinks = [
  { href: "/lane-hire", label: "Lane Hire" },
  { href: "/group-sessions", label: "Group Sessions" },
  { href: "/bowling-machine", label: "Bowling Machine" },
  { href: "/side-arm", label: "Side Arm" },
  { href: "/coaching", label: "Coaching" },
  { href: "/birthday-parties", label: "Birthday Parties" },
]

const companyLinks = [
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact" },
  { href: "/login", label: "Sign In" },
  { href: "/signup", label: "Create Account" },
]

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border/60 bg-card/40">
      <div className="container px-4 py-14 md:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/crircpro-coe-logo.png"
                alt="Cricpro Centre of Excellence"
                className="h-12 w-auto"
              />
            </Link>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Practice to Perfection. A premium indoor cricket training facility
              helping cricketers of all ages and abilities reach their full
              potential.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="mb-4 text-sm font-semibold">Services</h4>
            <ul className="space-y-2.5">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="mb-4 text-sm font-semibold">Company</h4>
            <ul className="space-y-2.5">
              {companyLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact & Hours */}
          <div>
            <h4 className="mb-4 text-sm font-semibold">Visit Us</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2.5">
                <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                <span>
                  Monday – Sunday
                  <br />
                  12:00 PM – 12:00 AM
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                <span>Cricpro Centre of Excellence</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Mail className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                <a
                  href="mailto:info@cricprocoe.com"
                  className="transition-colors hover:text-primary"
                >
                  cricprolimited@hotmail.com
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <Phone className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                <span>Coming soon</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border/40 pt-6 text-center text-sm text-muted-foreground sm:flex-row sm:text-left">
          <p>© {year} Cricpro Centre of Excellence. All rights reserved.</p>
          <p className="text-xs">Practice to Perfection.</p>
        </div>
      </div>
    </footer>
  )
}
