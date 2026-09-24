import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/services/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || '30'; // days

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));
    const startDateStr = startDate.toISOString();

    // Get counts
    const [
      { count: totalBookings },
      { count: confirmedBookings },
      { count: pendingBookings },
      { count: totalInquiries },
      { count: newInquiries },
      { count: totalGroupBookings }
    ] = await Promise.all([
      supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'confirmed'),
      supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending_payment'),
      supabaseAdmin.from('inquiries').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('inquiries').select('id', { count: 'exact', head: true }).eq('status', 'new'),
      supabaseAdmin.from('group_session_bookings').select('id', { count: 'exact', head: true }).eq('status', 'confirmed')
    ]);

    // Get revenue (confirmed bookings in period)
    const { data: revenueData } = await supabaseAdmin
      .from('bookings')
      .select('amount')
      .eq('status', 'confirmed')
      .eq('payment_status', 'paid')
      .gte('created_at', startDateStr);

    const { data: groupRevenueData } = await supabaseAdmin
      .from('group_session_bookings')
      .select('amount')
      .eq('payment_status', 'paid')
      .gte('created_at', startDateStr);

    const bookingRevenue = revenueData?.reduce((sum, b) => sum + parseFloat(b.amount || '0'), 0) || 0;
    const groupRevenue = groupRevenueData?.reduce((sum, b) => sum + Number(b.amount || 0), 0) || 0;

    const totalRevenue = bookingRevenue + groupRevenue;

    // Get today's bookings
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: todaysBookings } = await supabaseAdmin
      .from('bookings')
      .select('*, resource:resources!bookings_resource_id_fkey(name)')
      .gte('start_at', today.toISOString())
      .lt('start_at', tomorrow.toISOString())
      .eq('status', 'confirmed')
      .order('start_at');

    // Get upcoming bookings (next 7 days)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const { data: upcomingBookings } = await supabaseAdmin
      .from('bookings')
      .select('*, resource:resources!bookings_resource_id_fkey(name)')
      .gte('start_at', new Date().toISOString())
      .lt('start_at', nextWeek.toISOString())
      .eq('status', 'confirmed')
      .order('start_at')
      .limit(10);

    // Resource utilization
    const { data: resources } = await supabaseAdmin
      .from('resources')
      .select('id, name, type, active');

    // Count bookings per resource
    const { data: resourceBookings } = await supabaseAdmin
      .from('bookings')
      .select('resource_id, id')
      .eq('status', 'confirmed')
      .gte('start_at', startDateStr);

    const resourceUtilization = resources?.map(r => ({
      ...r,
      bookings: resourceBookings?.filter(b => b.resource_id === r.id).length || 0
    })) || [];

    return NextResponse.json({
      success: true,
      stats: {
        totalBookings: totalBookings || 0,
        confirmedBookings: confirmedBookings || 0,
        pendingBookings: pendingBookings || 0,
        totalInquiries: totalInquiries || 0,
        newInquiries: newInquiries || 0,
        totalGroupBookings: totalGroupBookings || 0,
        totalRevenue: totalRevenue.toFixed(2),
        period
      },
      todaysBookings: todaysBookings || [],
      upcomingBookings: upcomingBookings || [],
      resourceUtilization
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
