import { Resend } from "resend"
import { sendDurableEmail } from "@/lib/services/outbox-delivery"
import { LOCATION } from "@/lib/location"
import { bookingAttachments, type VerifiedPayment } from "@/lib/services/booking-documents"
import { couponRows, type CouponSnapshot } from "@/lib/coupon-summary"

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM = process.env.EMAIL_FROM ?? "noreply@cricprocoe.com"
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "info@cricprocoe.com"

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

// Resend's shared test domain ("onboarding@resend.dev") can only deliver to the
// email address of the account owner — never to customers. Warn loudly so this
// misconfiguration is impossible to miss in server logs.
const USING_TEST_FROM = FROM === "onboarding@resend.dev"

async function send(
  to: string,
  subject: string,
  html: string,
  replyTo: string = ADMIN_EMAIL,
  attachments?: Awaited<ReturnType<typeof bookingAttachments>>,
  outboxId?: string
): Promise<boolean> {
  if (outboxId) return sendDurableEmail(outboxId, { from: FROM, to, subject, html, replyTo, attachments })
  if (!resend) {
    console.warn(
      `[EMAIL] RESEND_API_KEY not set — not sending. To: ${to} | Subject: ${subject}`
    )
    return false
  }

  if (USING_TEST_FROM) {
    console.warn(
      `[EMAIL] EMAIL_FROM is "onboarding@resend.dev", which Resend can only deliver to your own account email. ` +
        `Emails to "${to}" will NOT be delivered until you verify a domain and set EMAIL_FROM.`
    )
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to,
      subject,
      html,
      replyTo,
      attachments,
    })
    if (error) {
      console.error("[EMAIL] Send failed:", JSON.stringify(error))
      return false
    }
    console.log(`[EMAIL] Sent to ${to} — ${subject} (id: ${data?.id})`)
    return true
  } catch (err) {
    console.error("[EMAIL] Send threw:", err)
    return false
  }
}

// ─── Templates ────────────────────────────────────────────────────────────────

export interface BookingEmailData {
  booking_reference: string
  service_type: string
  resource_name?: string
  booking_date: string
  start_at: string
  end_at?: string
  amount: string
  customer_name: string
  customer_email: string
  player_count?: number | null
  payment?: VerifiedPayment
  coupon_snapshot?: CouponSnapshot | null
  quote_id?: string | null
  block_session_count?: number
  block_schedule?: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatTime(iso: string, quoteId?: string | null): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        // Authoritative quotes store real UTC instants. Legacy rows without a
        // quote retain their historical wall-clock interpretation until audited.
        timeZone: quoteId ? "Europe/London" : "UTC",
      })
}

function bookingConfirmationHtml(b: BookingEmailData) {
  const service = titleCase(b.service_type)
  const date = new Date(b.booking_date).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
  const startTime = formatTime(b.start_at, b.quote_id)
  const endTime = b.end_at ? formatTime(b.end_at, b.quote_id) : null
  const time =
    endTime && endTime !== startTime ? `${startTime} – ${endTime}` : startTime
  const rows: Array<[string, string]> = [
    ["Reference", b.booking_reference],
    ["Service", service],
  ]
  if (b.resource_name) {
    rows.push([
      b.service_type === "lane_hire" ? "Lane" : "Facility",
      b.resource_name,
    ])
  }
  if (b.block_schedule) {
    rows.push(["Sessions", String(b.block_session_count ?? "")], ["Schedule", b.block_schedule])
  } else {
    rows.push(["Date", date], ["Time", time])
  }
  if (b.player_count) {
    rows.push([
      "Players",
      b.player_count === 1 ? "1 player" : `${b.player_count} players`,
    ])
  }
  rows.push(...couponRows(b.coupon_snapshot), ["Amount", `£${Number(b.amount).toFixed(2)}`])

  return customerBookingConfirmationHtml(b.customer_name, rows, "Please arrive 5 minutes before your session starts.")
}

