import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/services/supabase';
import { sendInquiryConfirmation, sendAdminInquiryNotification } from '@/lib/services/email';
import type { DbInquiry } from '@/lib/db/schema';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    let query = supabaseAdmin.from('inquiries').select('*').order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    if (type) query = query.eq('type', type);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ success: true, inquiries: data });
  } catch (error) {
    console.error('Inquiries fetch error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch inquiries' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid enquiry' }, { status: 400 });
    }
    const { type } = body;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';

    if (!type || !name || !email || !message) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    if (!['coaching', 'birthday_party', 'contact', 'general'].includes(type) || name.length > 200 || email.length > 254 || phone.length > 40 || message.length > 10100 || /[\r\n]/.test(name + email)) {
      return NextResponse.json({ success: false, error: 'Invalid enquiry details' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ success: false, error: 'Invalid email format' }, { status: 400 });
    }

    const inquiry: Partial<DbInquiry> = { type, name, email, phone: phone || null, message, status: 'new' };

    const { data, error } = await supabaseAdmin.from('inquiries').insert(inquiry).select().single();
    if (error) throw error;

    // Await both sends: detached promises may be terminated after a serverless response.
    const [admin, confirmation] = await Promise.all([
      sendAdminInquiryNotification({ name, email, type, message, phone }),
      sendInquiryConfirmation({ name, email, type }),
    ]);

    return NextResponse.json({ success: true, inquiry: data, notification: { admin, confirmation } });
  } catch (error) {
    console.error('Inquiry creation error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create inquiry' }, { status: 500 });
  }
}
