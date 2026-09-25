"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { Button } from "@workspace/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from "@workspace/ui/components/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Menu, X, LogOut, User } from "lucide-react"
import { useAuth } from "@/lib/context/auth"
import { ThemeToggle } from "@/components/theme-toggle"

const navLinks = [
  { href: "/lane-hire", label: "Lane Hire" },
  { href: "/group-sessions", label: "Group Sessions" },
  { href: "/masterclass", label: "Masterclass" },
  { href: "/bowling-machine", label: "Bowling Machine" },
  { href: "/side-arm", label: "Side Arm" },
  { href: "/coaching", label: "Coaching" },
  { href: "/birthday-parties", label: "Birthday Parties" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
]

export function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const reducedMotion = useReducedMotion()

  const firstName =
    user?.user_metadata?.full_name?.split(" ")[0] ??
    user?.email?.split("@")[0] ??
    "Account"
  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : (user?.email?.[0] ?? "U").toUpperCase()

  async function handleSignOut() {
    await signOut()
    router.push("/")
    router.refresh()
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <motion.header
      initial={reducedMotion ? false : { y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: reducedMotion ? 0 : 0.42, ease: [0.16, 1, 0.3, 1] }}
      className={`sticky top-0 z-50 w-full border-b backdrop-blur-md transition-colors duration-300 ${
        scrolled
          ? "border-primary/20 bg-background/90"
          : "border-border/40 bg-background/70"
      }`}
    >
      <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 xl:px-8">
        <div className="flex h-20 items-center justify-between gap-4 lg:gap-6">
          {/* Logo */}
          <Link href="/" className="group flex shrink-0 items-center">
            <Image
              src="/crircpro-coe-logo-header.png"
              alt="Cricpro Centre of Excellence"
              className="h-14 w-14 object-contain transition-transform duration-300 group-hover:scale-[1.03] sm:h-16 sm:w-16"
              height={64}
              width={64}
              priority
            />
          </Link>

          {/* Desktop Navigation */}
          <nav aria-label="Primary navigation" className="hidden flex-1 items-center justify-center gap-4 min-[1440px]:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={pathname === link.href ? "page" : undefined}
                className={`group relative shrink-0 whitespace-nowrap py-2 text-sm font-medium transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary ${pathname === link.href ? "text-foreground" : "text-muted-foreground"}`}
              >
                {link.label}
                <span className={`absolute -bottom-0.5 left-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full ${pathname === link.href ? "w-full" : "w-0"}`} />
              </Link>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden shrink-0 items-center gap-2 min-[1440px]:flex">
            {!loading && !user && (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/login">Login</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/signup">Sign Up</Link>
                </Button>
              </>
            )}
            {!loading && user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {initials}
                    </span>
                    <span className="max-w-28 truncate">{firstName}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link href="/account" className="flex items-center gap-2">
                      <User className="h-4 w-4" /> My Account
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="flex items-center gap-2 text-destructive focus:text-destructive"
                  >
                    <LogOut className="h-4 w-4" /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <motion.div whileHover={reducedMotion ? undefined : { y: -2 }} whileTap={reducedMotion ? undefined : { scale: 0.98 }}>
              <Button
                asChild
                size="sm"
                className="rounded-md shadow-sm hover:shadow-primary/30"
              >
                <Link href="/lane-hire">Book Now</Link>
              </Button>
            </motion.div>
            <ThemeToggle />
          </div>

          {/* Mobile Menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="min-[1440px]:hidden">
              <Button variant="ghost" size="icon-lg" aria-label="Open menu">
                <AnimatePresence mode="wait" initial={false}>
                  {isOpen ? (
                    <motion.div
                      key="close"
                      initial={{ rotate: -90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: 90, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <X className="size-7" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="open"
                      initial={{ rotate: 90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: -90, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <Menu className="size-7" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[min(88vw,360px)] border-l border-border/60 bg-background p-6 sm:w-[360px]"
            >
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <SheetDescription className="sr-only">Navigate to the main sections of the site</SheetDescription>
              <div className="mt-4 flex flex-col gap-6">
                <Link
                  href="/"
                  className="flex items-center gap-2"
                  onClick={() => setIsOpen(false)}
                >
                  <Image
                    src="/crircpro-coe-logo-header.png"
                    alt="Cricpro Centre of Excellence"
                    className="h-14 w-14 object-contain"
                    height={56}
                    width={56}
                  />
                  <span className="text-lg font-bold">Cricpro</span>
                </Link>
                <nav className="flex flex-col gap-1">
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-current={pathname === link.href ? "page" : undefined}
                      className={`block rounded-md px-3 py-2.5 text-base font-medium transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary ${pathname === link.href ? "bg-primary/10 text-primary" : ""}`}
                      onClick={() => setIsOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>
                <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                  <span className="text-sm font-medium">Theme</span>
                  <ThemeToggle />
                </div>
                <Button asChild className="mt-4 w-full">
                  <Link href="/lane-hire" onClick={() => setIsOpen(false)}>
                    Book Now
                  </Link>
                </Button>
                {!loading && !user && (
                  <div className="mt-2 flex gap-2">
                    <Button
                      asChild
                      variant="outline"
                      className="flex-1"
                      onClick={() => setIsOpen(false)}
                    >
                      <Link href="/login">Login</Link>
                    </Button>
                    <Button
                      asChild
                      variant="ghost"
                      className="flex-1"
                      onClick={() => setIsOpen(false)}
                    >
                      <Link href="/signup">Sign Up</Link>
                    </Button>
                  </div>
                )}
                {!loading && user && (
                  <Button
                    variant="ghost"
                    className="mt-2 w-full text-destructive hover:text-destructive"
                    onClick={() => {
                      handleSignOut()
                      setIsOpen(false)
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" /> Sign Out
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </motion.header>
  )
}