function customerBookingConfirmationHtml(customerName: string, rows: Array<[string, string]>, arrivalNote: string) {
  const firstName = escapeHtml(customerName.split(" ")[0] || customerName)
  const detailRows = rows
    .map(([label, value], index) => {
      const isLast = index === rows.length - 1
      const divider = isLast ? "" : "border-bottom:1px solid #eef0f4;"
      const isAmount = label === "Amount"
      return `
      <tr>
        <td style="padding:13px 16px;${divider}color:#5b6472;font-size:14px;width:40%;">${escapeHtml(label)}</td>
        <td style="padding:13px 16px;${divider}color:${isAmount ? "#16a34a" : "#1d2544"};font-size:14px;font-weight:${isAmount ? "700" : "600"};text-align:right;overflow-wrap:anywhere;">${escapeHtml(value)}</td>
      </tr>`
    })
    .join("")

  return `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Booking Confirmed</title>
    </head>
    <body style="margin:0;padding:0;background-color:#f4f5f1;font-family:Arial,Helvetica,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f1;padding:24px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
              <tr>
                <td style="background-color:#16a34a;padding:28px 32px;border-radius:12px 12px 0 0;">
                  <p style="margin:0;font-size:12px;letter-spacing:1.5px;color:#ffffff;text-transform:uppercase;opacity:0.9;">Cricpro Centre of Excellence</p>
                  <h1 style="margin:8px 0 0;font-size:26px;line-height:1.2;color:#ffffff;font-weight:700;">Booking Confirmed!</h1>
                </td>
              </tr>
              <tr>
                <td style="background-color:#ffffff;padding:32px;">
                  <p style="margin:0 0 8px;font-size:16px;color:#1d2544;font-weight:700;">Hi ${firstName},</p>
                  <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#5b6472;">Thanks for booking with Cricpro. Your session is locked in — here are the details.</p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e7ec;border-radius:8px;">${detailRows}
                  </table>
                  <div style="margin:20px 0 0;padding:16px;background-color:#f4f5f1;border-radius:8px;">
                    <p style="margin:0 0 2px;font-size:13px;color:#5b6472;font-weight:700;">Where to find us</p>
                    <p style="margin:0;font-size:14px;color:#1d2544;font-weight:700;">${LOCATION.name}</p>
                    <p style="margin:2px 0 12px;font-size:14px;color:#1d2544;">${LOCATION.address}</p>
                    <p style="margin:0;">
                      <a href="${LOCATION.googleMapsUrl}" style="color:#16a34a;font-size:13px;font-weight:600;text-decoration:none;">Open in Google Maps</a>
                      <span style="color:#5b6472;">&nbsp;&middot;&nbsp;</span>
                      <a href="${LOCATION.appleMapsUrl}" style="color:#16a34a;font-size:13px;font-weight:600;text-decoration:none;">Open in Apple Maps</a>
                    </p>
                  </div>
                  <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#5b6472;">${escapeHtml(arrivalNote)}</p>
                </td>
              </tr>
              <tr>
                <td style="background-color:#1d2544;padding:24px 32px;border-radius:0 0 12px 12px;text-align:center;">
                  <p style="margin:0;font-size:14px;font-weight:700;color:#ffffff;">Cricpro Centre of Excellence</p>
                  <p style="margin:6px 0 0;font-size:12px;color:#ffffff;opacity:0.7;">${LOCATION.address}</p>
                  <p style="margin:6px 0 0;font-size:12px;color:#ffffff;opacity:0.7;">Practice to Perfection</p>
                  <p style="margin:12px 0 0;font-size:12px;color:#ffffff;opacity:0.7;">info@cricprocoe.com</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`
}

