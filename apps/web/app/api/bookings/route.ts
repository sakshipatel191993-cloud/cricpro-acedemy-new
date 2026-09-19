import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/services/supabase"
import {
  sendBookingConfirmation,
  sendAdminBookingNotification,
} from "@/lib/services/email"
import { paymentsEnabled, createCheckoutSession } from "@/lib/services/stripe"
import { rateLimit } from "@/lib/utils/rate-limit"
import type { DbBooking } from "@/lib/db/schema"
import { isPeakHour } from "@/lib/hours"

const notConfigured = () =>
  NextResponse.json(
    {
      success: false,
      error: "Database not configured. Add Supabase credentials to .env.local.",
    },
    { status: 503 }
  )

function generateBookingReference(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let result = "NGCA-"
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured) return notConfigured()
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get("status")
    const email = searchParams.get("email")
    const date = searchParams.get("date")

    let query = supabaseAdmin
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false })

    if (status) query = query.eq("status", status)
    if (email) query = query.eq("customer_email", email)
    if (date) {
      const startOfDay = new Date(date)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(date)
      endOfDay.setHours(23, 59, 59, 999)
      query = query
        .gte("booking_date", startOfDay.toISOString())
        .lte("booking_date", endOfDay.toISOString())
    }

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ success: true, bookings: data })
  } catch (error) {
    console.error("Bookings list error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch bookings" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) return notConfigured()

  // Rate limit: 10 booking attempts per minute per IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0] ??
    request.headers.get("x-real-ip") ??
    "unknown"
  const rl = rateLimit(`booking:${ip}`, 10, 60_000)
  if (!rl.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Too many requests. Please wait a moment and try again.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
        },
      }
    )
  }

  try {
    const body = await request.json()
    const {
      resourceId,
      serviceType,
      bookingDate,
      startAt,
      endAt,
      customerName,
      customerEmail,
      customerPhone,
      playerCount,
      notes,
    } = body

    if (
      !serviceType ||
      !bookingDate ||
      !startAt ||
      !endAt ||
      !customerName ||
      !customerEmail
    ) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Bowling machine and side arm use a lane as the underlying resource
    const laneBasedServices = ["bowling_machine", "side_arm"]
    let resolvedResourceId: string = resourceId

    if (laneBasedServices.includes(serviceType) && !resourceId) {
      // Find the first available lane for this time slot
      const { data: allLanes } = await supabaseAdmin
        .from("resources")
        .select("id")
        .eq("type", "lane")
        .eq("active", true)

      if (!allLanes || allLanes.length === 0) {
        return NextResponse.json(
          { success: false, error: "No lanes available" },
          { status: 409 }
        )
      }

      // Find bookedLaneIds for this slot
      const { data: laneBookings } = await supabaseAdmin
        .from("bookings")
        .select("resource_id")
        .in(
          "resource_id",
          allLanes.map((l) => l.id)
        )
        .in("status", ["confirmed", "pending_payment"])
        .lt("start_at", endAt)
        .gt("end_at", startAt)

      const bookedLaneIds = new Set(
        (laneBookings || []).map((b) => b.resource_id)
      )
      const availableLane = allLanes.find((l) => !bookedLaneIds.has(l.id))

      if (!availableLane) {
        return NextResponse.json(
          {
            success: false,
            error: "All lanes are fully booked for this time slot",
          },
          { status: 409 }
        )
      }

      resolvedResourceId = availableLane.id
    }

    if (!resolvedResourceId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Check for conflicting bookings on the resolved resource
    const { data: existingBookings } = await supabaseAdmin
      .from("bookings")
      .select("id")
      .eq("resource_id", resolvedResourceId)
      .in("status", ["confirmed", "pending_payment"])
      .lt("start_at", endAt)
      .gt("end_at", startAt)

    if (existingBookings && existingBookings.length > 0) {
      return NextResponse.json(
        { success: false, error: "Time slot is already booked" },
        { status: 409 }
      )
    }

    // Check blocked slots
    const { data: blockedSlots } = await supabaseAdmin
      .from("blocked_slots")
      .select("id")
      .eq("resource_id", resolvedResourceId)
      .lt("start_at", endAt)
      .gt("end_at", startAt)

    if (blockedSlots && blockedSlots.length > 0) {
      return NextResponse.json(
        { success: false, error: "Time slot is blocked" },
        { status: 409 }
      )
    }

    // Calculate price from slot pricing
    const startDate = new Date(startAt)
    const hour = startDate.getHours()
    const dayOfWeek = startDate.getDay()
    const isPeak = isPeakHour(dayOfWeek, hour)
    let pricePerHour: number
    if (serviceType === "bowling_machine") {
      pricePerHour = isPeak ? 32 : 22
    } else if (serviceType === "side_arm") {
      pricePerHour = isPeak ? 30 : 25
    } else {
      pricePerHour = isPeak ? 25 : 15
    }

    const startTime = new Date(startAt)
    const endTime = new Date(endAt)
    const hours = Math.max(
      1,
      Math.ceil((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60))
    )
    const amount = (pricePerHour * hours).toFixed(2)

    const bookingReference = generateBookingReference()
    const status = paymentsEnabled ? "pending_payment" : "confirmed"

    const booking: Partial<DbBooking> = {
      booking_reference: bookingReference,
      resource_id: resolvedResourceId,
      service_type: serviceType,
      booking_date: bookingDate,
      start_at: startAt,
      end_at: endAt,
      status,
      payment_status: "pending",
      amount,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone || null,
      player_count: playerCount || null,
      notes: notes || null,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    }

    const { data, error } = await supabaseAdmin
      .from("bookings")
      .insert(booking)
      .select()
      .single()
    if (error) throw error

    // Stripe payment flow
    if (paymentsEnabled) {
      const serviceLabel = serviceType
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c: string) => c.toUpperCase())
      const { sessionId, url } = await createCheckoutSession({
        bookingId: data.id,
        bookingReference,
        serviceType,
        amount,
        customerEmail,
        customerName,
        description: `${serviceLabel} – ${new Date(bookingDate).toLocaleDateString("en-GB")}`,
      })
      await supabaseAdmin
        .from("bookings")
        .update({ stripe_session_id: sessionId })
        .eq("id", data.id)
      return NextResponse.json({
        success: true,
        booking: data,
        paymentUrl: url,
        expiresAt: booking.expires_at,
      })
    }

    // Confirmed immediately (payments disabled or Stripe error)
    if (status === "confirmed") {
      await Promise.allSettled([sendBookingConfirmation({
        ...data,
        customer_name: customerName,
        customer_email: customerEmail,
      }),
      sendAdminBookingNotification({
        ...data,
        customer_name: customerName,
        customer_email: customerEmail,
      })])
    }

    return NextResponse.json({
      success: true,
      booking: data,
      expiresAt: booking.expires_at,
    })
  } catch (error: any) {
    console.error("Booking creation error:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to create booking" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSupabaseConfigured) return notConfigured()
  try {
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get("id")
    const email = searchParams.get("email")

    if (!id)
      return NextResponse.json(
        { success: false, error: "Booking ID is required" },
        { status: 400 }
      )

    let query = supabaseAdmin
      .from("bookings")
      .select("id, customer_email, status")
      .eq("id", id)
    if (email) query = query.eq("customer_email", email)

    const { data: existingBooking, error: fetchError } = await query.single()
    if (fetchError || !existingBooking) {
      return NextResponse.json(
        { success: false, error: "Booking not found" },
        { status: 404 }
      )
    }

    if (
      !["pending_payment", "pending", "confirmed"].includes(
        existingBooking.status
      )
    ) {
      return NextResponse.json(
        { success: false, error: "Booking cannot be cancelled" },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from("bookings")
      .update({ status: "cancelled", payment_status: "refunded" })
      .eq("id", id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, booking: data })
  } catch (error) {
    console.error("Booking cancellation error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to cancel booking" },
      { status: 500 }
    )
  }
}
