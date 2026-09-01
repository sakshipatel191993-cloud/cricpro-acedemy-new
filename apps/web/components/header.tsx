"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
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
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`sticky top-0 z-50 w-full border-b backdrop-blur-md transition-colors duration-300 ${
        scrolled
          ? "border-primary/20 bg-background/90"
          : "border-border/40 bg-background/70"
      }`}
    >
      <div className="container px-4">
        <div className="flex h-24 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="group flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/crircpro-coe-logo.png"
              alt="Cricpro Centre of Excellence"
              height={100}
              width={100}
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-6 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group relative text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
                <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-primary transition-all duration-300 group-hover:w-full" />
              </Link>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden items-center gap-3 lg:flex">
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
                    {firstName}
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
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}>
              <Button
                asChild
                size="sm"
                className="shadow-sm hover:shadow-primary/30"
              >
                <Link href="/lane-hire">Book Now</Link>
              </Button>
            </motion.div>
            <ThemeToggle />
          </div>

          {/* Mobile Menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="lg:hidden">
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
              className="w-[300px] border-l border-border/60 bg-background sm:w-[350px]"
            >
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <SheetDescription className="sr-only">Navigate to the main sections of the site</SheetDescription>
              <div className="mt-8 flex flex-col gap-6">
                <Link
                  href="/"
                  className="flex items-center gap-2"
                  onClick={() => setIsOpen(false)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/crircpro-coe-logo.png"
                    alt="Cricpro Centre of Excellence"
                    // style={{ height: "48px", width: "auto" }}
                    height={120}
                    width={100}
                  />
                  <span className="text-lg font-bold">Cricpro</span>
                </Link>
                <nav className="flex flex-col gap-1">
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="block rounded-lg px-3 py-2 text-lg font-medium transition-colors hover:bg-primary/10 hover:text-primary"
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