// Match the established booking email: green header, white details, navy footer.
// Only trusted template markup is passed as content; all data is escaped here.
function brandedEmail(title: string, intro: string, rows: Array<[string, string]>, content = "") {
  const details = rows.map(([label, value]) => `<tr><th scope="row" style="padding:13px 12px;border-bottom:1px solid #eef0f4;text-align:left;vertical-align:top;width:34%;font-size:14px;color:#5b6472;font-weight:400;">${escapeHtml(label)}</th><td style="padding:13px 12px;border-bottom:1px solid #eef0f4;font-size:14px;color:#1d2544;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(value)}</td></tr>`).join("")
  return `<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
  <body style="margin:0;padding:0;background-color:#f4f5f1;font-family:Arial,Helvetica,sans-serif;">
  <table lang="en" dir="ltr" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f1;padding:24px 12px;"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;table-layout:fixed;">
  <tr><td style="background-color:#15803d;padding:28px 24px;border-radius:12px 12px 0 0;color:#ffffff;"><p style="margin:0;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;">Cricpro Centre of Excellence</p><h1 style="margin:8px 0 0;font-size:26px;line-height:1.25;">${escapeHtml(title)}</h1></td></tr>
  <tr><td style="background-color:#ffffff;padding:24px;color:#1d2544;font-size:15px;line-height:1.6;overflow-wrap:anywhere;"><p style="margin:0 0 20px;">${escapeHtml(intro)}</p>
  ${rows.length ? `<table width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;border:1px solid #e4e7ec;border-radius:8px;">${details}</table>` : ""}${content}</td></tr>
  <tr><td style="background-color:#1d2544;padding:24px;border-radius:0 0 12px 12px;text-align:center;color:#ffffff;"><p style="margin:0;font-size:14px;font-weight:700;">Cricpro Centre of Excellence</p><p style="margin:8px 0;font-size:13px;">${escapeHtml(LOCATION.address)}</p><p style="margin:8px 0;font-size:13px;">Practice to Perfection</p><a href="mailto:info@cricprocoe.com" style="color:#ffffff;font-size:13px;">info@cricprocoe.com</a></td></tr>
  </table></td></tr></table></body></html>`
}

function inquiryConfirmationHtml(name: string, type: string) {
  const subject =
    type === "birthday_party"
      ? "Birthday Party"
      : type === "coaching"
        ? "Coaching"
        : "General"
  return brandedEmail("Enquiry Received!", `Hi ${name}, thanks for getting in touch. Our team will review your enquiry and get back to you soon.`, [["Enquiry type", subject], ["Status", "Received"]], '<p style="margin:24px 0 0;">You can reply to this email if you would like to add anything.</p><p><a href="https://cricprocoe.com" style="color:#15803d;">Visit the Cricpro website</a></p>')
}

function groupSessionConfirmationHtml(
  booking: {
    booking_reference: string
    player_name: string
    parent_name: string
    coupon_snapshot?: CouponSnapshot | null
  },
  session: { title: string; price: string; session_kind?: string; schedule?: string }
) {
  const rows: Array<[string, string]> = [
    ["Reference", booking.booking_reference],
    ["Service", session.session_kind === 'masterclass' ? 'Masterclass' : 'Group Session'],
    ["Player", booking.player_name],
    ["Session", session.title],
    ...(session.schedule ? [["Schedule", session.schedule] as [string, string]] : []),
    ...couponRows(booking.coupon_snapshot),
    ["Amount", `£${Number(session.price).toFixed(2)}`],
  ]
  return customerBookingConfirmationHtml(booking.parent_name, rows, "Please arrive 10 minutes before the session starts. Full cricket kit is recommended.")
}

// ─── Exported functions ───────────────────────────────────────────────────────

export async function sendGuestBookingAccess(recipient: string, accessUrl: string) {
  // Do not log the link/token or put player details in the subject.
  const html = brandedEmail(
    'View your booking', 'You requested access to one CricPro booking.', [],
    `<p><a href="${escapeHtml(accessUrl)}" style="display:inline-block;padding:14px 20px;background:#15803d;color:white;">View booking securely</a></p><p>This single-use link expires in 15 minutes. Anyone you forward it to can access this booking. If you did not request it, ignore this email. For help reply to this email or contact info@cricprocoe.com.</p>`
  );
  if (!resend) return false;
  try {
    const { error } = await resend.emails.send({ from:FROM,to:recipient,subject:'Your secure CricPro booking access link',html,replyTo:ADMIN_EMAIL });
    if (error) console.warn('[EMAIL] Booking access delivery failed');
    return !error;
  } catch { console.warn('[EMAIL] Booking access delivery unavailable'); return false; }
}

function withBookingAccess(html: string, reference: string) {
  if (process.env.GUEST_BOOKING_ACCESS_ENABLED !== 'true') return html;
  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (!base) return html;
  const url = new URL('/booking-access',base).toString();
  return html.replace('</body>', `<p style="padding:20px;text-align:center;font-family:Arial,sans-serif;"><a href="${escapeHtml(url)}">View booking and download documents securely</a><br>Booking reference: ${escapeHtml(reference)}<br>Use your booking email to request a private access link.</p></body>`);
}

export async function sendBookingConfirmation(booking: BookingEmailData, outboxId?: string) {
  const details: Array<[string, string]> = [
    ...couponRows(booking.coupon_snapshot),
    ...(booking.block_schedule
      ? [["Sessions", String(booking.block_session_count ?? "")], ["Schedule", booking.block_schedule]] as Array<[string, string]>
      : [["Date", booking.booking_date], ["Time", `${formatTime(booking.start_at, booking.quote_id)}${booking.end_at ? ` - ${formatTime(booking.end_at, booking.quote_id)}` : ""}`]] as Array<[string, string]>),
    ...(booking.resource_name ? [["Facility", booking.resource_name] as [string, string]] : []),
  ];
  const attachments = await bookingAttachments({
    reference: booking.booking_reference, customer: booking.customer_name, email: booking.customer_email,
    service: titleCase(booking.service_type), payment: booking.payment,
    details,
  })
  return send(
    booking.customer_email,
    `Booking Confirmed – ${booking.booking_reference} | Cricpro Centre of Excellence`,
    withBookingAccess(bookingConfirmationHtml(booking),booking.booking_reference), ADMIN_EMAIL, attachments, outboxId
  )
}

export async function sendAdminBookingNotification(booking: {
  coupon_snapshot?: CouponSnapshot | null
  quote_id?: string | null
  booking_reference: string
  service_type: string
  booking_date: string
  start_at: string
  amount: string
  customer_name: string
  customer_email: string
  resource_name?: string
  block_session_count?: number
  block_schedule?: string
}, outboxId?: string) {
  const service = booking.service_type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
  const rows: Array<[string, string]> = [
    ["Reference", booking.booking_reference], ["Service", service],
    ["Customer", booking.customer_name], ["Email", booking.customer_email],
    ...(booking.resource_name ? [["Facility", booking.resource_name] as [string, string]] : []),
    ...(booking.block_schedule
      ? [["Sessions", String(booking.block_session_count ?? "")], ["Schedule", booking.block_schedule]] as Array<[string, string]>
      : [["Date", booking.booking_date], ["Start time", formatTime(booking.start_at, booking.quote_id)]] as Array<[string, string]>),
    ...couponRows(booking.coupon_snapshot),
    ["Amount", `£${Number(booking.amount).toFixed(2)}`],
  ];
  return send(
    ADMIN_EMAIL,
    `New Booking: ${booking.booking_reference} – ${service}`,
    brandedEmail("New Booking Received", "A new booking has been received. The customer and session details are below.", rows, '<p style="margin:24px 0 0;">Reply to this email to contact the customer.</p>'),
    booking.customer_email, undefined, outboxId
  )
}

export async function sendInquiryConfirmation(inquiry: {
  name: string
  email: string
  type: string
}) {
  return send(
    inquiry.email,
    `Enquiry Received | Cricpro Centre of Excellence`,
    inquiryConfirmationHtml(inquiry.name, inquiry.type),
    ADMIN_EMAIL
  )
}

export async function sendAdminInquiryNotification(inquiry: {
  name: string
  email: string
  type: string
  message: string
  phone?: string | null
}) {
  return send(
    ADMIN_EMAIL,
    `New Enquiry from ${inquiry.name}`,
    brandedEmail("New Enquiry Received", "A customer has sent an enquiry through the website.", [
      ["Name", inquiry.name], ["Email", inquiry.email],
      ["Phone", inquiry.phone || "Not provided"], ["Enquiry type", titleCase(inquiry.type)],
    ], `<h2 style="margin:24px 0 8px;font-size:18px;">Customer message</h2><div style="padding:16px;background-color:#f4f5f1;border-radius:8px;overflow-wrap:anywhere;">${escapeHtml(inquiry.message).replace(/\r?\n/g, "<br>")}</div><p style="margin:24px 0 0;">Reply to this email to contact the customer.</p>`),
    inquiry.email
  )
}

export async function sendGroupSessionConfirmation(
  booking: { id: string; booking_reference: string; player_name: string; parent_name: string; parent_email: string; coupon_snapshot?: CouponSnapshot | null },
  session: { title: string; price: string; session_kind?: string; schedule?: string },
  payment?: VerifiedPayment,
  outboxId?: string
) {
  const attachments = await bookingAttachments({ reference: booking.booking_reference, customer: booking.parent_name,
    email: booking.parent_email, service: session.title, payment,
    details: [...couponRows(booking.coupon_snapshot), ["Player", booking.player_name], ...(session.schedule ? [["Schedule", session.schedule] as [string, string]] : [])],
  })
  return send(
    booking.parent_email,
    `Booking Confirmed – ${booking.booking_reference} | Cricpro Centre of Excellence`,
    withBookingAccess(groupSessionConfirmationHtml(booking, session),booking.booking_reference), ADMIN_EMAIL, attachments, outboxId
  )
}
