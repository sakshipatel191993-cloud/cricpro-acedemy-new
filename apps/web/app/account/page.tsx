"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/context/auth"
import { supabase } from "@/lib/services/supabase"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@workspace/ui/components/card"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Separator } from "@workspace/ui/components/separator"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import {
  Loader2,
  Calendar,
  Clock,
  CreditCard,
  User,
  Mail,
  Phone,
  Shield,
  LogOut,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  CalendarDays,
  ChevronRight,
  RotateCcw,
  Info,
} from "lucide-react"

// ─── Types ───────────────────────────────────────────────────────────────────

type ServiceType =
  | "lane_hire"
  | "group_session"
  | "bowling_machine"
  | "side_arm"
  | "coaching"
  | "birthday_party"
type BookingStatus =
  | "pending_payment"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "expired"
  | "refunded"
type PaymentStatus = "pending" | "paid" | "failed" | "refunded"

interface Booking {
  id: string
  booking_reference: string
  service_type: ServiceType
  booking_date: string
  start_at: string
  end_at: string
  status: BookingStatus
  payment_status: PaymentStatus
  amount: number
  customer_name: string
  customer_email: string
  notes: string | null
  created_at: string
  resource: { name: string; type: string } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SERVICE_LABELS: Record<ServiceType, string> = {
  lane_hire: "Lane Hire",
  group_session: "Group Session",
  bowling_machine: "Bowling Machine",
  side_arm: "Side Arm",
  coaching: "Coaching",
  birthday_party: "Birthday Party",
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  })
}

function formatMemberSince(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  })
}

function formatAmount(n: number) {
  return `£${Number(n).toFixed(2)}`
}

function getInitials(name?: string, email?: string) {
  if (name)
    return name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  return (email?.[0] ?? "U").toUpperCase()
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<BookingStatus, string> = {
  pending_payment: "bg-amber-100 text-amber-800 border-amber-200",
  confirmed: "bg-green-100 text-green-800 border-green-200",
  completed: "bg-slate-100 text-slate-700 border-slate-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
  expired: "bg-gray-100 text-gray-600 border-gray-200",
  refunded: "bg-purple-100 text-purple-800 border-purple-200",
}

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending_payment: "Awaiting Payment",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Expired",
  refunded: "Refunded",
}

function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

// ─── Booking Card ─────────────────────────────────────────────────────────────

