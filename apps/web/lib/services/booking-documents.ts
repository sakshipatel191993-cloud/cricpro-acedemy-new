import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type Stripe from 'stripe';
import { LOCATION } from '@/lib/location';

export interface VerifiedPayment {
  amount: number;
  currency: string;
  reference: string;
  live: boolean;
}

// Call only with a session fetched from Stripe or verified by its webhook signature.
export function verifiedPayment(session: Stripe.Checkout.Session): VerifiedPayment {
  if (session.payment_status !== 'paid' || session.currency !== 'gbp' ||
      !Number.isSafeInteger(session.amount_total) || session.amount_total! < 0) {
    throw new Error('A receipt requires a verified paid GBP checkout');
  }
  return {
    amount: session.amount_total!, currency: session.currency,
    reference: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || session.id,
    live: session.livemode,
  };
}

export interface BookingDocumentData {
  reference: string;
  customer: string;
  email: string;
  service: string;
  details: Array<[string, string]>;
  payment?: VerifiedPayment;
}

export async function bookingAttachments(data: BookingDocumentData) {
  const suffix = data.reference.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80) || 'booking';
  const attachments = [{ filename: `booking-confirmation-${suffix}.pdf`, content: Buffer.from(await renderDocument(data, false)), contentType: 'application/pdf' }];
  if (data.payment) attachments.push({ filename: `payment-receipt-${suffix}.pdf`, content: Buffer.from(await renderDocument(data, true)), contentType: 'application/pdf' });
  return attachments;
}

async function renderDocument(data: BookingDocumentData, receipt: boolean) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const title = receipt ? 'Payment receipt' : 'Booking confirmation';
  pdf.setTitle(`${title} - ${data.reference}`);
  pdf.setAuthor('Cricpro Centre of Excellence');
  const ink = rgb(0.114, 0.145, 0.267), green = rgb(0.082, 0.502, 0.239);
  // Standard PDF fonts cover Latin names. Unsupported glyphs are replaced rather
  // than allowing a customer's input to prevent their confirmation from sending.
  const safe = (value: string) => Array.from(value.normalize('NFC').replace(/[\r\n\t]+/g, ' ')).map(c => {
    try { regular.encodeText(c); return c; } catch { return '?'; }
  }).join('');
  let page = pdf.addPage([595.28, 841.89]);
  let y = 0;
  function header() {
    page.drawRectangle({ x: 0, y: 715, width: 595.28, height: 127, color: green });
    page.drawText('CRICPRO CENTRE OF EXCELLENCE', { x: 40, y: 797, size: 11, font: bold, color: rgb(1, 1, 1) });
    page.drawText(title, { x: 40, y: 755, size: 27, font: bold, color: rgb(1, 1, 1) });
    page.drawText('info@cricprocoe.com  |  cricprocoe.com', { x: 40, y: 39, size: 10, font: regular, color: ink });
    y = 686;
  }
  header();
  function line(text: string, strong = false) {
    if (y < 85) { page = pdf.addPage([595.28, 841.89]); header(); }
    page.drawText(safe(text), { x: 40, y, size: 11, font: strong ? bold : regular, color: ink });
    y -= 18;
  }
  function paragraph(text: string, strong = false) {
    let current = '';
    for (const char of safe(text)) {
      if ((strong ? bold : regular).widthOfTextAtSize(current + char, 11) > 510) { line(current, strong); current = ''; }
      current += char;
    }
    if (current) line(current, strong);
    y -= 9;
  }
  if (data.payment && !data.payment.live) paragraph('TEST PAYMENT - NO MONEY CHARGED', true);
  paragraph(receipt ? 'Payment verified successfully through Stripe.' : 'Your booking is confirmed. Please keep this document for your visit.');
  const rows: Array<[string, string]> = [
    ['Booking reference', data.reference], ['Customer', data.customer], ['Email', data.email],
    ['Service', data.service], ...data.details, ['Venue', `${LOCATION.name}, ${LOCATION.address}`],
  ];
  if (receipt && data.payment) rows.push(
    ['Receipt reference', `R-${data.reference}`],
    ['Amount received (GBP)', `£${(data.payment.amount / 100).toFixed(2)}`],
    ['Payment status', data.payment.live ? 'Paid' : 'Test payment only'],
    ['Payment processor', 'Stripe'], ['Transaction reference', data.payment.reference],
  );
  if (!receipt) rows.push(['Payment', data.payment ? (data.payment.live ? 'Paid - receipt attached separately' : 'Test payment - no money charged') : 'No verified online payment recorded']);
  for (const [label, value] of rows) paragraph(`${label}: ${value}`);
  paragraph(`Document issued: ${new Date().toLocaleDateString('en-GB', { timeZone: 'Europe/London' })}`);
  paragraph(receipt ? 'This acknowledges payment for the booking above. It is not a VAT invoice.' : 'Questions about your booking? Reply to your confirmation email.');
  return pdf.save();
}
