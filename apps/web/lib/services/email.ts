import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM ?? 'noreply@nextgencricket.co.uk';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@nextgencricket.co.uk';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// Resend's shared test domain ("onboarding@resend.dev") can only deliver to the
// email address of the account owner — never to customers. Warn loudly so this
// misconfiguration is impossible to miss in server logs.
const USING_TEST_FROM = FROM === 'onboarding@resend.dev';

async function send(to: string, subject: string, html: string): Promise<boolean> {
  if (!resend) {
    console.warn(`[EMAIL] RESEND_API_KEY not set — not sending. To: ${to} | Subject: ${subject}`);
    return false;
  }

  if (USING_TEST_FROM) {
    console.warn(
      `[EMAIL] EMAIL_FROM is "onboarding@resend.dev", which Resend can only deliver to your own account email. ` +
        `Emails to "${to}" will NOT be delivered until you verify a domain and set EMAIL_FROM.`
    );
  }

  try {
    const { data, error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) {
      console.error('[EMAIL] Send failed:', JSON.stringify(error));
      return false;
    }
    console.log(`[EMAIL] Sent to ${to} — ${subject} (id: ${data?.id})`);
    return true;
  } catch (err) {
    console.error('[EMAIL] Send threw:', err);
    return false;
  }
}

// ─── Templates ────────────────────────────────────────────────────────────────

export interface BookingEmailData {
  booking_reference: string;
  service_type: string;
  booking_date: string;
  start_at: string;
  end_at?: string;
  amount: string;
  customer_name: string;
  customer_email: string;
  player_count?: number | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function bookingConfirmationHtml(b: BookingEmailData) {
  const service = titleCase(b.service_type);
  const date = new Date(`${b.booking_date}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const startTime = formatTime(b.start_at);
  const endTime = b.end_at ? formatTime(b.end_at) : null;
  const time = endTime && endTime !== startTime ? `${startTime} – ${endTime}` : startTime;
  const firstName = escapeHtml(b.customer_name.split(' ')[0] || b.customer_name);

  const rows: Array<[string, string]> = [
    ['Reference', escapeHtml(b.booking_reference)],
    ['Service', escapeHtml(service)],
    ['Date', date],
    ['Time', time],
  ];
  if (b.player_count) {
    rows.push(['Players', b.player_count === 1 ? '1 player' : `${b.player_count} players`]);
  }
  rows.push(['Amount', `£${b.amount}`]);

  const detailRows = rows
    .map(([label, value], index) => {
      const isLast = index === rows.length - 1;
      const divider = isLast ? '' : 'border-bottom:1px solid #eef0f4;';
      const isAmount = label === 'Amount';
      return `
      <tr>
        <td style="padding:13px 16px;${divider}color:#5b6472;font-size:14px;width:40%;">${label}</td>
        <td style="padding:13px 16px;${divider}color:${isAmount ? '#c21d4c' : '#1d2544'};font-size:14px;font-weight:${isAmount ? '700' : '600'};text-align:right;">${value}</td>
      </tr>`;
    })
    .join('');

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
                <td style="background-color:#c21d4c;padding:28px 32px;border-radius:12px 12px 0 0;">
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
                  <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#5b6472;">Please arrive 5 minutes before your session starts. Need to change anything? Just reply to this email.</p>
                </td>
              </tr>
              <tr>
                <td style="background-color:#1d2544;padding:24px 32px;border-radius:0 0 12px 12px;text-align:center;">
                  <p style="margin:0;font-size:14px;font-weight:700;color:#ffffff;">Cricpro Centre of Excellence</p>
                  <p style="margin:6px 0 0;font-size:12px;color:#ffffff;opacity:0.7;">Practice to Perfection</p>
                  <p style="margin:12px 0 0;font-size:12px;color:#ffffff;opacity:0.7;">info@nextgencricket.co.uk</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;
}

function inquiryConfirmationHtml(name: string, type: string) {
  const subject = type === 'birthday_party' ? 'Birthday Party' : type === 'coaching' ? 'Coaching' : 'General';
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1d2544">
      <h2 style="color:#c21d4c">Thanks for your enquiry!</h2>
      <p>Hi ${name}, we've received your ${subject} enquiry and will be in touch within 24 hours.</p>
      <p style="color:#666;font-size:14px">In the meantime, feel free to browse our <a href="https://nextgencricket.co.uk" style="color:#c21d4c">website</a> for more information.</p>
      <p style="color:#666;font-size:12px;margin-top:24px">Cricpro Centre of Excellence</p>
    </div>`;
}

function groupSessionConfirmationHtml(booking: {
  player_name: string;
  parent_name: string;
}, session: { title: string; price: string }) {
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1d2544">
      <h2 style="color:#c21d4c">Group Session Booking Confirmed!</h2>
      <p>Hi ${booking.parent_name},</p>
      <p>${booking.player_name} has been successfully registered for <strong>${session.title}</strong>.</p>
      <p>Session fee: <strong>£${session.price}</strong></p>
      <p style="color:#666;font-size:14px">Please ensure your player arrives 10 minutes before the session starts. Full cricket kit is recommended.</p>
      <p style="color:#666;font-size:12px;margin-top:24px">Cricpro Centre of Excellence</p>
    </div>`;
}

// ─── Exported functions ───────────────────────────────────────────────────────

export async function sendBookingConfirmation(booking: BookingEmailData) {
  await send(
    booking.customer_email,
    `Booking Confirmed – ${booking.booking_reference} | Cricpro Centre of Excellence`,
    bookingConfirmationHtml(booking)
  );
}

export async function sendAdminBookingNotification(booking: {
  booking_reference: string;
  service_type: string;
  booking_date: string;
  start_at: string;
  amount: string;
  customer_name: string;
  customer_email: string;
}) {
  const service = booking.service_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  await send(
    ADMIN_EMAIL,
    `New Booking: ${booking.booking_reference} – ${service}`,
    `<p>New booking received:</p><pre>${JSON.stringify(booking, null, 2)}</pre>`
  );
}

export async function sendInquiryConfirmation(inquiry: {
  name: string;
  email: string;
  type: string;
}) {
  await send(
    inquiry.email,
    `Enquiry Received | Cricpro Centre of Excellence`,
    inquiryConfirmationHtml(inquiry.name, inquiry.type)
  );
}

export async function sendAdminInquiryNotification(inquiry: {
  name: string;
  email: string;
  type: string;
  message: string;
}) {
  await send(
    ADMIN_EMAIL,
    `New Enquiry from ${inquiry.name}`,
    `<p>New enquiry received:</p><pre>${JSON.stringify(inquiry, null, 2)}</pre>`
  );
}

export async function sendGroupSessionConfirmation(
  booking: { player_name: string; parent_name: string; parent_email: string },
  session: { title: string; price: string }
) {
  await send(
    booking.parent_email,
    `Group Session Booking Confirmed | Cricpro Centre of Excellence`,
    groupSessionConfirmationHtml(booking, session)
  );
}