function BookingCard({ booking }: { booking: Booking }) {
  const isRefunded = booking.status === "refunded"
  const isUpcoming =
    booking.status === "confirmed" && new Date(booking.start_at) > new Date()

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="p-0">
        {/* Top accent strip for upcoming bookings */}
        {isUpcoming && <div className="h-1 w-full bg-primary" />}

        <div className="p-5">
          {/* Header row */}
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-foreground">
                {SERVICE_LABELS[booking.service_type]}
              </p>
              {booking.resource && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {booking.resource.name}
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono text-xs tracking-wider text-muted-foreground">
                {booking.booking_reference}
              </p>
              <StatusBadge status={booking.status} />
            </div>
          </div>

          <Separator className="mb-3" />

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              <span>{formatDate(booking.start_at)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>
                {formatTime(booking.start_at)} – {formatTime(booking.end_at)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <CreditCard className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span>{formatAmount(booking.amount)}</span>
            </div>
            {booking.payment_status === "failed" && (
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  Payment Failed
                </span>
              </div>
            )}
          </div>

          {/* Refund note */}
          {isRefunded && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-purple-100 bg-purple-50 p-3">
              <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" />
              <p className="text-xs text-purple-700">
                Refund processed — funds returned to original payment method.
                Allow 5–10 business days.
              </p>
            </div>
          )}

          {/* Pending payment action */}
          {booking.status === "pending_payment" && (
            <div className="mt-3 flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50 p-3">
              <p className="text-xs text-amber-700">
                Payment not yet completed
              </p>
              <Link
                href={`/booking-confirm?ref=${booking.booking_reference}`}
                className="flex items-center gap-1 text-xs font-medium text-amber-800 hover:underline"
              >
                Resume <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Skeleton Loader ──────────────────────────────────────────────────────────

function BookingSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="space-y-2 text-right">
            <Skeleton className="ml-auto h-3 w-20" />
            <Skeleton className="ml-auto h-5 w-16" />
          </div>
        </div>
        <Skeleton className="h-px w-full" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AccountPage() {
  const { user, loading: authLoading, signOut } = useAuth()
  const router = useRouter()

  const [bookings, setBookings] = useState<Booking[]>([])
  const [bookingsLoading, setBookingsLoading] = useState(true)
  const [bookingsError, setBookingsError] = useState("")
  const [filter, setFilter] = useState<
    "all" | "upcoming" | "past" | "refunded"
  >("all")

  const [editing, setEditing] = useState(false)
  const [profileName, setProfileName] = useState("")
  const [profilePhone, setProfilePhone] = useState("")
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState("")
  const [profileError, setProfileError] = useState("")

  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  const [signOutLoading, setSignOutLoading] = useState(false)

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?from=/account")
    }
  }, [authLoading, user, router])

  // Seed profile edit fields from user
  useEffect(() => {
    if (user) {
      setProfileName(user.user_metadata?.full_name ?? "")
      setProfilePhone(user.user_metadata?.phone ?? "")
    }
  }, [user])

  // Fetch bookings
  const fetchBookings = useCallback(async () => {
    if (!user) return
    setBookingsLoading(true)
    setBookingsError("")
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, resource:resources(name, type)")
        .or(`user_id.eq.${user.id},customer_email.eq.${user.email}`)
        .order("start_at", { ascending: false })

      if (error) throw error
      setBookings((data as Booking[]) ?? [])
    } catch {
      setBookingsError("Failed to load bookings. Please try again.")
    } finally {
      setBookingsLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) fetchBookings()
  }, [user, fetchBookings])

  // Filter logic
  const now = new Date()
  const filteredBookings = bookings.filter((b) => {
    if (filter === "upcoming")
      return b.status === "confirmed" && new Date(b.start_at) > now
    if (filter === "past")
      return (
        b.status === "completed" ||
        (b.status === "confirmed" && new Date(b.start_at) <= now)
      )
    if (filter === "refunded") return b.status === "refunded"
    return true
  })

  // Profile save
  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault()
    setProfileSaving(true)
    setProfileError("")
    setProfileSuccess("")
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: profileName, phone: profilePhone },
      })
      if (error) throw error
      setProfileSuccess("Profile updated successfully.")
      setEditing(false)
    } catch (err: unknown) {
      setProfileError(
        err instanceof Error ? err.message : "Failed to update profile."
      )
    } finally {
      setProfileSaving(false)
    }
  }

  // Password reset
  async function handlePasswordReset() {
    if (!user?.email) return
    setResetLoading(true)
    try {
      await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      setResetSent(true)
    } finally {
      setResetLoading(false)
    }
  }

  // Sign out
  async function handleSignOut() {
    setSignOutLoading(true)
    await signOut()
    router.push("/")
  }

  // Full-page loading
  if (authLoading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    )
  }

  const fullName = user.user_metadata?.full_name as string | undefined
  const displayName = fullName || user.email?.split("@")[0] || "Account"
  const initials = getInitials(fullName, user.email)

  // Booking counts for filter tabs
  const upcomingCount = bookings.filter(
    (b) => b.status === "confirmed" && new Date(b.start_at) > now
  ).length
  const refundedCount = bookings.filter((b) => b.status === "refunded").length

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* ── Profile Header ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
            {initials}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold text-foreground">
              {displayName}
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              {user.email}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Member since {formatMemberSince(user.created_at)}
            </p>
          </div>
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────── */}
        <Tabs defaultValue="bookings" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="bookings" className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              My Bookings
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              Security
            </TabsTrigger>
          </TabsList>

          {/* ── My Bookings Tab ──────────────────────────────────────────── */}
          <TabsContent value="bookings" className="space-y-4">
            {/* Filter buttons */}
            <div className="flex flex-wrap gap-2">
              {[
                { key: "all", label: `All (${bookings.length})` },
                {
                  key: "upcoming",
                  label: `Upcoming${upcomingCount > 0 ? ` (${upcomingCount})` : ""}`,
                },
                { key: "past", label: "Past" },
                {
                  key: "refunded",
                  label: `Refunded${refundedCount > 0 ? ` (${refundedCount})` : ""}`,
                },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key as typeof filter)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    filter === key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                onClick={fetchBookings}
                className="ml-auto flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                title="Refresh bookings"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${bookingsLoading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>

            {/* Error */}
            {bookingsError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{bookingsError}</AlertDescription>
              </Alert>
            )}

            {/* Loading skeletons */}
            {bookingsLoading && (
              <div className="space-y-3">
                <BookingSkeleton />
                <BookingSkeleton />
                <BookingSkeleton />
              </div>
            )}

            {/* Bookings list */}
            {!bookingsLoading && filteredBookings.length > 0 && (
              <div className="space-y-3">
                {filteredBookings.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} />
                ))}
              </div>
            )}

            {/* Empty state */}
            {!bookingsLoading &&
              filteredBookings.length === 0 &&
              !bookingsError && (
                <Card>
                  <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                      <CalendarDays className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        {filter === "all"
                          ? "No bookings yet"
                          : `No ${filter} bookings`}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {filter === "all"
                          ? "Your booking history will appear here once you make a reservation."
                          : "Nothing to show for this filter."}
                      </p>
                    </div>
                    {filter === "all" && (
                      <Button asChild size="sm" className="mt-2">
                        <Link href="/lane-hire">Book a Session</Link>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
          </TabsContent>

          {/* ── Profile Tab ──────────────────────────────────────────────── */}
          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">
                      Personal Details
                    </CardTitle>
                    <CardDescription>
                      Your name and contact information
                    </CardDescription>
                  </div>
                  {!editing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(true)}
                    >
                      Edit Profile
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {profileSuccess && (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700">
                      {profileSuccess}
                    </AlertDescription>
                  </Alert>
                )}
                {profileError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{profileError}</AlertDescription>
                  </Alert>
                )}

                {editing ? (
                  <form onSubmit={handleProfileSave} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        placeholder="Your full name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email-display">Email</Label>
                      <Input
                        id="email-display"
                        value={user.email ?? ""}
                        disabled
                      />
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Info className="h-3 w-3" />
                        Contact support to change your email address.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={profilePhone}
                        onChange={(e) => setProfilePhone(e.target.value)}
                        placeholder="+44 7700 000000"
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button type="submit" size="sm" disabled={profileSaving}>
                        {profileSaving ? (
                          <>
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            Saving…
                          </>
                        ) : (
                          "Save Changes"
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(false)
                          setProfileError("")
                          setProfileName(user.user_metadata?.full_name ?? "")
                          setProfilePhone(user.user_metadata?.phone ?? "")
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-3">
                    {[
                      {
                        icon: User,
                        label: "Full Name",
                        value: fullName || (
                          <span className="text-muted-foreground italic">
                            Not set
                          </span>
                        ),
                      },
                      { icon: Mail, label: "Email", value: user.email },
                      {
                        icon: Phone,
                        label: "Phone",
                        value: user.user_metadata?.phone || (
                          <span className="text-muted-foreground italic">
                            Not set
                          </span>
                        ),
                      },
                      {
                        icon: Calendar,
                        label: "Member Since",
                        value: formatMemberSince(user.created_at),
                      },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex items-start gap-3 py-2">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">
                            {label}
                          </p>
                          <p className="mt-0.5 text-sm text-foreground">
                            {value}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Security Tab ─────────────────────────────────────────────── */}
          <TabsContent value="security" className="space-y-4">
            {/* Password reset */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Password</CardTitle>
                <CardDescription>
                  Change your account password via email link
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {resetSent ? (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700">
                      Check your inbox — we&apos;ve sent a password reset link
                      to <strong>{user.email}</strong>.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        We&apos;ll send a secure link to{" "}
                        <strong className="text-foreground">
                          {user.email}
                        </strong>{" "}
                        to reset your password.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={handlePasswordReset}
                      disabled={resetLoading}
                    >
                      {resetLoading ? (
                        <>
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          Sending…
                        </>
                      ) : (
                        "Send Reset Email"
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sign Out */}
            <Card className="border-destructive/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-destructive">
                  Sign Out
                </CardTitle>
                <CardDescription>
                  Sign out of your account on this device
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleSignOut}
                  disabled={signOutLoading}
                  className="flex items-center gap-2"
                >
                  {signOutLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Signing out…
                    </>
                  ) : (
                    <>
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
